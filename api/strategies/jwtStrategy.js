const { logger, runAsSystem } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { getUserById, updateUser } = require('~/models');

// JWT strategy
const jwtLogin = () =>
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    },
    async (payload, done) => {
      try {
        // Auth runs before tenantContextMiddleware: look up the user across all
        // tenants under SYSTEM context, then let downstream middleware scope the
        // request to req.user.tenantId.
        const user = await runAsSystem(async () => {
          const u = await getUserById(payload?.id, '-password -__v -totpSecret -backupCodes');
          if (u && !u.role) {
            u.role = SystemRoles.USER;
            await updateUser(u._id.toString(), { role: u.role });
          }
          return u;
        });
        if (user) {
          user.id = user._id.toString();
          done(null, user);
        } else {
          logger.warn('[jwtLogin] JwtStrategy => no user found: ' + payload?.id);
          done(null, false);
        }
      } catch (err) {
        done(err, false);
      }
    },
  );

module.exports = jwtLogin;
