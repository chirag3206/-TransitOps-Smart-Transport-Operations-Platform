/**
 * TransitOps — User Model
 * Mongoose schema for authenticated users with RBAC roles
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { USER_ROLE } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },

    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never returned in queries by default
    },

    // ── Role-Based Access Control ─────────────
    role: {
      type: String,
      enum: {
        values: Object.values(USER_ROLE),
        message: 'Role must be one of: fleet_manager, driver, safety_officer, financial_analyst',
      },
      default: USER_ROLE.DRIVER,
    },

    // ── OAuth ─────────────────────────────────
    googleId: {
      type: String,
      sparse: true, // Allow multiple null values (only unique when set)
      default: null,
    },

    avatar: {
      type: String, // URL to profile picture (from Google or default)
      default: null,
    },

    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },

    // ── Account State ─────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // ── Security ──────────────────────────────
    lastLogin: {
      type: Date,
      default: null,
    },

    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes are auto-created via schema field options:
// email: unique: true  → creates unique index
// googleId: sparse: true → creates sparse index
// Additional compound index for role-based queries
userSchema.index({ role: 1, isActive: 1 });


// ─────────────────────────────────────────────
// Virtual: full display name + avatar fallback
// ─────────────────────────────────────────────
userSchema.virtual('displayName').get(function () {
  return this.name;
});

userSchema.virtual('initials').get(function () {
  return this.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

// ─────────────────────────────────────────────
// Pre-save: Hash password before saving
// ─────────────────────────────────────────────
userSchema.pre('save', async function () {
  // Only hash if password was modified
  if (!this.isModified('password') || !this.password) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = Date.now();
});

// ─────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────

/** Compare plain password with stored hash */
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

/** Check if password was changed after a JWT was issued */
userSchema.methods.passwordChangedAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedAt = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return changedAt > jwtTimestamp;
  }
  return false;
};

/** Safe user object (strips sensitive fields) */
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    avatar: this.avatar,
    authProvider: this.authProvider,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
  };
};

// ─────────────────────────────────────────────
// Static Methods
// ─────────────────────────────────────────────

/** Find active user by email (includes password for auth) */
userSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email: email.toLowerCase(), isActive: true }).select('+password');
};

/** Find active user by refresh token hash */
userSchema.statics.findByRefreshToken = function (hash) {
  return this.findOne({ refreshTokenHash: hash, isActive: true }).select('+refreshTokenHash');
};

const User = mongoose.model('User', userSchema);
module.exports = User;
