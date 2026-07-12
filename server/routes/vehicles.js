/**
 * TransitOps — Vehicle Routes
 *
 * GET    /api/vehicles              - List all vehicles (search, filter, sort, paginate)
 * GET    /api/vehicles/available    - Dispatch pool (Available status only)
 * GET    /api/vehicles/:id          - Get single vehicle
 * GET    /api/vehicles/:id/summary  - Vehicle summary (trips, costs, ROI)
 * POST   /api/vehicles              - Register new vehicle
 * PUT    /api/vehicles/:id          - Update vehicle
 * PATCH  /api/vehicles/:id/status   - Update status only
 * DELETE /api/vehicles/:id          - Delete (or retire) vehicle
 *
 * Auth: All routes require JWT (protect)
 * RBAC: Write operations restricted to fleet_manager
 * Cache: GET routes cached, mutations bust cache
 */
const router = require('express').Router();
const {
  getVehicles, getAvailableVehicles, getVehicleById,
  createVehicle, updateVehicle, deleteVehicle,
  updateVehicleStatus, getVehicleSummary,
} = require('../controllers/vehicle.controller');

const { protect, onlyFleetManager, allRoles } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiter');
const { cacheMiddleware, CACHE_TTLS } = require('../middleware/cache');
const {
  validate, createVehicleRules, updateVehicleRules, listVehicleRules,
} = require('../validators/vehicle.validator');

// All vehicle routes require authentication
router.use(protect);

// ── Read routes (cached, any authenticated role) ────────────────────────────
router.get(
  '/',
  listVehicleRules,
  validate,
  cacheMiddleware(CACHE_TTLS.VEHICLES, 'vehicles'),
  getVehicles
);

router.get(
  '/available',
  cacheMiddleware(CACHE_TTLS.VEHICLES, 'vehicles-available'),
  getAvailableVehicles
);

router.get(
  '/:id/summary',
  cacheMiddleware(CACHE_TTLS.VEHICLES, 'vehicle-summary'),
  getVehicleSummary
);

router.get(
  '/:id',
  cacheMiddleware(CACHE_TTLS.VEHICLES, 'vehicle-detail'),
  getVehicleById
);

// ── Write routes (rate limited, fleet_manager only) ─────────────────────────
router.post(
  '/',
  writeLimiter,
  onlyFleetManager,
  createVehicleRules,
  validate,
  createVehicle
);

router.put(
  '/:id',
  writeLimiter,
  onlyFleetManager,
  updateVehicleRules,
  validate,
  updateVehicle
);

router.patch(
  '/:id/status',
  writeLimiter,
  onlyFleetManager,
  updateVehicleStatus
);

router.delete(
  '/:id',
  writeLimiter,
  onlyFleetManager,
  deleteVehicle
);

module.exports = router;
