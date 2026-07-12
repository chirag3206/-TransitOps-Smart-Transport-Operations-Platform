/**
 * TransitOps — Vehicle Model
 * Complete vehicle registry with status management and cost tracking
 */
const mongoose = require('mongoose');
const {
  VEHICLE_STATUS,
  VEHICLE_TYPE,
  VEHICLE_BLOCKED_STATUSES,
} = require('../utils/constants');

const vehicleSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, 'Registration number must be at least 3 characters'],
      maxlength: [20, 'Registration number cannot exceed 20 characters'],
      match: [/^[A-Z0-9\-]+$/, 'Registration number can only contain letters, numbers, and hyphens'],
    },

    name: {
      type: String,
      required: [true, 'Vehicle name/model is required'],
      trim: true,
      maxlength: [100, 'Vehicle name cannot exceed 100 characters'],
    },

    type: {
      type: String,
      required: [true, 'Vehicle type is required'],
      enum: {
        values: Object.values(VEHICLE_TYPE),
        message: 'Invalid vehicle type',
      },
    },

    // ── Capacity & Measurements ───────────────
    maxLoadCapacity: {
      type: Number,
      required: [true, 'Maximum load capacity is required'],
      min: [1, 'Load capacity must be at least 1 kg'],
      max: [100000, 'Load capacity cannot exceed 100,000 kg'],
    },

    odometer: {
      type: Number,
      default: 0,
      min: [0, 'Odometer reading cannot be negative'],
    },

    // ── Financial ────────────────────────────
    acquisitionCost: {
      type: Number,
      required: [true, 'Acquisition cost is required'],
      min: [0, 'Acquisition cost cannot be negative'],
    },

    // ── Status ────────────────────────────────
    status: {
      type: String,
      enum: {
        values: Object.values(VEHICLE_STATUS),
        message: 'Invalid vehicle status',
      },
      default: VEHICLE_STATUS.AVAILABLE,
    },

    // ── Additional Info ───────────────────────
    region: {
      type: String,
      trim: true,
      default: null,
    },

    year: {
      type: Number,
      min: [1990, 'Year must be 1990 or later'],
      max: [new Date().getFullYear() + 1, 'Year cannot be in the future'],
      default: null,
    },

    fuelType: {
      type: String,
      enum: ['Diesel', 'Petrol', 'CNG', 'Electric', 'Hybrid'],
      default: 'Diesel',
    },

    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: null,
    },

    // ── Computed summary fields (updated by services) ──
    totalFuelCost: { type: Number, default: 0 },
    totalMaintenanceCost: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalTrips: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 },
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
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ type: 1 });
vehicleSchema.index({ region: 1 });
vehicleSchema.index({ status: 1, type: 1 }); // Compound for filtered dispatch queries

// ─────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────

/** Total operational cost = fuel + maintenance */
vehicleSchema.virtual('totalOperationalCost').get(function () {
  return (this.totalFuelCost || 0) + (this.totalMaintenanceCost || 0);
});

/** ROI = (Revenue - OperationalCost) / AcquisitionCost */
vehicleSchema.virtual('roi').get(function () {
  if (!this.acquisitionCost) return 0;
  const opCost = (this.totalFuelCost || 0) + (this.totalMaintenanceCost || 0);
  return ((this.totalRevenue || 0) - opCost) / this.acquisitionCost;
});

/** Is available for dispatch */
vehicleSchema.virtual('isAvailableForDispatch').get(function () {
  return !VEHICLE_BLOCKED_STATUSES.includes(this.status);
});

// ─────────────────────────────────────────────
// Static helpers
// ─────────────────────────────────────────────

/** Vehicles available for dispatch selection */
vehicleSchema.statics.findAvailable = function (filter = {}) {
  return this.find({
    status: VEHICLE_STATUS.AVAILABLE,
    ...filter,
  }).sort({ name: 1 });
};

/** Check if registration number is already taken (case-insensitive) */
vehicleSchema.statics.isRegistrationTaken = async function (regNum, excludeId = null) {
  const query = { registrationNumber: regNum.toUpperCase().trim() };
  if (excludeId) query._id = { $ne: excludeId };
  const count = await this.countDocuments(query);
  return count > 0;
};

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
module.exports = Vehicle;
