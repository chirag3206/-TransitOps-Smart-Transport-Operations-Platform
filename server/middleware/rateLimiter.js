/**
 * TransitOps — Rate Limiting Middleware
 * Protects API endpoints from abuse using express-rate-limit
 * Uses in-memory store (sufficient for single-instance; swap to Redis store for multi-instance prod)
 */
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const logger = require('../config/logger');

/**
 * Generic limiter factory
 */
const createLimiter = ({ windowMs, max, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7', // Send RateLimit headers per RFC 6585
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res, next, options) => {
      logger.warn(
        `Rate limit exceeded | IP: ${req.ip} | Route: ${req.method} ${req.originalUrl}`
      );
      res.status(options.statusCode).json({
        success: false,
        message,
        retryAfter: Math.ceil(options.windowMs / 1000 / 60), // minutes
      });
    },
  });

// ─────────────────────────────────────────────
// 1. Global Limiter — applies to all /api/* routes
//    Default: 100 req / 15 min per IP
// ─────────────────────────────────────────────
const globalLimiter = createLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,     // 15 min
  max: env.RATE_LIMIT_MAX_REQUESTS,       // 100 requests
  message: 'Too many requests from this IP. Please try again later.',
});

// ─────────────────────────────────────────────
// 2. Auth Limiter — strict limit on login/register
//    Prevents brute-force attacks on credentials
// ─────────────────────────────────────────────
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,              // 15 min window
  max: 100,                                // 10 attempts max
  message: 'Too many login attempts. Please wait 15 minutes before trying again.',
  skipSuccessfulRequests: true,           // Only count failed attempts
});

// ─────────────────────────────────────────────
// 3. Write Limiter — for POST/PUT/DELETE routes
//    Prevents rapid creation/modification of records
// ─────────────────────────────────────────────
const writeLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,              // 10 min window
  max: 600,                                // 60 write ops per 10 min
  message: 'Too many write operations. Please slow down and try again.',
});

// ─────────────────────────────────────────────
// 4. Analytics Limiter — for expensive report queries
//    Reports can be computationally expensive
// ─────────────────────────────────────────────
const analyticsLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,              // 5 min window
  max: 300,                               // 30 analytics requests per 5 min
  message: 'Too many analytics requests. Please wait a moment before refreshing.',
});

module.exports = {
  globalLimiter,
  authLimiter,
  writeLimiter,
  analyticsLimiter,
};
