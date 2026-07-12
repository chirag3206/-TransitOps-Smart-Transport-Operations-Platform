/**
 * TransitOps — Trip Controller
 * The core dispatch engine with all business rules:
 *
 * CREATE   → Draft status
 * DISPATCH → Draft → Dispatched
 *            ✓ Vehicle must be Available (not On Trip / In Shop / Retired)
 *            ✓ Driver must be Available (not On Trip / Suspended / Off Duty)
 *            ✓ Driver license must NOT be expired
 *            ✓ Cargo weight must NOT exceed vehicle max load capacity
 *            ✓ Vehicle → On Trip, Driver → On Trip
 * COMPLETE → Dispatched → Completed
 *            ✓ Updates vehicle odometer
 *            ✓ Updates driver & vehicle trip statistics
 *            ✓ Vehicle → Available, Driver → Available
 * CANCEL   → Draft/Dispatched → Cancelled
 *            ✓ If Dispatched: Vehicle → Available, Driver → Available
 */
const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const { ApiError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, parsePagination, parseSort } = require('../utils/apiResponse');
const { bustCache } = require('../utils/cacheHelpers');
const { TRIP_STATUS, VEHICLE_STATUS, DRIVER_STATUS } = require('../utils/constants');

const SORT_FIELDS = ['source', 'destination', 'status', 'cargoWeight', 'revenue', 'createdAt', 'dispatchedAt'];

// ─────────────────────────────────────────────
// GET /api/trips
// ─────────────────────────────────────────────
const getTrips = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query, SORT_FIELDS);

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.vehicle) filter.vehicle = req.query.vehicle;
  if (req.query.driver) filter.driver = req.query.driver;

  if (req.query.search) {
    const regex = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ source: regex }, { destination: regex }];
  }

  // Date range filter
  if (req.query.fromDate || req.query.toDate) {
    filter.createdAt = {};
    if (req.query.fromDate) filter.createdAt.$gte = new Date(req.query.fromDate);
    if (req.query.toDate) filter.createdAt.$lte = new Date(req.query.toDate);
  }

  const [trips, total] = await Promise.all([
    Trip.find(filter)
      .sort(sort).skip(skip).limit(limit)
      .populate('vehicle', 'registrationNumber name type')
      .populate('driver', 'name contactNumber licenseNumber')
      .populate('createdBy', 'name email')
      .lean({ virtuals: true }),
    Trip.countDocuments(filter),
  ]);

  sendPaginated(res, trips, total, page, limit, 'Trips retrieved successfully');
};

// ─────────────────────────────────────────────
// GET /api/trips/active
// ─────────────────────────────────────────────
const getActiveTrips = async (req, res) => {
  const trips = await Trip.find({ status: TRIP_STATUS.DISPATCHED })
    .populate('vehicle', 'registrationNumber name type region')
    .populate('driver', 'name contactNumber')
    .sort({ dispatchedAt: -1 })
    .lean({ virtuals: true });

  sendSuccess(res, 200, 'Active trips retrieved', trips);
};

// ─────────────────────────────────────────────
// GET /api/trips/:id
// ─────────────────────────────────────────────
const getTripById = async (req, res, next) => {
  const trip = await Trip.findById(req.params.id)
    .populate('vehicle', 'registrationNumber name type maxLoadCapacity')
    .populate('driver', 'name contactNumber licenseNumber licenseCategory safetyScore')
    .populate('createdBy', 'name email role')
    .lean({ virtuals: true });

  if (!trip) return next(new ApiError(404, 'Trip not found'));
  sendSuccess(res, 200, 'Trip retrieved', trip);
};

