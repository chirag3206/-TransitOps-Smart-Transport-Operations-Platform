/**
 * TransitOps — Maintenance Routes
 *
 * GET    /api/maintenance           - List records (filter by vehicle/status/type)
 * GET    /api/maintenance/:id       - Single record (populated)
 * POST   /api/maintenance           - Open new maintenance (vehicle → In Shop)
 * POST   /api/maintenance/:id/close - Close record (vehicle → Available)
 * PUT    /api/maintenance/:id       - Update Active record only
 * DELETE /api/maintenance/:id       - Delete Closed record only
 */
const router = require('express').Router();
const {
  getMaintenanceRecords, getMaintenanceById,
  createMaintenance, closeMaintenance,
  updateMaintenance, deleteMaintenance,
} = require('../controllers/maintenance.controller');

const { protect, onlyFleetManager } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiter');
const { cacheMiddleware, CACHE_TTLS } = require('../middleware/cache');
const {
  validate, createMaintenanceRules, closeMaintenanceRules,
  updateMaintenanceRules, listMaintenanceRules,
} = require('../validators/maintenance.validator');

router.use(protect);

router.get('/', listMaintenanceRules, validate, cacheMiddleware(CACHE_TTLS.MAINTENANCE, 'maintenance'), getMaintenanceRecords);
router.get('/:id', cacheMiddleware(CACHE_TTLS.MAINTENANCE, 'maintenance-detail'), getMaintenanceById);

router.post('/', writeLimiter, onlyFleetManager, createMaintenanceRules, validate, createMaintenance);
router.post('/:id/close', writeLimiter, onlyFleetManager, closeMaintenanceRules, validate, closeMaintenance);
router.put('/:id', writeLimiter, onlyFleetManager, updateMaintenanceRules, validate, updateMaintenance);
router.delete('/:id', writeLimiter, onlyFleetManager, deleteMaintenance);

module.exports = router;
