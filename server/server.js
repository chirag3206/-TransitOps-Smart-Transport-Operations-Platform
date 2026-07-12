/**
 * TransitOps — Express Server Entry Point
 * Configures and starts the Express application with all middleware
 */

// Must be first — patches async errors to go through Express error handling
require('express-async-errors');

const express = require('express');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const passport = require('passport');

// Initialize Passport strategies
require('./config/passport');

const env = require('./config/env');
const connectDB = require('./config/db');
const logger = require('./config/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { helmetMiddleware, corsMiddleware, sanitizeMiddleware, hppMiddleware, requestSizeGuard } = require('./middleware/security');
const { globalLimiter } = require('./middleware/rateLimiter');

// ─────────────────────────────────────────────
// Initialize Express app
// ─────────────────────────────────────────────
const app = express();

// ─────────────────────────────────────────────
// Security Middleware (applied first)
// ─────────────────────────────────────────────
app.use(helmetMiddleware);          // Secure HTTP headers (14 policies)
app.use(corsMiddleware);            // CORS with origin whitelist
app.set('trust proxy', 1);         // Trust first proxy (needed for rate limiting behind nginx/load balancer)

// ─────────────────────────────────────────────
// Rate Limiting — Global (all /api/* routes)
// ─────────────────────────────────────────────
app.use('/api/', globalLimiter);

// ─────────────────────────────────────────────
// General Middleware
// ─────────────────────────────────────────────
app.use(compression());                                 // Gzip responses
app.use(express.json({ limit: '10mb' }));               // JSON body parsing
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL-encoded bodies
app.use(requestSizeGuard);                              // Extra size check
app.use(sanitizeMiddleware);                            // NoSQL injection prevention
app.use(hppMiddleware);                                 // HTTP param pollution prevention

// Cookie parsing (needed for refresh token cookie)
app.use(cookieParser());

// Passport initialization (JWT is stateless — no session needed)
app.use(passport.initialize());

// HTTP request logging (Morgan → Winston)
const morganFormat = env.isDev ? 'dev' : 'combined';
app.use(
  morgan(morganFormat, {
    stream: logger.stream,
    skip: (req) => req.url === '/api/health',
  })
);

// ─────────────────────────────────────────────
// Health Check (no auth, no rate limit)
// ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const { getCacheStats } = require('./middleware/cache');
  res.status(200).json({
    success: true,
    message: 'TransitOps API is running',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    cache: getCacheStats(),
  });
});

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/vehicles',    require('./routes/vehicles'));
app.use('/api/drivers',     require('./routes/drivers'));
app.use('/api/trips',       require('./routes/trips'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/fuel-logs',   require('./routes/fuelLogs'));
app.use('/api/expenses',    require('./routes/expenses'));
app.use('/api/analytics',   require('./routes/analytics'));

// ─────────────────────────────────────────────
// Error Handling (must be LAST)
// ─────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────
const startServer = async () => {
  try {
    await connectDB();

    const { flushAll } = require('./middleware/cache');
    flushAll();

    const server = app.listen(env.PORT, () => {
      logger.info(`🚛 TransitOps API running on port ${env.PORT} [${env.NODE_ENV}]`);
      logger.info(`📡 Health check: http://localhost:${env.PORT}/api/health`);
      if (env.isDev) {
        logger.info(`🔧 Dev mode: CORS allows ${env.CLIENT_URL}`);
        logger.info(`🛡️  Rate limit: ${env.RATE_LIMIT_MAX_REQUESTS} req/${env.RATE_LIMIT_WINDOW_MS / 60000}min`);
        logger.info(`⚡ Cache: TTL=${env.CACHE_TTL}s, max 1000 keys`);
      }
    });

    process.on('unhandledRejection', (err) => {
      logger.error(`Unhandled Rejection: ${err.message}`);
      server.close(() => process.exit(1));
    });

    process.on('uncaughtException', (err) => {
      logger.error(`Uncaught Exception: ${err.message}`);
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();

module.exports = app;
