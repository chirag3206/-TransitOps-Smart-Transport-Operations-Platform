/**
 * TransitOps — Expense Controller
 * Logs operational expenses per vehicle (tolls, fines, parking, insurance, etc.)
 * Syncs vehicle totalRevenue is NOT affected — expenses reduce operational profit
 */
const Expense = require('../models/Expense');
const Vehicle = require('../models/Vehicle');
const { ApiError } = require('../middleware/errorHandler');
const { sendSuccess, sendPaginated, parsePagination, parseSort } = require('../utils/apiResponse');
const { bustCache } = require('../utils/cacheHelpers');

const SORT_FIELDS = ['date', 'amount', 'category', 'createdAt'];

// ─────────────────────────────────────────────
// GET /api/expenses
// ─────────────────────────────────────────────
const getExpenses = async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query, SORT_FIELDS);

  const filter = {};
  if (req.query.vehicle) filter.vehicle = req.query.vehicle;
  if (req.query.trip) filter.trip = req.query.trip;
  if (req.query.category) filter.category = req.query.category;

  if (req.query.fromDate || req.query.toDate) {
    filter.date = {};
    if (req.query.fromDate) filter.date.$gte = new Date(req.query.fromDate);
    if (req.query.toDate) filter.date.$lte = new Date(req.query.toDate);
  }

  if (req.query.minAmount || req.query.maxAmount) {
    filter.amount = {};
    if (req.query.minAmount) filter.amount.$gte = parseFloat(req.query.minAmount);
    if (req.query.maxAmount) filter.amount.$lte = parseFloat(req.query.maxAmount);
  }

  const [expenses, total] = await Promise.all([
    Expense.find(filter)
      .sort(sort).skip(skip).limit(limit)
      .populate('vehicle', 'registrationNumber name type')
      .populate('trip', 'source destination')
      .populate('loggedBy', 'name email')
      .lean(),
    Expense.countDocuments(filter),
  ]);

  sendPaginated(res, expenses, total, page, limit, 'Expenses retrieved');
};

// ─────────────────────────────────────────────
// GET /api/expenses/:id
// ─────────────────────────────────────────────
const getExpenseById = async (req, res, next) => {
  const expense = await Expense.findById(req.params.id)
    .populate('vehicle', 'registrationNumber name type')
    .populate('trip', 'source destination status')
    .populate('loggedBy', 'name email')
    .lean();

  if (!expense) return next(new ApiError(404, 'Expense not found'));
  sendSuccess(res, 200, 'Expense retrieved', expense);
};

// ─────────────────────────────────────────────
// POST /api/expenses
// ─────────────────────────────────────────────
const createExpense = async (req, res, next) => {
  const vehicle = await Vehicle.findById(req.body.vehicle);
  if (!vehicle) return next(new ApiError(404, 'Vehicle not found'));

  const expense = await Expense.create({
    ...req.body,
    loggedBy: req.user._id,
  });

  const populated = await Expense.findById(expense._id)
    .populate('vehicle', 'registrationNumber name type')
    .populate('trip', 'source destination')
    .lean();

  bustCache.expenses();
  sendSuccess(res, 201, 'Expense logged successfully', populated);
};

// ─────────────────────────────────────────────
// PUT /api/expenses/:id
// ─────────────────────────────────────────────
const updateExpense = async (req, res, next) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return next(new ApiError(404, 'Expense not found'));

  const updated = await Expense.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true, returnDocument: 'after' }
  ).populate('vehicle', 'registrationNumber name type')
   .lean();

  bustCache.expenses();
  sendSuccess(res, 200, 'Expense updated', updated);
};

// ─────────────────────────────────────────────
// DELETE /api/expenses/:id
// ─────────────────────────────────────────────
const deleteExpense = async (req, res, next) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return next(new ApiError(404, 'Expense not found'));

  await Expense.findByIdAndDelete(req.params.id);
  bustCache.expenses();
  sendSuccess(res, 200, 'Expense deleted');
};

// ─────────────────────────────────────────────
// GET /api/expenses/summary
// Total expenses grouped by category
// ─────────────────────────────────────────────
const getExpenseSummary = async (req, res) => {
  const matchQuery = {};
  if (req.query.vehicle) matchQuery.vehicle = new (require('mongoose').Types.ObjectId)(req.query.vehicle);
  if (req.query.fromDate || req.query.toDate) {
    matchQuery.date = {};
    if (req.query.fromDate) matchQuery.date.$gte = new Date(req.query.fromDate);
    if (req.query.toDate) matchQuery.date.$lte = new Date(req.query.toDate);
  }

  const [byCategory, byVehicle, totals] = await Promise.all([
    // Group by category
    Expense.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),

    // Group by vehicle (top 10)
    Expense.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$vehicle', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $lookup: { from: 'vehicles', localField: '_id', foreignField: '_id', as: 'vehicle' } },
      { $unwind: '$vehicle' },
      { $project: { vehicleName: '$vehicle.name', registrationNumber: '$vehicle.registrationNumber', total: 1, count: 1 } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),

    // Overall totals
    Expense.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, grandTotal: { $sum: '$amount' }, totalRecords: { $sum: 1 } } },
    ]),
  ]);

  sendSuccess(res, 200, 'Expense summary retrieved', {
    grandTotal: totals[0]?.grandTotal || 0,
    totalRecords: totals[0]?.totalRecords || 0,
    byCategory,
    topVehiclesByExpense: byVehicle,
  });
};

module.exports = {
  getExpenses, getExpenseById,
  createExpense, updateExpense, deleteExpense,
  getExpenseSummary,
};
