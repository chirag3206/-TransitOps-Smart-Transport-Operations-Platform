/**
 * TransitOps — Maintenance Controller
 * Business rules:
 *  - Cannot open maintenance on a vehicle that is On Trip
 *  - Cannot have two Active maintenance records for the same vehicle
 *  - Opening Active record → vehicle status = "In Shop"
 *  - Closing record (Active → Closed) → vehicle status = "Available"
 *  - Cannot delete an Active maintenance record (must close first)
 */
const Maintenance = require('../models/Maintenance');
const Vehicle = require('../models/Vehicle');
const { ApiError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, parsePagination, parseSort } = require('../utils/apiResponse');
const { bustCache } = require('../utils/cacheHelpers');
const { MAINTENANCE_STATUS, VEHICLE_STATUS } = require('../utils/constants');

const SORT_FIELDS = ['startDate', 'endDate', 'actualCost', 'estimatedCost', 'createdAt'];

// ─────────────────────────────────────────────
// GET /api/maintenance
// ─────────────────────────────────────────────
const getMaintenanceRecords = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query, SORT_FIELDS);

  const filter = {};
  if (req.query.vehicle) filter.vehicle = req.query.vehicle;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;

  if (req.query.fromDate || req.query.toDate) {
    filter.startDate = {};
    if (req.query.fromDate) filter.startDate.$gte = new Date(req.query.fromDate);
    if (req.query.toDate) filter.startDate.$lte = new Date(req.query.toDate);
  }

  const [records, total] = await Promise.all([
    Maintenance.find(filter)
      .sort(sort).skip(skip).limit(limit)
      .populate('vehicle', 'registrationNumber name type make model')
      .populate('closedBy', 'name email')
      .lean({ virtuals: true }),
    Maintenance.countDocuments(filter),
  ]);

  sendPaginated(res, records, total, page, limit, 'Maintenance records retrieved');
};

// ─────────────────────────────────────────────
// GET /api/maintenance/:id
// ─────────────────────────────────────────────
const getMaintenanceById = async (req, res, next) => {
  const record = await Maintenance.findById(req.params.id)
    .populate('vehicle', 'registrationNumber name type status odometer make model')
    .populate('closedBy', 'name email')
    .lean({ virtuals: true });

  if (!record) return next(new ApiError(404, 'Maintenance record not found'));
  sendSuccess(res, 200, 'Maintenance record retrieved', record);
};

// ─────────────────────────────────────────────
// POST /api/maintenance
// ─────────────────────────────────────────────
const createMaintenance = async (req, res, next) => {
  const { vehicle: vehicleId } = req.body;

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) return next(new ApiError(404, 'Vehicle not found'));

  // Business rule: cannot send an On Trip vehicle to maintenance
  if (vehicle.status === VEHICLE_STATUS.ON_TRIP) {
    return next(new ApiError(400,
      `Vehicle '${vehicle.registrationNumber}' is currently On Trip. Complete or cancel the trip before scheduling maintenance.`
    ));
  }

  // Business rule: cannot have two Active/Pending maintenance records
  const existingActive = await Maintenance.findActiveForVehicle(vehicleId);
  if (existingActive) {
    return next(new ApiError(409,
      `Vehicle '${vehicle.registrationNumber}' already has an active or pending maintenance record (ID: ${existingActive._id}). Close it before opening a new one.`
    ));
  }

  // Create maintenance and update vehicle status to Pending Maintenance
  const [record] = await Promise.all([
    Maintenance.create({
      ...req.body,
      status: MAINTENANCE_STATUS.PENDING_APPROVAL,
    }),
    Vehicle.findByIdAndUpdate(vehicleId, { status: VEHICLE_STATUS.PENDING_MAINTENANCE }),
  ]);

  const populated = await Maintenance.findById(record._id)
    .populate('vehicle', 'registrationNumber name type make model')
    .lean({ virtuals: true });

  bustCache.maintenance();
  sendSuccess(res, 201, `Maintenance scheduled. Awaiting Safety Inspector approval. Vehicle '${vehicle.registrationNumber}' set to Pending Maintenance.`, populated);
};

