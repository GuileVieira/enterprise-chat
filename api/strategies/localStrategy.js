const bcrypt = require('bcryptjs');
const { logger, runAsSystem } = require('@librechat/data-schemas');
const { errorsToString } = require('librechat-data-provider');
const { Strategy: PassportLocalStrategy } = require('passport-local');
const { isEnabled, checkEmailConfig, comparePassword } = require('@librechat/api');
const { findUser, updateUser } = require('~/models');
const { loginSchema } = require('./validators');

// Unix timestamp for 2024-06-07 15:20:18 Eastern Time
const verificationEnabledTimestamp = 1717788018;

async function validateLoginRequest(req) {
  const { error } = loginSchema.safeParse(req.body);
  return error ? errorsToString(error.errors) : null;
}

async function passportLogin(req, email, password, done) {
  try {
    const validationError = await validateLoginRequest(req);
    if (validationError) {
      logError('Passport Local Strategy - Validation Error', { reqBody: req.body });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: validationError });
    }

    // Login runs before tenantContextMiddleware can set ALS context, so we look
    // up users across all tenants under SYSTEM context. Downstream auth steps
    // re-establish the proper tenantId from req.user.
    const result = await runAsSystem(async () => {
      const user = await findUser({ email: email.trim() }, '+password');
      if (!user) {
        return { user: null, info: { message: 'Email does not exist.' }, reason: 'not-found' };
      }
      if (!user.password) {
        return { user: null, info: { message: 'Email does not exist.' }, reason: 'no-password' };
      }

      const isMatch = await comparePassword(user, password, { compare: bcrypt.compare });
      if (!isMatch) {
        return { user: null, info: { message: 'Incorrect password.' }, reason: 'wrong-password' };
      }

      const emailEnabled = checkEmailConfig();
      const userCreatedAtTimestamp = Math.floor(new Date(user.createdAt).getTime() / 1000);

      if (
        !emailEnabled &&
        !user.emailVerified &&
        userCreatedAtTimestamp < verificationEnabledTimestamp
      ) {
        await updateUser(user._id, { emailVerified: true });
        user.emailVerified = true;
      }

      const unverifiedAllowed = isEnabled(process.env.ALLOW_UNVERIFIED_EMAIL_LOGIN);
      if (user.expiresAt && unverifiedAllowed) {
        await updateUser(user._id, {});
      }

      if (!user.emailVerified && !unverifiedAllowed) {
        return { user, info: { message: 'Email not verified.' }, reason: 'unverified' };
      }

      return { user, info: null, reason: 'ok' };
    });

    if (result.reason === 'not-found' || result.reason === 'no-password') {
      logError(`Passport Local Strategy - ${result.reason}`, { email });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, result.info);
    }
    if (result.reason === 'wrong-password') {
      logError('Passport Local Strategy - Password does not match', { isMatch: false });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, false, result.info);
    }
    if (result.reason === 'unverified') {
      logError('Passport Local Strategy - Email not verified', { email });
      logger.error(`[Login] [Login failed] [Username: ${email}] [Request-IP: ${req.ip}]`);
      return done(null, result.user, result.info);
    }

    logger.info(`[Login] [Login successful] [Username: ${email}] [Request-IP: ${req.ip}]`);
    return done(null, result.user);
  } catch (err) {
    return done(err);
  }
}

function logError(title, parameters) {
  const entries = Object.entries(parameters).map(([name, value]) => ({ name, value }));
  logger.error(title, { parameters: entries });
}

module.exports = () =>
  new PassportLocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      session: false,
      passReqToCallback: true,
    },
    passportLogin,
  );
