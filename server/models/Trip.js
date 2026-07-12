/**
 * TransitOps — Trip Model
 * Manages the complete trip lifecycle: Draft → Dispatched → Completed → Cancelled
 * Enforces all cargo weight and availability business rules
 */
const mongoose = require('mongoose');
const { TRIP_STATUS } = require('../utils/constants');

const tripSchema = new mongoose.Schema(
  {
    // ── Route ─────────────────────────────────
    source: {
      type: String,
      required: [true, 'Source location is required'],
      trim: true,
      maxlength: [150, 'Source cannot exceed 150 characters'],
    },

    destination: {
      type: String,
      required: [true, 'Destination is required'],
      trim: true,
      maxlength: [150, 'Destination cannot exceed 150 characters'],
    },

    plannedDistance: {
      type: Number,
      required: [true, 'Planned distance is required'],
      min: [1, 'Planned distance must be at least 1 km'],
    },

    actualDistance: {
      type: Number,
      default: null,
      min: [0, 'Actual distance cannot be negative'],
    },

    // ── Cargo ─────────────────────────────────
    cargoWeight: {
      type: Number,
      required: [true, 'Cargo weight is required'],
      min: [0, 'Cargo weight cannot be negative'],
    },

    cargoDescription: {
      type: String,
      maxlength: [300, 'Cargo description cannot exceed 300 characters'],
      default: null,
    },

    // ── References ────────────────────────────
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle is required'],
    },

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'Driver is required'],
    },

    // ── Lifecycle ─────────────────────────────
    status: {
      type: String,
      enum: {
        values: Object.values(TRIP_STATUS),
        message: 'Invalid trip status',
      },
      default: TRIP_STATUS.DRAFT,
    },

    // ── Timestamps per status change ──────────
    dispatchedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    // ── Odometer readings ─────────────────────
    startOdometer: {
      type: Number,
      default: null,
      min: [0, 'Start odometer cannot be negative'],
    },

    endOdometer: {
      type: Number,
      default: null,
      min: [0, 'End odometer cannot be negative'],
    },

    // ── Fuel (recorded on completion) ─────────
    fuelConsumed: {
      type: Number,
      default: null,
      min: [0, 'Fuel consumed cannot be negative'],
    },

    // ── Revenue & Financial ───────────────────
    revenue: {
      type: Number,
      default: 0,
      min: [0, 'Revenue cannot be negative'],
    },

    // ── Notes ─────────────────────────────────
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: null,
    },

    cancellationReason: {
      type: String,
      maxlength: [300, 'Cancellation reason cannot exceed 300 characters'],
      default: null,
    },

    // ── Created by ────────────────────────────
    createdBy: {
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
tripSchema.index({ status: 1 });
tripSchema.index({ vehicle: 1, status: 1 });
tripSchema.index({ driver: 1, status: 1 });
tripSchema.index({ createdAt: -1 });
tripSchema.index({ dispatchedAt: -1 });

// ─────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────

/** Actual distance computed from odometer readings if available */
tripSchema.virtual('computedDistance').get(function () {
  if (this.endOdometer && this.startOdometer) {
    return this.endOdometer - this.startOdometer;
  }
  return this.actualDistance || this.plannedDistance;
});

/** Fuel efficiency: km per litre */
tripSchema.virtual('fuelEfficiency').get(function () {
  const distance = this.computedDistance;
  if (!distance || !this.fuelConsumed || this.fuelConsumed === 0) return null;
  return parseFloat((distance / this.fuelConsumed).toFixed(2));
});

/** Duration in minutes (for completed trips) */
tripSchema.virtual('durationMinutes').get(function () {
  if (!this.dispatchedAt || !this.completedAt) return null;
  return Math.round((this.completedAt - this.dispatchedAt) / 60000);
});

// ─────────────────────────────────────────────
// Static helpers
// ─────────────────────────────────────────────

/** Check if vehicle is currently on an active trip */
tripSchema.statics.isVehicleOnTrip = async function (vehicleId, excludeTripId = null) {
  const query = {
    vehicle: vehicleId,
    status: { $in: [TRIP_STATUS.DISPATCHED, TRIP_STATUS.IN_PROGRESS, TRIP_STATUS.PENDING_COMPLETION] },
  };
  if (excludeTripId) query._id = { $ne: excludeTripId };
  return (await this.countDocuments(query)) > 0;
};

/** Check if driver is currently on an active trip */
tripSchema.statics.isDriverOnTrip = async function (driverId, excludeTripId = null) {
  const query = {
    driver: driverId,
    status: { $in: [TRIP_STATUS.DISPATCHED, TRIP_STATUS.IN_PROGRESS, TRIP_STATUS.PENDING_COMPLETION] },
  };
  if (excludeTripId) query._id = { $ne: excludeTripId };
  return (await this.countDocuments(query)) > 0;
};

const Trip = mongoose.model('Trip', tripSchema);
module.exports = Trip;