// ─────────────────────────────────────────────
// POST /api/maintenance/:id/approve
// Pending Approval → In Workshop, vehicle → In Shop
// ─────────────────────────────────────────────
const approveMaintenance = async (req, res, next) => {
  const record = await Maintenance.findById(req.params.id);
  if (!record) return next(new ApiError(404, 'Maintenance record not found'));

  if (record.status !== MAINTENANCE_STATUS.PENDING_APPROVAL) {
    return next(new ApiError(400, `Only records pending approval can be approved. Current status: '${record.status}'`));
  }

  // Only safety_officer can approve
  if (req.user.role !== 'safety_officer') {
    return next(new ApiError(403, 'Access denied. Only Safety Inspectors can approve maintenance logs.'));
  }

  // Allow updating fields on approval (type, description, estimatedCost, workshopName, odometerReading, notes)
  const updates = {
    status: MAINTENANCE_STATUS.IN_WORKSHOP,
    ...req.body,
  };

  await Promise.all([
    Maintenance.findByIdAndUpdate(req.params.id, updates),
    Vehicle.findByIdAndUpdate(record.vehicle, { status: VEHICLE_STATUS.IN_SHOP }),
  ]);

  const updated = await Maintenance.findById(req.params.id)
    .populate('vehicle', 'registrationNumber name type make model')
    .lean({ virtuals: true });

  bustCache.maintenance();
  sendSuccess(res, 200, 'Maintenance record approved and vehicle sent to workshop.', updated);
};

// ─────────────────────────────────────────────
// POST /api/maintenance/:id/close
// Active → Closed, vehicle → Available
// ─────────────────────────────────────────────
const closeMaintenance = async (req, res, next) => {
  const record = await Maintenance.findById(req.params.id);
  if (!record) return next(new ApiError(404, 'Maintenance record not found'));

  if (record.status === MAINTENANCE_STATUS.CLOSED) {
    return next(new ApiError(400, 'This maintenance record is already closed'));
  }

  if (record.status !== MAINTENANCE_STATUS.IN_WORKSHOP) {
    return next(new ApiError(400, `Only records currently in workshop can be closed. Current status: '${record.status}'`));
  }

  // Only safety_officer can close/mark ready
  if (req.user.role !== 'safety_officer') {
    return next(new ApiError(403, 'Access denied. Only Safety Inspectors can mark maintenance as ready.'));
  }

  const { actualCost, endDate, notes } = req.body;
  const now = new Date();

  await Maintenance.findByIdAndUpdate(req.params.id, {
    status: MAINTENANCE_STATUS.CLOSED,
    actualCost: actualCost ?? record.estimatedCost,
    endDate: endDate ? new Date(endDate) : now,
    closedBy: req.user._id,
    closedAt: now,
    ...(notes && { notes }),
  });

  // Release vehicle back to Available and update maintenance cost total
  const finalCost = actualCost ?? record.estimatedCost ?? 0;
  await Vehicle.findByIdAndUpdate(record.vehicle, {
    status: VEHICLE_STATUS.AVAILABLE,
    $inc: { totalMaintenanceCost: finalCost },
  });

  const updated = await Maintenance.findById(req.params.id)
    .populate('vehicle', 'registrationNumber name type make model')
    .populate('closedBy', 'name email')
    .lean({ virtuals: true });

  bustCache.maintenance();
  sendSuccess(res, 200, 'Maintenance record closed. Vehicle status set to Available.', updated);
};

// ─────────────────────────────────────────────
// PUT /api/maintenance/:id
// Only Active records can be updated
// ─────────────────────────────────────────────
const updateMaintenance = async (req, res, next) => {
  const record = await Maintenance.findById(req.params.id);
  if (!record) return next(new ApiError(404, 'Maintenance record not found'));

  if (record.status === MAINTENANCE_STATUS.CLOSED) {
    return next(new ApiError(400, 'Cannot update a closed maintenance record'));
  }

  // Prevent direct status manipulation (use /close endpoint)
  if (req.body.status) {
    return next(new ApiError(400, 'Use the /close endpoint to close a maintenance record'));
  }

  const updated = await Maintenance.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true, returnDocument: 'after' }
  ).populate('vehicle', 'registrationNumber name type make model')
   .lean({ virtuals: true });

  bustCache.maintenance();
  sendSuccess(res, 200, 'Maintenance record updated', updated);
};

// ─────────────────────────────────────────────
// DELETE /api/maintenance/:id
// ─────────────────────────────────────────────
const deleteMaintenance = async (req, res, next) => {
  const record = await Maintenance.findById(req.params.id);
  if (!record) return next(new ApiError(404, 'Maintenance record not found'));

  // Business rule: cannot delete active records (pending approval or in workshop)
  if (record.status === MAINTENANCE_STATUS.PENDING_APPROVAL || record.status === MAINTENANCE_STATUS.IN_WORKSHOP) {
    return next(new ApiError(400,
      'Cannot delete an active or pending maintenance record. Decline or close it first to release the vehicle.'
    ));
  }

  await Maintenance.findByIdAndDelete(req.params.id);
  bustCache.maintenance();
  sendSuccess(res, 200, 'Maintenance record deleted');
};

module.exports = {
  getMaintenanceRecords,
  getMaintenanceById,
  createMaintenance,
  approveMaintenance,
  closeMaintenance,
  updateMaintenance,
  deleteMaintenance,
};
