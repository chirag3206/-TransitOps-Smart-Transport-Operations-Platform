/**
 * TransitOps — Global Error Handler Middleware
 * Catches all errors and returns consistent JSON responses
 */
const logger = require('../config/logger');
const env = require('../config/env');

/**
 * Custom API error class for structured error responses
 */
class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message } = err;

  // Log the error
  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.path} >> ${err.stack || err.message}`);
  } else {
    logger.warn(`[${req.method}] ${req.path} >> ${statusCode}: ${message}`);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(statusCode).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    message = `Duplicate value: '${value}' already exists for field '${field}'`;
    return res.status(statusCode).json({
      success: false,
      message,
      errors: [{ field, message }],
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please log in again.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your token has expired. Please log in again.';
  }

  // Default response
  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || [],
    // Include stack trace only in development
    ...(env.isDev && err.stack ? { stack: err.stack } : {}),
  });
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

module.exports = { errorHandler, notFoundHandler, ApiError };
