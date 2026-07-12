/**
 * TransitOps — Passport.js Configuration
 * Configures three strategies: Local, JWT, Google OAuth 2.0
 */
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const User = require('../models/User');
const env = require('./env');
const logger = require('./logger');
const { extractToken } = require('../utils/jwt');

// ─────────────────────────────────────────────
// Strategy 1: Local (Email + Password)
// Used by: POST /api/auth/login
// ─────────────────────────────────────────────
passport.use(
  'local',
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: false,
    },
    async (email, password, done) => {
      try {
        // Fetch user with password field (normally excluded)
        const user = await User.findByEmailWithPassword(email);

        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        if (!user.isActive) {
          return done(null, false, { message: 'Account is deactivated. Contact admin.' });
        }

        if (user.authProvider === 'google' && !user.password) {
          return done(null, false, {
            message: 'This account uses Google Sign-In. Please login with Google.',
          });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
      } catch (err) {
        logger.error(`Passport Local Error: ${err.message}`);
        return done(err);
      }
    }
  )
);

// ─────────────────────────────────────────────
// Strategy 2: JWT (Bearer Token)
// Used by: all protected routes
// ─────────────────────────────────────────────
passport.use(
  'jwt',
  new JwtStrategy(
    {
      // Custom extractor: check header first, then cookie
      jwtFromRequest: (req) => extractToken(req),
      secretOrKey: env.JWT_SECRET,
      issuer: 'transitops-api',
      audience: 'transitops-client',
      passReqToCallback: false,
    },
    async (payload, done) => {
      try {
        const user = await User.findById(payload.id).select('-refreshTokenHash');

        if (!user) {
          return done(null, false, { message: 'User not found' });
        }

        if (!user.isActive) {
          return done(null, false, { message: 'Account is deactivated' });
        }

        // Check if password was changed after token was issued
        if (user.passwordChangedAfter(payload.iat)) {
          return done(null, false, { message: 'Password changed. Please log in again.' });
        }

        return done(null, user);
      } catch (err) {
        logger.error(`Passport JWT Error: ${err.message}`);
        return done(err);
      }
    }
  )
);

// ─────────────────────────────────────────────
// Strategy 3: Google OAuth 2.0
// Used by: GET /api/auth/google
// ─────────────────────────────────────────────
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const avatar = profile.photos?.[0]?.value;
          const name = profile.displayName || profile.name?.givenName || 'User';

          if (!email) {
            return done(null, false, { message: 'No email returned from Google' });
          }

          // Check if user already exists (by googleId or email)
          let user = await User.findOne({
            $or: [{ googleId: profile.id }, { email }],
          });

          if (user) {
            // Existing user — update Google info if needed
            if (!user.googleId) {
              user.googleId = profile.id;
              user.authProvider = 'google';
            }
            if (avatar && !user.avatar) user.avatar = avatar;
            user.lastLogin = new Date();
            await user.save();
          } else {
            // New user — create with google provider
            user = await User.create({
              name,
              email,
              googleId: profile.id,
              avatar,
              authProvider: 'google',
              isEmailVerified: true, // Google emails are verified
              role: 'driver',        // Default role; admin can promote
            });
            logger.info(`New user via Google OAuth: ${email}`);
          }

          return done(null, user);
        } catch (err) {
          logger.error(`Passport Google Error: ${err.message}`);
          return done(err);
        }
      }
    )
  );
} else {
  logger.warn('Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET missing). Google login disabled.');
}

// Passport serialization (for session-less JWT, these are minimal)
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
