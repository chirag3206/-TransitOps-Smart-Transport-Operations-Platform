/**
 * TransitOps — Driver Routes
 *
 * GET    /api/drivers                        - List all drivers (search, filter, sort, paginate)
 * GET    /api/drivers/available              - Dispatch pool (Available + non-expired license)
 * GET    /api/drivers/expiring-licenses      - License expiry alerts (Safety Officer)
 * GET    /api/drivers/:id                    - Get single driver
 * GET    /api/drivers/:id/summary            - Driver summary (trips, performance, license alert)
 * POST   /api/drivers                        - Register new driver
 * PUT    /api/drivers/:id                    - Update driver
 * PATCH  /api/drivers/:id/status             - Update status only
 * PATCH  /api/drivers/:id/safety-score       - Update safety score (Safety Officer)
 * DELETE /api/drivers/:id                    - Delete (or suspend) driver
 */
const router = require('express').Router();
const {
  getDrivers, getAvailableDrivers, getExpiringLicenses,
  getDriverById, createDriver, updateDriver, deleteDriver,
  updateDriverStatus, updateSafetyScore, getDriverSummary,
} = require('../controllers/driver.controller');

const { protect, onlyFleetManager, onlySafetyOfficer, authorize, roles } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiter');
const { cacheMiddleware, CACHE_TTLS } = require('../middleware/cache');
const { validate, createDriverRules, updateDriverRules, listDriverRules } = require('../validators/driver.validator');

// All driver routes require JWT
router.use(protect);

// ── Read routes (cached) ─────────────────────────────────────────────────────
router.get(
  '/',
  listDriverRules, validate,
  cacheMiddleware(CACHE_TTLS.DRIVERS, 'drivers'),
  getDrivers
);

router.get(
  '/available',
  cacheMiddleware(CACHE_TTLS.DRIVERS, 'drivers-available'),
  getAvailableDrivers
);

// Safety officers + fleet managers can view expiring licenses
router.get(
  '/expiring-licenses',
  authorize(roles.FLEET_MANAGER, roles.SAFETY_OFFICER),
  cacheMiddleware(60, 'drivers-expiring'),
  getExpiringLicenses
);

router.get(
  '/:id/summary',
  cacheMiddleware(CACHE_TTLS.DRIVERS, 'driver-summary'),
  getDriverSummary
);

router.get(
  '/:id',
  cacheMiddleware(CACHE_TTLS.DRIVERS, 'driver-detail'),
  getDriverById
);

// ── Write routes ─────────────────────────────────────────────────────────────
router.post(
  '/',
  writeLimiter, onlyFleetManager,
  createDriverRules, validate,
  createDriver
);

router.put(
  '/:id',
  writeLimiter, onlyFleetManager,
  updateDriverRules, validate,
  updateDriver
);

router.patch(
  '/:id/status',
  writeLimiter, onlyFleetManager,
  updateDriverStatus
);

// Safety score — Safety Officer OR Fleet Manager
router.patch(
  '/:id/safety-score',
  writeLimiter,
  authorize(roles.FLEET_MANAGER, roles.SAFETY_OFFICER),
  updateSafetyScore
);

router.delete(
  '/:id',
  writeLimiter, onlyFleetManager,
  deleteDriver
);

module.exports = router;
