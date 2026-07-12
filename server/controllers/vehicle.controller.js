/**
 * TransitOps — Vehicle Controller
 * Full CRUD + business rule enforcement:
 *  - Unique registration number
 *  - Status transitions validated
 *  - Blocked statuses excluded from dispatch pool
 *  - Cannot delete On-Trip vehicles
 *  - Search, filter, sort, paginate
 */
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const { ApiError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, parsePagination, parseSort } = require('../utils/apiResponse');
const { bustCache } = require('../utils/cacheHelpers');
const {
  VEHICLE_STATUS,
  VEHICLE_BLOCKED_STATUSES,
  TRIP_STATUS,
} = require('../utils/constants');

// Allowed sort fields
const SORT_FIELDS = ['name', 'registrationNumber', 'status', 'type', 'odometer', 'acquisitionCost', 'createdAt'];

// ─────────────────────────────────────────────
// GET /api/vehicles
// ─────────────────────────────────────────────
const getVehicles = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query, SORT_FIELDS);

  // Build filter query
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.region) filter.region = req.query.region;

  // Global text search across name and registration
  if (req.query.search) {
    const regex = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [
      { name: regex },
      { registrationNumber: regex },
    ];
  }

  const [vehicles, total] = await Promise.all([
    Vehicle.find(filter).sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
    Vehicle.countDocuments(filter),
  ]);

  sendPaginated(res, vehicles, total, page, limit, 'Vehicles retrieved successfully');
};

// ─────────────────────────────────────────────
// GET /api/vehicles/available
// Returns only vehicles eligible for dispatch
// ─────────────────────────────────────────────
const getAvailableVehicles = async (req, res) => {
  const vehicles = await Vehicle.findAvailable({
    ...(req.query.type && { type: req.query.type }),
    ...(req.query.region && { region: req.query.region }),
  }).lean({ virtuals: true });

  sendSuccess(res, 200, 'Available vehicles retrieved', vehicles);
};

// ─────────────────────────────────────────────
// GET /api/vehicles/:id
// ─────────────────────────────────────────────
const getVehicleById = async (req, res, next) => {
  const vehicle = await Vehicle.findById(req.params.id).lean({ virtuals: true });

  if (!vehicle) {
    return next(new ApiError(404, `Vehicle with ID '${req.params.id}' not found`));
  }

  sendSuccess(res, 200, 'Vehicle retrieved successfully', vehicle);
};

// ─────────────────────────────────────────────
// POST /api/vehicles
// ─────────────────────────────────────────────
const createVehicle = async (req, res, next) => {
  const {
    registrationNumber, name, type, maxLoadCapacity,
    acquisitionCost, odometer, status, region, year,
    fuelType, notes,
  } = req.body;

  // Business rule: registration number must be unique
  const taken = await Vehicle.isRegistrationTaken(registrationNumber);
  if (taken) {
    return next(new ApiError(409, `Registration number '${registrationNumber.toUpperCase()}' is already registered`));
  }

  const vehicle = await Vehicle.create({
    registrationNumber: registrationNumber.toUpperCase().trim(),
    name, type, maxLoadCapacity, acquisitionCost,
    odometer: odometer || 0,
    status: status || VEHICLE_STATUS.AVAILABLE,
    region, year, fuelType, notes,
  });

  bustCache.vehicles();
  sendSuccess(res, 201, 'Vehicle registered successfully', vehicle.toObject({ virtuals: true }));
};

// ─────────────────────────────────────────────
// PUT /api/vehicles/:id
// ─────────────────────────────────────────────
const updateVehicle = async (req, res, next) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) {
    return next(new ApiError(404, `Vehicle not found`));
  }

  // Business rule: if changing registration number, check uniqueness
  if (req.body.registrationNumber) {
    const newRegNum = req.body.registrationNumber.toUpperCase().trim();
    if (newRegNum !== vehicle.registrationNumber) {
      const taken = await Vehicle.isRegistrationTaken(newRegNum, vehicle._id);
      if (taken) {
        return next(new ApiError(409, `Registration number '${newRegNum}' is already taken`));
      }
      req.body.registrationNumber = newRegNum;
    }
  }

  // Business rule: cannot manually set status to On Trip (only dispatch can)
  if (req.body.status === VEHICLE_STATUS.ON_TRIP) {
    return next(new ApiError(400, 'Cannot manually set vehicle status to "On Trip". Use the trip dispatch workflow.'));
  }

  // Business rule: cannot un-retire a vehicle back to Available via plain update
  if (vehicle.status === VEHICLE_STATUS.RETIRED && req.body.status === VEHICLE_STATUS.AVAILABLE) {
    return next(new ApiError(400, 'Cannot reactivate a Retired vehicle. Contact a Fleet Manager.'));
  }

  // Business rule: cannot update an On-Trip vehicle's critical fields
  if (vehicle.status === VEHICLE_STATUS.ON_TRIP) {
    const blockedFields = ['maxLoadCapacity', 'type', 'registrationNumber'];
    const attemptedBlocked = blockedFields.filter((f) => req.body[f] !== undefined);
    if (attemptedBlocked.length > 0) {
      return next(new ApiError(400, `Cannot update ${attemptedBlocked.join(', ')} while vehicle is On Trip`));
    }
  }

  const updated = await Vehicle.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).lean({ virtuals: true });

  bustCache.vehicles();
  sendSuccess(res, 200, 'Vehicle updated successfully', updated);
};

