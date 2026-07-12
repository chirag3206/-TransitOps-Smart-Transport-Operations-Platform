/**
 * TransitOps — Caching Middleware (node-cache)
 * Local in-memory cache with TTL support — no external dependencies
 *
 * Implements the Cache-Aside pattern:
 *   1. Check cache → if HIT, return immediately
 *   2. If MISS, hit database, store result in cache, return
 *   3. On mutations (POST/PUT/DELETE), invalidate relevant cache keys
 */
const NodeCache = require('node-cache');
const env = require('../config/env');
const logger = require('../config/logger');

// ─────────────────────────────────────────────
// Cache Instance
// ─────────────────────────────────────────────
const cache = new NodeCache({
  stdTTL: env.CACHE_TTL,          // Default TTL: 300s (5 min)
  checkperiod: 120,               // Cleanup expired keys every 2 min
  useClones: false,               // Don't clone objects on get/set (perf)
  deleteOnExpire: true,
  maxKeys: 1000,                  // Max 1000 cache entries
});

// Log cache stats in dev mode
cache.on('set', (key) => {
  if (env.isDev) logger.debug(`[Cache] SET ${key}`);
});
cache.on('del', (key) => {
  if (env.isDev) logger.debug(`[Cache] DEL ${key}`);
});
cache.on('expired', (key) => {
  if (env.isDev) logger.debug(`[Cache] EXPIRED ${key}`);
});

// ─────────────────────────────────────────────
// Cache Key Builder
// Builds consistent keys from request URL + optional user context
// ─────────────────────────────────────────────
const buildCacheKey = (req, prefix = '') => {
  const url = req.originalUrl || req.url;
  const base = `${prefix}${url}`;
  // Optionally scope to user role for RBAC-aware caching
  const role = req.user?.role || 'public';
  return `${role}:${base}`;
};

// ─────────────────────────────────────────────
// Cache Middleware Factory
// Creates a middleware that caches GET responses for `ttl` seconds
// ─────────────────────────────────────────────
const cacheMiddleware = (ttl = env.CACHE_TTL, prefix = '') => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();

    const key = buildCacheKey(req, prefix);
    const cached = cache.get(key);

    if (cached !== undefined) {
      logger.debug(`[Cache] HIT  ${key}`);
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    logger.debug(`[Cache] MISS ${key}`);
    res.setHeader('X-Cache', 'MISS');

    // Intercept res.json to store in cache before sending
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.success !== false) {
        cache.set(key, body, ttl);
      }
      return originalJson(body);
    };

    next();
  };
};

// ─────────────────────────────────────────────
// Cache Invalidation Helpers
// Call these after mutations to keep cache fresh
// ─────────────────────────────────────────────

/**
 * Invalidate all keys matching a prefix/pattern
 * @param {string} prefix - e.g. 'vehicles', 'drivers'
 */
const invalidateByPrefix = (prefix) => {
  const keys = cache.keys();
  const toDelete = keys.filter((k) => k.includes(prefix));
  if (toDelete.length > 0) {
    cache.del(toDelete);
    logger.debug(`[Cache] Invalidated ${toDelete.length} keys matching "${prefix}"`);
  }
};

/**
 * Invalidate a specific key
 * @param {string} key
 */
const invalidateKey = (key) => {
  cache.del(key);
};

/**
 * Flush the entire cache (use sparingly)
 */
const flushAll = () => {
  cache.flushAll();
  logger.info('[Cache] Full cache flush');
};

/**
 * Get cache statistics
 */
const getCacheStats = () => cache.getStats();

// ─────────────────────────────────────────────
// Pre-configured TTL constants per resource
// ─────────────────────────────────────────────
const CACHE_TTLS = {
  DEFAULT:     300,  // 5 min — generic fallback
  DASHBOARD:    60,   // 1 min — KPIs update frequently
  VEHICLES:    120,   // 2 min — vehicle list changes on dispatch
  DRIVERS:     120,   // 2 min — driver list changes on dispatch
  TRIPS:        60,   // 1 min — trips are time-sensitive
  MAINTENANCE:  180,  // 3 min — maintenance logs change less often
  FUEL_LOGS:   300,   // 5 min — fuel logs rarely change
  EXPENSES:    300,   // 5 min — expenses rarely change
  ANALYTICS:   120,   // 2 min — reports are expensive, cache aggressively
};

module.exports = {
  cache,
  cacheMiddleware,
  buildCacheKey,
  invalidateByPrefix,
  invalidateKey,
  flushAll,
  getCacheStats,
  CACHE_TTLS,
};
