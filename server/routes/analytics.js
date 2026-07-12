/**
 * TransitOps — Analytics Routes
 *
 * All routes are fleet_manager only and aggressively cached.
 *
 * GET /api/analytics/dashboard         - Live KPI summary (fleet health, trips, revenue)
 * GET /api/analytics/fleet-utilization - Vehicle status + per-vehicle trip stats
 * GET /api/analytics/trip-performance  - Completion rate, top routes, top drivers
 * GET /api/analytics/cost-breakdown    - Fuel / maintenance / expense breakdown
 * GET /api/analytics/driver-stats      - Driver leaderboard + safety buckets + license alerts
 * GET /api/analytics/monthly-trend     - Rolling N-month revenue, cost, trip trend
 */
const router = require('express').Router();
const {
  getDashboard,
  getFleetUtilization,
  getTripPerformance,
  getCostBreakdown,
  getDriverStats,
  getMonthlyTrend,
} = require('../controllers/analytics.controller');

const { protect, onlyFleetManager } = require('../middleware/auth');
const { cacheMiddleware, CACHE_TTLS } = require('../middleware/cache');

// All analytics require authentication
router.use(protect);

// Dashboard KPIs — short TTL (live data) (Accessible by driver and fleet_manager)
router.get('/dashboard',         cacheMiddleware(CACHE_TTLS.DASHBOARD,  'analytics-dashboard'),   getDashboard);

// Fleet utilization — medium TTL
router.get('/fleet-utilization', onlyFleetManager, cacheMiddleware(CACHE_TTLS.ANALYTICS,  'analytics-fleet'),       getFleetUtilization);

// Trip performance
router.get('/trip-performance',  onlyFleetManager, cacheMiddleware(CACHE_TTLS.ANALYTICS,  'analytics-trips'),       getTripPerformance);

// Cost breakdown
router.get('/cost-breakdown',    onlyFleetManager, cacheMiddleware(CACHE_TTLS.ANALYTICS,  'analytics-costs'),       getCostBreakdown);

// Driver statistics
router.get('/driver-stats',      onlyFleetManager, cacheMiddleware(CACHE_TTLS.ANALYTICS,  'analytics-drivers'),     getDriverStats);

// Monthly trend — longer TTL (historical data changes slowly)
router.get('/monthly-trend',     onlyFleetManager, cacheMiddleware(CACHE_TTLS.ANALYTICS,  'analytics-trend'),       getMonthlyTrend);

module.exports = router;
