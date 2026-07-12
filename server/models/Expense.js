/**
 * TransitOps — Expense Model
 * General operational expenses per vehicle (tolls, fines, insurance, parking, etc.)
 * Fuel costs are tracked in FuelLog — this model covers all other expense categories
 */
const mongoose = require('mongoose');
const { EXPENSE_CATEGORY } = require('../utils/constants');

const expenseSchema = new mongoose.Schema(
  {
    // ── References ────────────────────────────
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle is required'],
    },

    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null, // Optional link to a trip
    },

    // ── Expense Details ───────────────────────
    category: {
      type: String,
      required: [true, 'Expense category is required'],
      enum: {
        values: Object.values(EXPENSE_CATEGORY),
        message: 'Invalid expense category',
      },
    },

    amount: {
      type: Number,
      required: [true, 'Expense amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },

    date: {
      type: Date,
      required: [true, 'Expense date is required'],
      default: Date.now,
    },

    // ── Receipt / Reference ───────────────────
    receiptNumber: {
      type: String,
      trim: true,
      maxlength: [50, 'Receipt number cannot exceed 50 characters'],
      default: null,
    },

    location: {
      type: String,
      trim: true,
      maxlength: [150, 'Location cannot exceed 150 characters'],
      default: null,
    },

    notes: {
      type: String,
      maxlength: [300, 'Notes cannot exceed 300 characters'],
      default: null,
    },

    // ── Logged by ─────────────────────────────
    loggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────
expenseSchema.index({ vehicle: 1 });
expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ vehicle: 1, date: -1 });   // Per-vehicle expense history
expenseSchema.index({ vehicle: 1, category: 1 }); // Per-vehicle per-category totals

// ─────────────────────────────────────────────
// Static helpers
// ─────────────────────────────────────────────

/** Total expenses for a vehicle (optionally by category) */
expenseSchema.statics.getTotalForVehicle = async function (vehicleId, category = null) {
  const matchQuery = { vehicle: new mongoose.Types.ObjectId(vehicleId) };
  if (category) matchQuery.category = category;

  const result = await this.aggregate([
    { $match: matchQuery },
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
  ]);
  return result;
};

/** Total expenses across all vehicles grouped by category */
expenseSchema.statics.getBreakdownByCategory = async function (startDate, endDate) {
  const matchQuery = {};
  if (startDate || endDate) {
    matchQuery.date = {};
    if (startDate) matchQuery.date.$gte = new Date(startDate);
    if (endDate) matchQuery.date.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);
};

/** Operational cost summary per vehicle (for analytics) */
expenseSchema.statics.getOperationalCostSummary = async function () {
  return this.aggregate([
    {
      $group: {
        _id: '$vehicle',
        totalExpenses: { $sum: '$amount' },
        expenseCount: { $sum: 1 },
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
        totalExpenses: 1,
        expenseCount: 1,
      },
    },
    { $sort: { totalExpenses: -1 } },
  ]);
};

const Expense = mongoose.model('Expense', expenseSchema);
module.exports = Expense;