// ─────────────────────────────────────────────
// POST /api/trips
// Create a Draft trip
// ─────────────────────────────────────────────
const createTrip = async (req, res, next) => {
  const { vehicle: vehicleId, driver: driverId, cargoWeight } = req.body;

  // Prefetch vehicle and driver (no heavy availability check yet — just existence)
  const [vehicle, driver] = await Promise.all([
    Vehicle.findById(vehicleId),
    Driver.findById(driverId),
  ]);

  if (!vehicle) return next(new ApiError(404, `Vehicle not found`));
  if (!driver) return next(new ApiError(404, `Driver not found`));

  // Early cargo check (can be caught at draft stage too)
  if (cargoWeight > vehicle.maxLoadCapacity) {
    return next(new ApiError(400,
      `Cargo weight (${cargoWeight} kg) exceeds vehicle max load capacity (${vehicle.maxLoadCapacity} kg)`
    ));
  }

  const trip = await Trip.create({
    ...req.body,
    status: TRIP_STATUS.DRAFT,
    createdBy: req.user._id,
  });

  const populated = await Trip.findById(trip._id)
    .populate('vehicle', 'registrationNumber name type maxLoadCapacity')
    .populate('driver', 'name contactNumber licenseNumber')
    .lean({ virtuals: true });

  bustCache.trips();
  sendSuccess(res, 201, 'Trip created successfully', populated);
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/dispatch
// Draft → Dispatched (with all business rule checks)
// ─────────────────────────────────────────────
const dispatchTrip = async (req, res, next) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return next(new ApiError(404, 'Trip not found'));

  // Business rule: only Draft trips can be dispatched
  if (trip.status !== TRIP_STATUS.DRAFT) {
    return next(new ApiError(400, `Only Draft trips can be dispatched. Current status: '${trip.status}'`));
  }

  // Fetch vehicle and driver fresh
  const [vehicle, driver] = await Promise.all([
    Vehicle.findById(trip.vehicle),
    Driver.findById(trip.driver),
  ]);

  if (!vehicle) return next(new ApiError(404, 'Assigned vehicle not found'));
  if (!driver) return next(new ApiError(404, 'Assigned driver not found'));

  // ── Business Rule 1: Vehicle must be Available ──
  if (vehicle.status !== VEHICLE_STATUS.AVAILABLE) {
    return next(new ApiError(400,
      `Vehicle '${vehicle.registrationNumber}' is not available for dispatch. Current status: '${vehicle.status}'`
    ));
  }

  // ── Business Rule 2: Driver must be Available ──
  if (driver.status !== DRIVER_STATUS.AVAILABLE) {
    return next(new ApiError(400,
      `Driver '${driver.name}' is not available for dispatch. Current status: '${driver.status}'`
    ));
  }

  // ── Business Rule 3: Driver license must not be expired ──
  if (driver.isLicenseExpired) {
    return next(new ApiError(400,
      `Driver '${driver.name}' has an expired license (expired: ${driver.licenseExpiryDate.toDateString()}). Renew license before dispatching.`
    ));
  }

  // ── Business Rule 4: Cargo weight must not exceed vehicle capacity ──
  if (trip.cargoWeight > vehicle.maxLoadCapacity) {
    return next(new ApiError(400,
      `Cargo weight (${trip.cargoWeight} kg) exceeds vehicle max load capacity (${vehicle.maxLoadCapacity} kg)`
    ));
  }

  // ── Business Rule 5: Double-check no concurrent trip conflicts ──
  const [vehicleConflict, driverConflict] = await Promise.all([
    Trip.isVehicleOnTrip(trip.vehicle, trip._id),
    Trip.isDriverOnTrip(trip.driver, trip._id),
  ]);

  if (vehicleConflict) {
    return next(new ApiError(409, `Vehicle '${vehicle.registrationNumber}' is already on an active trip`));
  }
  if (driverConflict) {
    return next(new ApiError(409, `Driver '${driver.name}' is already on an active trip`));
  }

  // ── All checks passed — execute dispatch ──
  const startOdometer = req.body.startOdometer ?? vehicle.odometer;

  // Atomic updates using Promise.all
  await Promise.all([
    Trip.findByIdAndUpdate(trip._id, {
      status: TRIP_STATUS.DISPATCHED,
      dispatchedAt: new Date(),
      startOdometer,
    }),
    Vehicle.findByIdAndUpdate(trip.vehicle, { status: VEHICLE_STATUS.ON_TRIP }),
    Driver.findByIdAndUpdate(trip.driver, { status: DRIVER_STATUS.ON_TRIP }),
  ]);

  const updated = await Trip.findById(trip._id)
    .populate('vehicle', 'registrationNumber name type')
    .populate('driver', 'name contactNumber')
    .lean({ virtuals: true });

  bustCache.trips();
  sendSuccess(res, 200, 'Trip dispatched successfully', updated);
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/complete
// Dispatched → Completed
// ─────────────────────────────────────────────
const completeTrip = async (req, res, next) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return next(new ApiError(404, 'Trip not found'));

  // Business rule: only Dispatched trips can be completed
  if (trip.status !== TRIP_STATUS.DISPATCHED) {
    return next(new ApiError(400, `Only Dispatched trips can be completed. Current status: '${trip.status}'`));
  }

  const { endOdometer, actualDistance, fuelConsumed, revenue } = req.body;
  const now = new Date();

  // Compute actual distance from odometer if provided
  let computedDistance = actualDistance;
  if (endOdometer && trip.startOdometer) {
    if (endOdometer < trip.startOdometer) {
      return next(new ApiError(400, `End odometer (${endOdometer}) cannot be less than start odometer (${trip.startOdometer})`));
    }
    computedDistance = endOdometer - trip.startOdometer;
  }

  const finalRevenue = revenue ?? trip.revenue ?? 0;
  const finalDistance = computedDistance ?? trip.plannedDistance;

  // Update trip
  await Trip.findByIdAndUpdate(trip._id, {
    status: TRIP_STATUS.COMPLETED,
    completedAt: now,
    endOdometer: endOdometer ?? null,
    actualDistance: finalDistance,
    fuelConsumed: fuelConsumed ?? null,
    revenue: finalRevenue,
  });

  // Update vehicle: status → Available, odometer, totals
  await Vehicle.findByIdAndUpdate(trip.vehicle, {
    status: VEHICLE_STATUS.AVAILABLE,
    ...(endOdometer && { odometer: endOdometer }),
    $inc: {
      totalTrips: 1,
      totalDistance: finalDistance,
      totalRevenue: finalRevenue,
      ...(fuelConsumed && { totalFuelCost: 0 }), // Fuel cost tracked via FuelLog
    },
  });

  // Update driver: status → Available, trip stats
  await Driver.findByIdAndUpdate(trip.driver, {
    status: DRIVER_STATUS.AVAILABLE,
    $inc: {
      totalTrips: 1,
      completedTrips: 1,
      totalDistance: finalDistance,
    },
  });

  const updated = await Trip.findById(trip._id)
    .populate('vehicle', 'registrationNumber name type')
    .populate('driver', 'name contactNumber')
    .lean({ virtuals: true });

  bustCache.trips();
  sendSuccess(res, 200, 'Trip completed successfully', updated);
};

