const cookies = require('cookie');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { logger } = require('@librechat/data-schemas');
const {
  isEnabled,
  tenantContextMiddleware,
  maybeRefreshCloudFrontAuthCookiesMiddleware,
} = require('@librechat/api');

const hasPassportStrategy = (strategy) =>
  typeof passport._strategy === 'function' && passport._strategy(strategy) != null;

const getValidOpenIdReuseUserId = (parsedCookies) => {
  const openidUserId = parsedCookies.openid_user_id;
  if (!openidUserId || !process.env.JWT_REFRESH_SECRET) {
    return null;
  }

  try {
    const payload = jwt.verify(openidUserId, process.env.JWT_REFRESH_SECRET);
    return typeof payload === 'object' && payload != null && typeof payload.id === 'string'
      ? payload.id
      : null;
  } catch {
    return null;
  }
};

const getAuthenticatedUserId = (user) => user?.id?.toString?.() ?? user?._id?.toString?.();
const refreshCloudFrontCookies =
  maybeRefreshCloudFrontAuthCookiesMiddleware ?? ((_req, _res, next) => next());

const getDecodedExpiry = (...tokens) => {
  for (const token of tokens) {
    if (!token) {
      continue;
    }
    const decoded = jwt.decode(token);
    if (decoded && typeof decoded === 'object' && typeof decoded.exp === 'number') {
      return decoded.exp;
    }
  }
};

const attachOpenIDFederatedTokens = ({ req, user, parsedCookies }) => {
  const sessionTokens = req.session?.openidTokens;
  const accessToken = sessionTokens?.accessToken || parsedCookies.openid_access_token;
  const idToken = sessionTokens?.idToken || parsedCookies.openid_id_token;
  const refreshToken = sessionTokens?.refreshToken || parsedCookies.refreshToken;

  if (!accessToken && !idToken && !refreshToken) {
    logger.warn('[requireJwtAuth] OpenID JWT fallback authenticated without federated tokens', {
      has_session: Boolean(req.session),
      has_token_provider: parsedCookies.token_provider === 'openid',
    });
    return;
  }

  user.federatedTokens = {
    access_token: accessToken,
    id_token: idToken,
    refresh_token: refreshToken,
    expires_at: getDecodedExpiry(idToken, accessToken),
  };
};

/**
 * Custom Middleware to handle JWT authentication, with support for OpenID token reuse.
 * Switches between JWT and OpenID authentication based on cookies and environment settings.
 *
 * After successful authentication (req.user populated), automatically chains into
 * `tenantContextMiddleware` to propagate request context into AsyncLocalStorage
 * for downstream Mongoose tenant isolation and structured logging.
 */
const requireJwtAuth = (req, res, next) => {
  const cookieHeader = req.headers.cookie;
  const parsedCookies = cookieHeader ? cookies.parse(cookieHeader) : {};
  const tokenProvider = parsedCookies.token_provider;
  const openidReuseEnabled = isEnabled(process.env.OPENID_REUSE_TOKENS);
  const openidJwtAvailable = openidReuseEnabled && hasPassportStrategy('openidJwt');
  const openIdReuseUserId = getValidOpenIdReuseUserId(parsedCookies);
  const useOpenIdJwt =
    tokenProvider === 'openid' && openidJwtAvailable && openIdReuseUserId != null;
  const strategies = useOpenIdJwt ? ['openidJwt', 'jwt'] : ['jwt'];

  const authenticateWithStrategy = (index) => {
    const strategy = strategies[index];
    passport.authenticate(strategy, { session: false }, (err, user, info, status) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        if (index + 1 < strategies.length) {
          return authenticateWithStrategy(index + 1);
        }
        logger.warn('[requireJwtAuth] Authentication failed', {
          strategy,
          token_provider: tokenProvider,
          has_openid_user_id: Boolean(parsedCookies.openid_user_id),
          message: info?.message,
          status: status || 401,
        });
        return res.status(status || 401).json({
          message: info?.message || 'Unauthorized',
        });
      }
      if (strategy === 'openidJwt' && getAuthenticatedUserId(user) !== openIdReuseUserId) {
        if (index + 1 < strategies.length) {
          return authenticateWithStrategy(index + 1);
        }
        return res.status(401).json({ message: 'Unauthorized' });
      }
      if (strategy === 'jwt' && tokenProvider === 'openid') {
        attachOpenIDFederatedTokens({ req, user, parsedCookies });
        logger.info('[requireJwtAuth] OpenID request authenticated with local JWT fallback', {
          userId: getAuthenticatedUserId(user),
          has_session_tokens: Boolean(req.session?.openidTokens),
        });
      }
      req.user = user;
      req.authStrategy = strategy;
      tenantContextMiddleware(req, res, (tenantErr) => {
        if (tenantErr) {
          return next(tenantErr);
        }
        refreshCloudFrontCookies(req, res, next);
      });
    })(req, res, next);
  };

  authenticateWithStrategy(0);
};

module.exports = requireJwtAuth;
