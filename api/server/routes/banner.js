const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { preAuthTenantMiddleware } = require('@librechat/api');
const optionalJwtAuth = require('~/server/middleware/optionalJwtAuth');
const { getBanner } = require('~/models');

const router = express.Router();

router.get('/', preAuthTenantMiddleware, optionalJwtAuth, async (req, res) => {
  try {
    res.status(200).send(await getBanner(req.user));
  } catch (error) {
    logger.error('[getBanner] Error getting banner', error);
    res.status(500).json({ message: 'Error getting banner' });
  }
});

module.exports = router;
