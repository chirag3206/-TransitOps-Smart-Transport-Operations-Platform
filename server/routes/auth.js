/**
 * TransitOps — Auth Routes
 * POST   /api/auth/register
 * POST   /api/auth/login
 * POST   /api/auth/refresh
 * POST   /api/auth/logout
 * GET    /api/auth/me
 * PUT    /api/auth/me
 * PUT    /api/auth/change-password
 * GET    /api/auth/google
 * GET    /api/auth/google/callback
 */
const router = require('express').Router();
const passport = require('passport');

const {
  register, login, googleCallback,
  refreshToken, logout, getMe, updateMe, changePassword,
} = require('../controllers/auth.controller');

const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  validate, registerRules, loginRules, changePasswordRules,
} = require('../validators/auth.validator');

// ── Public routes (with strict rate limiting) ──────────────────────────────
router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login',    authLimiter, loginRules,    validate, login);
router.post('/refresh',  refreshToken);

// ── Google OAuth ───────────────────────────────────────────────────────────
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=google_failed`,
  }),
  googleCallback
);

// ── Protected routes ───────────────────────────────────────────────────────
router.post('/logout',           protect, logout);
router.get('/me',                protect, getMe);
router.put('/me',                protect, updateMe);
router.put('/change-password',   protect, changePasswordRules, validate, changePassword);

module.exports = router;
