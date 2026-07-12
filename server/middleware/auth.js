/**
 * TransitOps — Authentication & RBAC Middleware
 *
 * protect      — Verifies JWT, attaches req.user
 * authorize    — Checks user role against allowed roles
 * optionalAuth — Attaches user if token present, doesn't fail if not
 */
const passport = require('passport');
const { ApiError } = require('./errorHandler');
const { USER_ROLE } = require('../utils/constants');
const logger = require('../config/logger');

// ─────────────────────────────────────────────
// protect — require valid JWT
// ─────────────────────────────────────────────
const protect = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      const message =
        info?.message ||
        (info?.name === 'TokenExpiredError'
          ? 'Your session has expired. Please log in again.'
          : 'Authentication required. Please log in.');

      return next(new ApiError(401, message));
    }

    req.user = user;
    next();
  })(req, res, next);
};

// ─────────────────────────────────────────────
// authorize — allow only specified roles
// Usage: router.get('/admin', protect, authorize('fleet_manager'), handler)
// Usage: router.get('/shared', protect, authorize('fleet_manager', 'driver'), handler)
// ─────────────────────────────────────────────
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(
        `Access denied: User ${req.user.email} (${req.user.role}) attempted to access ${req.method} ${req.originalUrl} — requires: [${roles.join(', ')}]`
      );
      return next(
        new ApiError(
          403,
          `Access denied. This action requires one of these roles: ${roles.join(', ')}`
        )
      );
    }

    next();
  };
};

// ─────────────────────────────────────────────
// Role aliases for cleaner route definitions
// ─────────────────────────────────────────────
const roles = USER_ROLE;

// Pre-built authorize helpers per role group
const onlyFleetManager = authorize(roles.FLEET_MANAGER);
const onlyFinancialAnalyst = authorize(roles.FINANCIAL_ANALYST);
const onlySafetyOfficer = authorize(roles.SAFETY_OFFICER);
const fleetOrDriver = authorize(roles.FLEET_MANAGER, roles.DRIVER);
const allRoles = authorize(...Object.values(roles));

// ─────────────────────────────────────────────
// optionalAuth — attach user if token present, continue regardless
// Useful for endpoints that behave differently for logged-in vs anonymous
// ─────────────────────────────────────────────
const optionalAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (user) req.user = user;
    next(); // Always continue
  })(req, res, next);
};

// ─────────────────────────────────────────────
// requireOwner — only allow access to the resource's owner or fleet manager
// ─────────────────────────────────────────────
const requireOwnerOrManager = (getOwnerId) => async (req, res, next) => {
  try {
    const ownerId = await getOwnerId(req);
    const isOwner = req.user._id.toString() === ownerId?.toString();
    const isManager = req.user.role === roles.FLEET_MANAGER;

    if (!isOwner && !isManager) {
      return next(new ApiError(403, 'You can only access your own resources'));
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  protect,
  authorize,
  optionalAuth,
  requireOwnerOrManager,
  onlyFleetManager,
  onlyFinancialAnalyst,
  onlySafetyOfficer,
  fleetOrDriver,
  allRoles,
  roles,
};
