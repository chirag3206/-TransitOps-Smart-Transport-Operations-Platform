/**
 * TransitOps — FuelLog Routes
 *
 * GET    /api/fuel-logs         - List logs (filter by vehicle/trip/date)
 * GET    /api/fuel-logs/stats   - Aggregated stats per vehicle
 * GET    /api/fuel-logs/:id     - Single log
 * POST   /api/fuel-logs         - Create log (auto-computes totalCost)
 * PUT    /api/fuel-logs/:id     - Update log (recomputes cost diff)
 * DELETE /api/fuel-logs/:id     - Delete log (reverses vehicle totalFuelCost)
 */
const router = require('express').Router();
const {
  getFuelLogs, getFuelLogById,
  createFuelLog, updateFuelLog, deleteFuelLog,
  getFuelStats,
} = require('../controllers/fuelLog.controller');

const { protect, onlyFleetManager, fleetOrDriver } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiter');
const { cacheMiddleware, CACHE_TTLS } = require('../middleware/cache');
const { validate, createFuelLogRules, listFuelLogRules } = require('../validators/fuelExpense.validator');

router.use(protect);

router.get('/', listFuelLogRules, validate, cacheMiddleware(CACHE_TTLS.DEFAULT, 'fuel-logs'), getFuelLogs);
router.get('/stats', cacheMiddleware(CACHE_TTLS.ANALYTICS, 'fuel-stats'), getFuelStats);
router.get('/:id', cacheMiddleware(CACHE_TTLS.DEFAULT, 'fuel-log-detail'), getFuelLogById);

router.post('/', writeLimiter, fleetOrDriver, createFuelLogRules, validate, createFuelLog);
router.put('/:id', writeLimiter, onlyFleetManager, createFuelLogRules, validate, updateFuelLog);
router.delete('/:id', writeLimiter, onlyFleetManager, deleteFuelLog);

module.exports = router;
