const express = require('express');
const { PermissionBits } = require('librechat-data-provider');
const { logger } = require('@librechat/data-schemas');
const { updateProject } = require('~/models');
const { requireJwtAuth } = require('~/server/middleware');
const {
  canAccessProjectResource,
} = require('~/server/middleware/accessResources/canAccessProject');
const {
  analyzeProject,
  applyRecommendation,
  getProjectMetaAdsStatus,
} = require('~/server/services/MetaAds/budget');

const router = express.Router({ mergeParams: true });

router.use(requireJwtAuth);

function normalizeMetaAds(metaAds = {}) {
  const digits =
    typeof metaAds.adAccountId === 'string'
      ? metaAds.adAccountId.replace(/^act_/i, '').replace(/\D/g, '')
      : '';
  const tokenSecretName =
    typeof metaAds.tokenSecretName === 'string' ? metaAds.tokenSecretName.trim() : '';
  return {
    ...metaAds,
    adAccountId: digits ? `act_${digits}` : metaAds.adAccountId,
    tokenSecretName,
    credentialMode: tokenSecretName ? 'project_secret' : 'tenant_default',
  };
}

router.get(
  '/',
  canAccessProjectResource({ requiredPermission: PermissionBits.VIEW }),
  async (req, res) => {
    try {
      return res.json(await getProjectMetaAdsStatus(req.params.projectId));
    } catch (error) {
      logger.error('[projectMetaAds] status failed', error);
      return res.status(500).json({ message: error.message });
    }
  },
);

router.put(
  '/settings',
  canAccessProjectResource({ requiredPermission: PermissionBits.EDIT }),
  async (req, res) => {
    try {
      const project = await updateProject(req.params.projectId, {
        metaAds: normalizeMetaAds(req.body.metaAds),
      });
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      return res.json(project);
    } catch (error) {
      logger.error('[projectMetaAds] settings failed', error);
      return res.status(500).json({ message: error.message });
    }
  },
);

router.post(
  '/run',
  canAccessProjectResource({ requiredPermission: PermissionBits.EDIT }),
  async (req, res) => {
    try {
      return res.json(await analyzeProject({ projectId: req.params.projectId, actor: 'user' }));
    } catch (error) {
      logger.error('[projectMetaAds] run failed', error);
      return res.status(500).json({ message: error.message });
    }
  },
);

router.post(
  '/recommendations/:recommendationId/apply',
  canAccessProjectResource({ requiredPermission: PermissionBits.EDIT }),
  async (req, res) => {
    try {
      const recommendation = await applyRecommendation({
        recommendationId: req.params.recommendationId,
        projectId: req.params.projectId,
        actor: 'user',
        actorUserId: req.user.id,
      });
      return res.json({ recommendation });
    } catch (error) {
      logger.error('[projectMetaAds] apply failed', error);
      return res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