// ─────────────────────────────────────────────
// DELETE /api/vehicles/:id
// ─────────────────────────────────────────────
const deleteVehicle = async (req, res, next) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) {
    return next(new ApiError(404, 'Vehicle not found'));
  }

  // Business rule: cannot delete a vehicle currently On Trip
  if (vehicle.status === VEHICLE_STATUS.ON_TRIP) {
    return next(new ApiError(400, 'Cannot delete a vehicle that is currently On Trip. Complete or cancel the trip first.'));
  }

  // Business rule: cannot delete if there are completed trips (history must be preserved)
  const tripCount = await Trip.countDocuments({ vehicle: req.params.id });
  if (tripCount > 0) {
    // Soft delete — retire instead of hard delete to preserve history
    await Vehicle.findByIdAndUpdate(req.params.id, { status: VEHICLE_STATUS.RETIRED });
    bustCache.vehicles();
    return sendSuccess(res, 200, 'Vehicle has trip history and has been retired instead of deleted. This preserves data integrity.');
  }

  await Vehicle.findByIdAndDelete(req.params.id);
  bustCache.vehicles();
  sendSuccess(res, 200, 'Vehicle deleted successfully');
};

// ─────────────────────────────────────────────
// PATCH /api/vehicles/:id/status
// Direct status update with business rule checks
// ─────────────────────────────────────────────
const updateVehicleStatus = async (req, res, next) => {
  const { status } = req.body;

  if (!status || !Object.values(VEHICLE_STATUS).includes(status)) {
    return next(new ApiError(400, `Valid status required: ${Object.values(VEHICLE_STATUS).join(', ')}`));
  }

  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) return next(new ApiError(404, 'Vehicle not found'));

  if (status === VEHICLE_STATUS.ON_TRIP) {
    return next(new ApiError(400, 'Use the trip dispatch workflow to set a vehicle On Trip'));
  }

  if (vehicle.status === VEHICLE_STATUS.ON_TRIP && status !== VEHICLE_STATUS.AVAILABLE) {
    return next(new ApiError(400, 'An On Trip vehicle can only be set back to Available via trip completion or cancellation'));
  }

  vehicle.status = status;
  await vehicle.save();

  bustCache.vehicles();
  sendSuccess(res, 200, `Vehicle status updated to '${status}'`, vehicle.toObject({ virtuals: true }));
};

// ─────────────────────────────────────────────
// GET /api/vehicles/:id/summary
// Per-vehicle cost and trip summary
// ─────────────────────────────────────────────
const getVehicleSummary = async (req, res, next) => {
  const vehicle = await Vehicle.findById(req.params.id).lean({ virtuals: true });
  if (!vehicle) return next(new ApiError(404, 'Vehicle not found'));

  const [trips, activeTrip] = await Promise.all([
    Trip.find({ vehicle: req.params.id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('driver', 'name')
      .lean(),
    Trip.findOne({ vehicle: req.params.id, status: TRIP_STATUS.DISPATCHED })
      .populate('driver', 'name contactNumber')
      .lean(),
  ]);

  sendSuccess(res, 200, 'Vehicle summary retrieved', {
    vehicle,
    recentTrips: trips,
    activeTrip,
    costSummary: {
      fuelCost: vehicle.totalFuelCost,
      maintenanceCost: vehicle.totalMaintenanceCost,
      totalOperationalCost: vehicle.totalOperationalCost,
      totalRevenue: vehicle.totalRevenue,
      roi: vehicle.roi,
    },
  });
};

module.exports = {
  getVehicles,
  getAvailableVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  updateVehicleStatus,
  getVehicleSummary,
};
