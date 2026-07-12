/**
 * TransitOps — Security Middleware Configuration
 * Centralizes Helmet, CORS, sanitization, and HPP policies
 */
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const env = require('../config/env');
const logger = require('../config/logger');

// ─────────────────────────────────────────────
// 1. Helmet — Secure HTTP Headers
// ─────────────────────────────────────────────
const helmetMiddleware = helmet({
  // Content Security Policy
  contentSecurityPolicy: env.isProd
    ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", env.CLIENT_URL],
        },
      }
    : false, // Disable CSP in dev for easier debugging

  // Cross-Origin Policies
  crossOriginEmbedderPolicy: false,        // Allow embedding resources
  crossOriginResourcePolicy: { policy: 'cross-origin' },

  // Prevent clickjacking
  frameguard: { action: 'deny' },

  // Hide Express fingerprint
  hidePoweredBy: true,

  // Force HTTPS in production
  hsts: env.isProd
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,

  // Prevent MIME type sniffing
  noSniff: true,

  // Prevent IE from opening downloads in site context
  ieNoOpen: true,

  // Referrer policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // DNS prefetch control
  dnsPrefetchControl: { allow: false },
});

// ─────────────────────────────────────────────
// 2. CORS Policy
// ─────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
    }
  },
  credentials: true,                        // Allow cookies & auth headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'X-Cache'],
  maxAge: 600,                              // Preflight cache: 10 min
};

const corsMiddleware = cors(corsOptions);

// ─────────────────────────────────────────────
// 3. MongoDB Injection Sanitization
// Strips $ and . from req.body, req.params, req.query
// Prevents NoSQL injection attacks like { $gt: '' }
// ─────────────────────────────────────────────
const sanitizeMiddleware = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`[Security] Sanitized key "${key}" from ${req.method} ${req.originalUrl}`);
  },
});

// ─────────────────────────────────────────────
// 4. HTTP Parameter Pollution Protection
// Prevents attacks like ?status=Available&status=On+Trip
// ─────────────────────────────────────────────
const hppMiddleware = hpp({
  whitelist: [
    // Allow arrays for these filter params
    'status', 'type', 'region', 'category',
  ],
});

// ─────────────────────────────────────────────
// 5. Request Size Guard (additional check beyond express.json limit)
// ─────────────────────────────────────────────
const requestSizeGuard = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'], 10);
  const MAX_BYTES = 10 * 1024 * 1024; // 10MB
  if (contentLength && contentLength > MAX_BYTES) {
    return res.status(413).json({
      success: false,
      message: 'Request entity too large. Maximum allowed size is 10MB.',
    });
  }
  next();
};

module.exports = {
  helmetMiddleware,
  corsMiddleware,
  sanitizeMiddleware,
  hppMiddleware,
  requestSizeGuard,
};