// ─────────────────────────────────────────────
// POST /api/trips/:id/cancel
// Draft/Dispatched → Cancelled
// ─────────────────────────────────────────────
const cancelTrip = async (req, res, next) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return next(new ApiError(404, 'Trip not found'));

  // Business rule: cannot cancel a completed trip
  if (trip.status === TRIP_STATUS.COMPLETED || trip.status === TRIP_STATUS.CANCELLED) {
    return next(new ApiError(400, `Cannot cancel a trip with status '${trip.status}'`));
  }

  const wasDispatched = trip.status === TRIP_STATUS.DISPATCHED;

  await Trip.findByIdAndUpdate(trip._id, {
    status: TRIP_STATUS.CANCELLED,
    cancelledAt: new Date(),
    cancellationReason: req.body.cancellationReason,
  });

  // If was dispatched, free up vehicle and driver
  if (wasDispatched) {
    await Promise.all([
      Vehicle.findByIdAndUpdate(trip.vehicle, { status: VEHICLE_STATUS.AVAILABLE }),
      Driver.findByIdAndUpdate(trip.driver, {
        status: DRIVER_STATUS.AVAILABLE,
        $inc: { totalTrips: 1, cancelledTrips: 1 },
      }),
    ]);
  }

  const updated = await Trip.findById(trip._id)
    .populate('vehicle', 'registrationNumber name')
    .populate('driver', 'name contactNumber')
    .lean({ virtuals: true });

  bustCache.trips();
  sendSuccess(res, 200, 'Trip cancelled successfully', updated);
};

// ─────────────────────────────────────────────
// PUT /api/trips/:id
// Update only Draft trips
// ─────────────────────────────────────────────
const updateTrip = async (req, res, next) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return next(new ApiError(404, 'Trip not found'));

  if (trip.status !== TRIP_STATUS.DRAFT) {
    return next(new ApiError(400, `Only Draft trips can be edited. Current status: '${trip.status}'`));
  }

  // If changing vehicle, validate cargo weight
  const vehicleId = req.body.vehicle || trip.vehicle;
  const cargoWeight = req.body.cargoWeight ?? trip.cargoWeight;

  if (req.body.vehicle || req.body.cargoWeight !== undefined) {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return next(new ApiError(404, 'Vehicle not found'));
    if (cargoWeight > vehicle.maxLoadCapacity) {
      return next(new ApiError(400,
        `Cargo weight (${cargoWeight} kg) exceeds vehicle max load capacity (${vehicle.maxLoadCapacity} kg)`
      ));
    }
  }

  const updated = await Trip.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true, returnDocument: 'after' }
  ).populate('vehicle', 'registrationNumber name type')
   .populate('driver', 'name contactNumber')
   .lean({ virtuals: true });

  bustCache.trips();
  sendSuccess(res, 200, 'Trip updated successfully', updated);
};

// ─────────────────────────────────────────────
// DELETE /api/trips/:id
// Only Draft trips can be deleted
// ─────────────────────────────────────────────
const deleteTrip = async (req, res, next) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return next(new ApiError(404, 'Trip not found'));

  if (trip.status !== TRIP_STATUS.DRAFT) {
    return next(new ApiError(400, `Only Draft trips can be deleted. Use cancel for Dispatched trips.`));
  }

  await Trip.findByIdAndDelete(req.params.id);
  bustCache.trips();
  sendSuccess(res, 200, 'Trip deleted successfully');
};

module.exports = {
  getTrips,
  getActiveTrips,
  getTripById,
  createTrip,
  dispatchTrip,
  completeTrip,
  cancelTrip,
  updateTrip,
  deleteTrip,
};
