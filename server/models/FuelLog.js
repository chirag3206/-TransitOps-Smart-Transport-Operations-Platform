/**
 * TransitOps — FuelLog Model
 * Records fuel fill-ups per vehicle with cost and odometer tracking
 */
const mongoose = require('mongoose');

const fuelLogSchema = new mongoose.Schema(
  {
    // ── Reference ─────────────────────────────
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle is required'],
    },

    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null, // Optional — can log fuel outside of a trip
    },

    // ── Fuel Data ─────────────────────────────
    liters: {
      type: Number,
      required: [true, 'Fuel quantity in liters is required'],
      min: [0.1, 'Fuel quantity must be at least 0.1 liters'],
      max: [5000, 'Fuel quantity cannot exceed 5000 liters'],
    },

    pricePerLiter: {
      type: Number,
      required: [true, 'Price per liter is required'],
      min: [0, 'Price per liter cannot be negative'],
    },

    totalCost: {
      type: Number,
      required: [true, 'Total cost is required'],
      min: [0, 'Total cost cannot be negative'],
    },

    // ── Context ───────────────────────────────
    date: {
      type: Date,
      required: [true, 'Fuel log date is required'],
      default: Date.now,
    },

    odometerReading: {
      type: Number,
      default: null,
      min: [0, 'Odometer reading cannot be negative'],
    },

    location: {
      type: String,
      trim: true,
      maxlength: [150, 'Location cannot exceed 150 characters'],
      default: null,
    },

    fuelType: {
      type: String,
      enum: ['Diesel', 'Petrol', 'CNG', 'Electric', 'Hybrid'],
      default: 'Diesel',
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
// Pre-save: Auto-compute totalCost if not provided
// ─────────────────────────────────────────────
fuelLogSchema.pre('save', async function () {
  if (this.isModified('liters') || this.isModified('pricePerLiter')) {
    if (this.liters && this.pricePerLiter) {
      this.totalCost = parseFloat((this.liters * this.pricePerLiter).toFixed(2));
    }
  }
});

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────
fuelLogSchema.index({ vehicle: 1 });
fuelLogSchema.index({ date: -1 });
fuelLogSchema.index({ vehicle: 1, date: -1 }); // Compound for per-vehicle fuel history

// ─────────────────────────────────────────────
// Static helpers
// ─────────────────────────────────────────────

/** Total fuel cost for a vehicle */
fuelLogSchema.statics.getTotalCostForVehicle = async function (vehicleId) {
  const result = await this.aggregate([
    { $match: { vehicle: new mongoose.Types.ObjectId(vehicleId) } },
    { $group: { _id: null, totalCost: { $sum: '$totalCost' }, totalLiters: { $sum: '$liters' } } },
  ]);
  return { totalCost: result[0]?.totalCost || 0, totalLiters: result[0]?.totalLiters || 0 };
};

/** Fuel efficiency over a date range (km/L) */
fuelLogSchema.statics.getFuelEfficiency = async function (vehicleId, startDate, endDate) {
  const matchQuery = { vehicle: new mongoose.Types.ObjectId(vehicleId) };
  if (startDate || endDate) {
    matchQuery.date = {};
    if (startDate) matchQuery.date.$gte = new Date(startDate);
    if (endDate) matchQuery.date.$lte = new Date(endDate);
  }

  const result = await this.aggregate([
    { $match: matchQuery },
    { $group: { _id: null, totalLiters: { $sum: '$liters' } } },
  ]);

  return result[0]?.totalLiters || 0;
};

const FuelLog = mongoose.model('FuelLog', fuelLogSchema);
module.exports = FuelLog;
