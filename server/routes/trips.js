/**
 * TransitOps — Trip Routes
 *
 * GET    /api/trips                  - List all trips (filter by status/vehicle/driver)
 * GET    /api/trips/active           - Active (Dispatched) trips only
 * GET    /api/trips/:id              - Single trip (fully populated)
 * POST   /api/trips                  - Create Draft trip
 * PUT    /api/trips/:id              - Update Draft trip only
 * DELETE /api/trips/:id              - Delete Draft trip only
 * POST   /api/trips/:id/dispatch     - Dispatch trip (Draft → Dispatched)
 * POST   /api/trips/:id/complete     - Complete trip (Dispatched → Completed)
 * POST   /api/trips/:id/cancel       - Cancel trip (Draft/Dispatched → Cancelled)
 *
 * RBAC:
 *   - Create / dispatch / complete / cancel: fleet_manager OR driver
 *   - Update / delete: fleet_manager only
 *   - Read: all authenticated roles
 */
const router = require('express').Router();
const {
  getTrips, getActiveTrips, getTripById,
  createTrip, updateTrip, deleteTrip,
  dispatchTrip, completeTrip, cancelTrip,
} = require('../controllers/trip.controller');

const { protect, onlyFleetManager, fleetOrDriver, allRoles } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiter');
const { cacheMiddleware, CACHE_TTLS } = require('../middleware/cache');
const {
  validate,
  createTripRules, dispatchTripRules, completeTripRules,
  cancelTripRules, listTripRules,
} = require('../validators/trip.validator');

// All routes require JWT
router.use(protect);

// ── Read routes (cached, all roles) ─────────────────────────────────────────
router.get(
  '/',
  listTripRules, validate,
  cacheMiddleware(CACHE_TTLS.TRIPS, 'trips'),
  getTrips
);

router.get(
  '/active',
  cacheMiddleware(CACHE_TTLS.TRIPS, 'trips-active'),
  getActiveTrips
);

router.get(
  '/:id',
  cacheMiddleware(CACHE_TTLS.TRIPS, 'trip-detail'),
  getTripById
);

// ── Create (fleet_manager or driver) ────────────────────────────────────────
router.post(
  '/',
  writeLimiter, fleetOrDriver,
  createTripRules, validate,
  createTrip
);

// ── Lifecycle actions (fleet_manager or driver) ──────────────────────────────
router.post('/:id/dispatch', writeLimiter, fleetOrDriver, dispatchTripRules, validate, dispatchTrip);
router.post('/:id/complete', writeLimiter, fleetOrDriver, completeTripRules, validate, completeTrip);
router.post('/:id/cancel',   writeLimiter, fleetOrDriver, cancelTripRules,   validate, cancelTrip);

// ── Edit / delete (fleet_manager only) ──────────────────────────────────────
router.put(
  '/:id',
  writeLimiter, onlyFleetManager,
  createTripRules, validate,
  updateTrip
);

router.delete('/:id', writeLimiter, onlyFleetManager, deleteTrip);

module.exports = router;
