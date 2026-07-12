/**
 * TransitOps — Auth Controller
 * Handles: register, login, Google callback, refresh token, logout, getMe, changePassword
 */
const passport = require('passport');
const User = require('../models/User');
const { ApiError } = require('../middleware/errorHandler');
const { sendSuccess } = require('../utils/apiResponse');
const {
  generateTokenPair,
  verifyRefreshToken,
  hashRefreshToken,
  compareRefreshToken,
  refreshCookieOptions,
} = require('../utils/jwt');
const env = require('../config/env');
const logger = require('../config/logger');

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
const register = async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // Check duplicate email
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return next(new ApiError(409, 'An account with this email already exists'));
  }

  const user = await User.create({ name, email, password, role });

  const { accessToken, refreshToken } = generateTokenPair(user);
  const hashedRefresh = await hashRefreshToken(refreshToken);
  user.refreshTokenHash = hashedRefresh;
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  logger.info(`New user registered: ${email} (${user.role})`);

  res.cookie('refreshToken', refreshToken, refreshCookieOptions);

  sendSuccess(res, 201, 'Account created successfully', {
    user: user.toSafeObject(),
    accessToken,
  });
};

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
const login = (req, res, next) => {
  passport.authenticate('local', { session: false }, async (err, user, info) => {
    if (err) return next(err);
    if (!user) return next(new ApiError(401, info?.message || 'Invalid credentials'));

    try {
      const { accessToken, refreshToken } = generateTokenPair(user);
      const hashedRefresh = await hashRefreshToken(refreshToken);

      user.refreshTokenHash = hashedRefresh;
      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      logger.info(`User logged in: ${user.email} (${user.role})`);

      res.cookie('refreshToken', refreshToken, refreshCookieOptions);

      sendSuccess(res, 200, 'Login successful', {
        user: user.toSafeObject(),
        accessToken,
      });
    } catch (error) {
      next(error);
    }
  })(req, res, next);
};

// ─────────────────────────────────────────────
// GET /api/auth/google/callback
// ─────────────────────────────────────────────
const googleCallback = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return next(new ApiError(401, 'Google authentication failed'));

    const { accessToken, refreshToken } = generateTokenPair(user);
    const hashedRefresh = await hashRefreshToken(refreshToken);

    user.refreshTokenHash = hashedRefresh;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    res.cookie('refreshToken', refreshToken, refreshCookieOptions);

    // Redirect to frontend with token in query param (client stores it)
    const redirectUrl = `${env.CLIENT_URL}/auth/callback?token=${accessToken}&role=${user.role}`;
    res.redirect(redirectUrl);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────
const refreshToken = async (req, res, next) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!token) {
    return next(new ApiError(401, 'Refresh token not provided'));
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    return next(new ApiError(401, 'Invalid or expired refresh token. Please log in again.'));
  }

  const user = await User.findById(decoded.id).select('+refreshTokenHash');
  if (!user || !user.refreshTokenHash) {
    return next(new ApiError(401, 'Session expired. Please log in again.'));
  }

  const isValid = await compareRefreshToken(token, user.refreshTokenHash);
  if (!isValid) {
    // Potential token reuse attack — invalidate all sessions
    user.refreshTokenHash = null;
    await user.save({ validateBeforeSave: false });
    logger.warn(`Refresh token reuse detected for user: ${user.email}`);
    return next(new ApiError(401, 'Session compromised. Please log in again.'));
  }

  // Issue new token pair (rotation)
  const { accessToken: newAccess, refreshToken: newRefresh } = generateTokenPair(user);
  const hashedRefresh = await hashRefreshToken(newRefresh);

  user.refreshTokenHash = hashedRefresh;
  await user.save({ validateBeforeSave: false });

  res.cookie('refreshToken', newRefresh, refreshCookieOptions);

  sendSuccess(res, 200, 'Token refreshed', { accessToken: newAccess });
};

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    if (req.user) {
      req.user.refreshTokenHash = null;
      await req.user.save({ validateBeforeSave: false });
    }

    res.clearCookie('refreshToken', { path: '/api/auth' });

    sendSuccess(res, 200, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
const getMe = async (req, res) => {
  sendSuccess(res, 200, 'User profile retrieved', req.user.toSafeObject());
};

// ─────────────────────────────────────────────
// PUT /api/auth/me
// ─────────────────────────────────────────────
const updateMe = async (req, res, next) => {
  const { name, avatar } = req.body;

  // Prevent role escalation via this endpoint
  const allowedUpdates = {};
  if (name) allowedUpdates.name = name.trim();
  if (avatar) allowedUpdates.avatar = avatar;

  const user = await User.findByIdAndUpdate(req.user._id, allowedUpdates, {
    new: true,
    runValidators: true,
  });

  sendSuccess(res, 200, 'Profile updated', user.toSafeObject());
};

// ─────────────────────────────────────────────
// PUT /api/auth/change-password
// ─────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findByEmailWithPassword(req.user.email);

  if (user.authProvider === 'google') {
    return next(new ApiError(400, 'Google OAuth users cannot change password here'));
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return next(new ApiError(401, 'Current password is incorrect'));
  }

  user.password = newPassword;
  user.refreshTokenHash = null; // Invalidate all sessions on password change
  await user.save();

  logger.info(`Password changed for user: ${user.email}`);

  sendSuccess(res, 200, 'Password changed successfully. Please log in again.');
};

module.exports = {
  register,
  login,
  googleCallback,
  refreshToken,
  logout,
  getMe,
  updateMe,
  changePassword,
};
