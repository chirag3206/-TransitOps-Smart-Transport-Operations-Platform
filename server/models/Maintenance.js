/**
 * TransitOps — Maintenance Model
 * Vehicle maintenance records with automatic status transitions
 * Creating an Active record → vehicle status becomes "In Shop"
 * Closing the record → vehicle status returns to "Available"
 */
const mongoose = require('mongoose');
const { MAINTENANCE_STATUS, MAINTENANCE_TYPE } = require('../utils/constants');

const maintenanceSchema = new mongoose.Schema(
  {
    // ── Reference ─────────────────────────────
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle is required'],
    },

    // ── Maintenance Details ───────────────────
    type: {
      type: String,
      required: [true, 'Maintenance type is required'],
      enum: {
        values: Object.values(MAINTENANCE_TYPE),
        message: 'Invalid maintenance type',
      },
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    // ── Status ────────────────────────────────
    status: {
      type: String,
      enum: {
        values: Object.values(MAINTENANCE_STATUS),
        message: 'Invalid maintenance status',
      },
      default: MAINTENANCE_STATUS.ACTIVE,
    },

    // ── Cost ──────────────────────────────────
    estimatedCost: {
      type: Number,
      default: null,
      min: [0, 'Estimated cost cannot be negative'],
    },

    actualCost: {
      type: Number,
      default: null,
      min: [0, 'Actual cost cannot be negative'],
    },

    // ── Dates ─────────────────────────────────
    startDate: {
      type: Date,
      default: Date.now,
    },

    endDate: {
      type: Date,
      default: null,
    },

    // ── Workshop ──────────────────────────────
    workshopName: {
      type: String,
      trim: true,
      maxlength: [100, 'Workshop name cannot exceed 100 characters'],
      default: null,
    },

    // ── Odometer at maintenance ───────────────
    odometerReading: {
      type: Number,
      default: null,
      min: [0, 'Odometer reading cannot be negative'],
    },

    // ── Notes ─────────────────────────────────
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: null,
    },

    // ── Closed by ────────────────────────────
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    closedAt: {
      type: Date,
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
maintenanceSchema.index({ vehicle: 1 });
maintenanceSchema.index({ status: 1 });
maintenanceSchema.index({ vehicle: 1, status: 1 });
maintenanceSchema.index({ startDate: -1 });

// ─────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────

/** Duration in days (for closed records) */
maintenanceSchema.virtual('durationDays').get(function () {
  if (!this.startDate) return null;
  const end = this.endDate || new Date();
  return Math.ceil((end - this.startDate) / (1000 * 60 * 60 * 24));
});

/** Final cost (actual if set, else estimated) */
maintenanceSchema.virtual('finalCost').get(function () {
  return this.actualCost ?? this.estimatedCost ?? 0;
});

// ─────────────────────────────────────────────
// Static helpers
// ─────────────────────────────────────────────

/** Find active maintenance for a vehicle */
maintenanceSchema.statics.findActiveForVehicle = function (vehicleId) {
  return this.findOne({ vehicle: vehicleId, status: MAINTENANCE_STATUS.ACTIVE });
};

/** Get total maintenance cost for a vehicle */
maintenanceSchema.statics.getTotalCostForVehicle = async function (vehicleId) {
  const result = await this.aggregate([
    { $match: { vehicle: new mongoose.Types.ObjectId(vehicleId) } },
    {
      $group: {
        _id: null,
        total: {
          $sum: { $ifNull: ['$actualCost', { $ifNull: ['$estimatedCost', 0] }] },
        },
      },
    },
  ]);
  return result[0]?.total || 0;
};

const Maintenance = mongoose.model('Maintenance', maintenanceSchema);
module.exports = Maintenance;
