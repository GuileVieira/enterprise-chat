const express = require('express');
const { createUserPreferencesHandler } = require('@librechat/api');
const {
  updateUserPluginsController,
  resendVerificationController,
  getTermsStatusController,
  acceptTermsController,
  verifyEmailController,
  deleteUserController,
  getUserController,
} = require('~/server/controllers/UserController');
const {
  verifyEmailLimiter,
  verifyEmailSubmissionLimiter,
  configMiddleware,
  canDeleteAccount,
  requireJwtAuth,
} = require('~/server/middleware');
const { preAuthTenantMiddleware } = require('@librechat/api');

const settings = require('./settings');
const { updateUserStatefulCodeEnvironment } = require('~/models');

const router = express.Router();

const updateUserPreferences = createUserPreferencesHandler({
  updateStatefulCodeEnvironment: updateUserStatefulCodeEnvironment,
});

router.use('/settings', settings);
router.get('/', requireJwtAuth, getUserController);
router.patch('/preferences', requireJwtAuth, configMiddleware, updateUserPreferences);
router.get('/terms', requireJwtAuth, getTermsStatusController);
router.post('/terms/accept', requireJwtAuth, acceptTermsController);
router.post('/plugins', requireJwtAuth, updateUserPluginsController);
router.delete('/delete', requireJwtAuth, canDeleteAccount, configMiddleware, deleteUserController);
router.post(
  '/verify',
  preAuthTenantMiddleware,
  verifyEmailSubmissionLimiter,
  verifyEmailController,
);
router.post(
  '/verify/resend',
  preAuthTenantMiddleware,
  verifyEmailLimiter,
  resendVerificationController,
);

module.exports = router;
