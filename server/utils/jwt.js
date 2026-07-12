/**
 * TransitOps — JWT Token Utilities
 * Generate, verify, and manage access + refresh tokens
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const logger = require('../config/logger');

// ─────────────────────────────────────────────
// Token Generation
// ─────────────────────────────────────────────

/**
 * Generate a short-lived access token (JWT)
 * @param {object} payload - { id, role }
 * @returns {string} signed JWT
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: 'transitops-api',
    audience: 'transitops-client',
  });
};

/**
 * Generate a long-lived refresh token (JWT)
 * @param {object} payload - { id }
 * @returns {string} signed JWT
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: 'transitops-api',
    audience: 'transitops-client',
  });
};

/**
 * Generate both tokens at once
 * @param {User} user - Mongoose user document
 * @returns {{ accessToken, refreshToken }}
 */
const generateTokenPair = (user) => {
  const payload = { id: user._id.toString(), role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ id: user._id.toString() });
  return { accessToken, refreshToken };
};

// ─────────────────────────────────────────────
// Token Verification
// ─────────────────────────────────────────────

/**
 * Verify an access token
 * @param {string} token
 * @returns {object} decoded payload
 * @throws JWT errors (caught by global error handler)
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: 'transitops-api',
    audience: 'transitops-client',
  });
};

/**
 * Verify a refresh token
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: 'transitops-api',
    audience: 'transitops-client',
  });
};

// ─────────────────────────────────────────────
// Refresh Token Hashing (stored in DB)
// Storing only a hash means even if DB is compromised,
// the raw refresh token cannot be used.
// ─────────────────────────────────────────────

/**
 * Hash a refresh token for DB storage
 * @param {string} token
 * @returns {string} bcrypt hash
 */
const hashRefreshToken = async (token) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(token, salt);
};

/**
 * Compare a raw refresh token with a stored hash
 * @param {string} token
 * @param {string} hash
 * @returns {boolean}
 */
const compareRefreshToken = async (token, hash) => {
  return bcrypt.compare(token, hash);
};

// ─────────────────────────────────────────────
// Cookie Options (for refresh token)
// ─────────────────────────────────────────────
const refreshCookieOptions = {
  httpOnly: true,                         // Not accessible via JS
  secure: env.isProd,                     // HTTPS only in production
  sameSite: env.isProd ? 'strict' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,      // 30 days in ms
  path: '/api/auth',                      // Only sent to auth routes
};

/**
 * Extract token from Authorization header or cookie
 * @param {Request} req
 * @returns {string|null}
 */
const extractToken = (req) => {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  hashRefreshToken,
  compareRefreshToken,
  refreshCookieOptions,
  extractToken,
};
