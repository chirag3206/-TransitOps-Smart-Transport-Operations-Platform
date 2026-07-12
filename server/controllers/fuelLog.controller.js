/**
 * TransitOps — FuelLog Controller
 * Logs fuel fill-ups per vehicle with cost tracking
 * Updates vehicle totalFuelCost on create/delete
 */
const FuelLog = require('../models/FuelLog');
const Vehicle = require('../models/Vehicle');
const { ApiError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, parsePagination, parseSort } = require('../utils/apiResponse');
const { bustCache } = require('../utils/cacheHelpers');

const SORT_FIELDS = ['date', 'liters', 'totalCost', 'createdAt'];

// ─────────────────────────────────────────────
// GET /api/fuel-logs
// ─────────────────────────────────────────────
const getFuelLogs = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query, SORT_FIELDS);

  const filter = {};
  if (req.query.vehicle) filter.vehicle = req.query.vehicle;
  if (req.query.trip) filter.trip = req.query.trip;
  if (req.query.fuelType) filter.fuelType = req.query.fuelType;

  if (req.query.fromDate || req.query.toDate) {
    filter.date = {};
    if (req.query.fromDate) filter.date.$gte = new Date(req.query.fromDate);
    if (req.query.toDate) filter.date.$lte = new Date(req.query.toDate);
  }

  const [logs, total] = await Promise.all([
    FuelLog.find(filter)
      .sort(sort).skip(skip).limit(limit)
      .populate('vehicle', 'registrationNumber name type fuelType')
      .populate('trip', 'source destination')
      .populate('loggedBy', 'name email')
      .lean(),
    FuelLog.countDocuments(filter),
  ]);

  sendPaginated(res, logs, total, page, limit, 'Fuel logs retrieved');
};

// ─────────────────────────────────────────────
// GET /api/fuel-logs/:id
// ─────────────────────────────────────────────
const getFuelLogById = async (req, res, next) => {
  const log = await FuelLog.findById(req.params.id)
    .populate('vehicle', 'registrationNumber name type')
    .populate('trip', 'source destination status')
    .populate('loggedBy', 'name email')
    .lean();

  if (!log) return next(new ApiError(404, 'Fuel log not found'));
  sendSuccess(res, 200, 'Fuel log retrieved', log);
};

// ─────────────────────────────────────────────
// POST /api/fuel-logs
// ─────────────────────────────────────────────
const createFuelLog = async (req, res, next) => {
  const { vehicle: vehicleId, liters, pricePerLiter } = req.body;

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) return next(new ApiError(404, 'Vehicle not found'));

  // Auto-compute totalCost if not provided
  const totalCost = req.body.totalCost ?? parseFloat((liters * pricePerLiter).toFixed(2));

  const log = await FuelLog.create({
    ...req.body,
    totalCost,
    loggedBy: req.user._id,
  });

  // Update vehicle totalFuelCost
  await Vehicle.findByIdAndUpdate(vehicleId, {
    $inc: { totalFuelCost: totalCost },
  });

  const populated = await FuelLog.findById(log._id)
    .populate('vehicle', 'registrationNumber name type')
    .populate('trip', 'source destination')
    .lean();

  bustCache.fuelLogs();
  sendSuccess(res, 201, 'Fuel log recorded successfully', populated);
};

// ─────────────────────────────────────────────
// PUT /api/fuel-logs/:id
// ─────────────────────────────────────────────
const updateFuelLog = async (req, res, next) => {
  const log = await FuelLog.findById(req.params.id);
  if (!log) return next(new ApiError(404, 'Fuel log not found'));

  // Recalculate totalCost if liters or price changed
  if (req.body.liters !== undefined || req.body.pricePerLiter !== undefined) {
    const liters = req.body.liters ?? log.liters;
    const price = req.body.pricePerLiter ?? log.pricePerLiter;
    const newCost = parseFloat((liters * price).toFixed(2));
    const costDiff = newCost - log.totalCost;

    req.body.totalCost = newCost;

    // Update vehicle totalFuelCost with the difference
    await Vehicle.findByIdAndUpdate(log.vehicle, {
      $inc: { totalFuelCost: costDiff },
    });
  }

  const updated = await FuelLog.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, returnDocument: 'after' }
  ).populate('vehicle', 'registrationNumber name type')
   .lean();

  bustCache.fuelLogs();
  sendSuccess(res, 200, 'Fuel log updated', updated);
};

// ─────────────────────────────────────────────
// DELETE /api/fuel-logs/:id
// ─────────────────────────────────────────────
const deleteFuelLog = async (req, res, next) => {
  const log = await FuelLog.findById(req.params.id);
  if (!log) return next(new ApiError(404, 'Fuel log not found'));

  // Reverse vehicle totalFuelCost
  await Promise.all([
    FuelLog.findByIdAndDelete(req.params.id),
    Vehicle.findByIdAndUpdate(log.vehicle, {
      $inc: { totalFuelCost: -log.totalCost },
    }),
  ]);

  bustCache.fuelLogs();
  sendSuccess(res, 200, 'Fuel log deleted');
};

// ─────────────────────────────────────────────
// GET /api/fuel-logs/stats
// Aggregated fuel stats per vehicle
// ─────────────────────────────────────────────
const getFuelStats = async (req, res) => {
  const matchQuery = {};
  if (req.query.vehicle) matchQuery.vehicle = new (require('mongoose').Types.ObjectId)(req.query.vehicle);
  if (req.query.fromDate || req.query.toDate) {
    matchQuery.date = {};
    if (req.query.fromDate) matchQuery.date.$gte = new Date(req.query.fromDate);
    if (req.query.toDate) matchQuery.date.$lte = new Date(req.query.toDate);
  }

  const stats = await FuelLog.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$vehicle',
        totalLiters: { $sum: '$liters' },
        totalCost: { $sum: '$totalCost' },
        fillUps: { $sum: 1 },
        avgPricePerLiter: { $avg: '$pricePerLiter' },
      },
    },
    {
      $lookup: {
        from: 'vehicles',
        localField: '_id',
        foreignField: '_id',
        as: 'vehicle',
      },
    },
    { $unwind: '$vehicle' },
    {
      $project: {
        vehicleId: '$_id',
        vehicleName: '$vehicle.name',
        registrationNumber: '$vehicle.registrationNumber',
        totalLiters: 1,
        totalCost: { $round: ['$totalCost', 2] },
        fillUps: 1,
        avgPricePerLiter: { $round: ['$avgPricePerLiter', 2] },
      },
    },
    { $sort: { totalCost: -1 } },
  ]);

  sendSuccess(res, 200, 'Fuel statistics retrieved', stats);
};

module.exports = {
  getFuelLogs, getFuelLogById,
  createFuelLog, updateFuelLog, deleteFuelLog,
  getFuelStats,
};
