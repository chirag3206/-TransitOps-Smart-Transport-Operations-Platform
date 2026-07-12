/**
 * TransitOps — Driver Model
 * Driver profiles with license management, safety scores, and status tracking
 */
const mongoose = require('mongoose');
const {
  DRIVER_STATUS,
  LICENSE_CATEGORY,
  DRIVER_BLOCKED_STATUSES,
  LICENSE_EXPIRY_WARNING_DAYS,
} = require('../utils/constants');

const driverSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────
    name: {
      type: String,
      required: [true, 'Driver name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },

    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
      match: [/^[+\d\s\-()]{7,20}$/, 'Please enter a valid contact number'],
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
      default: null,
    },

    address: {
      type: String,
      maxlength: [200, 'Address cannot exceed 200 characters'],
      default: null,
    },

    region: {
      type: String,
      trim: true,
      default: null,
    },

    // ── License ───────────────────────────────
    licenseNumber: {
      type: String,
      required: [true, 'License number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [4, 'License number must be at least 4 characters'],
      maxlength: [30, 'License number cannot exceed 30 characters'],
    },

    licenseCategory: {
      type: String,
      required: [true, 'License category is required'],
      enum: {
        values: Object.values(LICENSE_CATEGORY),
        message: 'Invalid license category',
      },
    },

    licenseExpiryDate: {
      type: Date,
      required: [true, 'License expiry date is required'],
    },

    // ── Status & Safety ───────────────────────
    status: {
      type: String,
      enum: {
        values: Object.values(DRIVER_STATUS),
        message: 'Invalid driver status',
      },
      default: DRIVER_STATUS.AVAILABLE,
    },

    safetyScore: {
      type: Number,
      min: [0, 'Safety score cannot be negative'],
      max: [100, 'Safety score cannot exceed 100'],
      default: 100,
    },

    // ── Trip Statistics ────────────────────────
    totalTrips: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 },
    completedTrips: { type: Number, default: 0 },
    cancelledTrips: { type: Number, default: 0 },

    // ── Misc ──────────────────────────────────
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: null,
    },

    joiningDate: {
      type: Date,
      default: Date.now,
    },

    avatar: {
      type: String,
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
driverSchema.index({ status: 1 });
driverSchema.index({ licenseExpiryDate: 1 });
driverSchema.index({ region: 1 });
driverSchema.index({ status: 1, licenseExpiryDate: 1 }); // Compound for dispatch queries

// ─────────────────────────────────────────────
// Virtuals
// ─────────────────────────────────────────────

/** Whether the license is currently expired */
driverSchema.virtual('isLicenseExpired').get(function () {
  return this.licenseExpiryDate < new Date();
});

/** Days until license expires (negative = already expired) */
driverSchema.virtual('daysUntilExpiry').get(function () {
  const now = new Date();
  const diff = this.licenseExpiryDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

/** License expiry status for UI color coding */
driverSchema.virtual('licenseStatus').get(function () {
  const days = Math.ceil((this.licenseExpiryDate - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= LICENSE_EXPIRY_WARNING_DAYS) return 'expiring_soon';
  return 'valid';
});

/** Is available for dispatch (no blocked status + valid license) */
driverSchema.virtual('isAvailableForDispatch').get(function () {
  if (DRIVER_BLOCKED_STATUSES.includes(this.status)) return false;
  if (this.isLicenseExpired) return false;
  return true;
});

/** Completion rate percentage */
driverSchema.virtual('completionRate').get(function () {
  if (!this.totalTrips) return 0;
  return Math.round((this.completedTrips / this.totalTrips) * 100);
});

// ─────────────────────────────────────────────
// Static helpers
// ─────────────────────────────────────────────

/** Drivers available for dispatch (available status + non-expired license) */
driverSchema.statics.findAvailable = function (filter = {}) {
  return this.find({
    status: DRIVER_STATUS.AVAILABLE,
    licenseExpiryDate: { $gt: new Date() },
    ...filter,
  }).sort({ name: 1 });
};

/** Drivers whose licenses expire within N days */
driverSchema.statics.findExpiringLicenses = function (days = LICENSE_EXPIRY_WARNING_DAYS) {
  const now = new Date();
  const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return this.find({
    licenseExpiryDate: { $lte: threshold },
    status: { $ne: DRIVER_STATUS.SUSPENDED },
  }).sort({ licenseExpiryDate: 1 });
};

/** Check if license number is already taken */
driverSchema.statics.isLicenseTaken = async function (licenseNum, excludeId = null) {
  const query = { licenseNumber: licenseNum.toUpperCase().trim() };
  if (excludeId) query._id = { $ne: excludeId };
  const count = await this.countDocuments(query);
  return count > 0;
};

const Driver = mongoose.model('Driver', driverSchema);
module.exports = Driver;
