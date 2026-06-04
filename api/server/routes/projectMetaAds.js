const express = require('express');
const { PermissionBits } = require('librechat-data-provider');
const { logger, getTenantId } = require('@librechat/data-schemas');
const { findProjectById, getProjectById, updateProject, upsertTenantSecret } = require('~/models');
const { requireJwtAuth } = require('~/server/middleware');
const {
  canAccessProjectResource,
} = require('~/server/middleware/accessResources/canAccessProject');
const { getAppConfig } = require('~/server/services/Config/app');
const {
  analyzeProject,
  applyRecommendation,
  getProjectMetaAdsStatus,
} = require('~/server/services/MetaAds/budget');

const router = express.Router({ mergeParams: true });

router.use(requireJwtAuth);

const SCHEDULE_INTERVALS = new Set([30, 60, 120, 180, 360, 720, 1440]);
const META_ACCESS_TOKEN_SECRET_TYPE = 'meta_access_token';
const META_GRAPH_VERSION_PATTERN = /^v\d+\.0$/;

function getProjectMetaTokenSecretName(projectId) {
  return `meta_graph_access_token_project_${projectId}`;
}

function looksLikeMetaAccessToken(value) {
  return typeof value === 'string' && /^EAA[a-zA-Z0-9_-]{40,}$/.test(value.trim());
}

async function requireMetaAdsFeature(req, res, next) {
  try {
    const appConfig = await getAppConfig({
      role: req.user.role,
      userId: req.user.id,
      tenantId: req.user.tenantId || getTenantId(),
    });
    if (appConfig?.interfaceConfig?.metaAds === false) {
      return res.status(404).json({ message: 'Meta Ads is disabled.' });
    }
    return next();
  } catch (error) {
    logger.error('[projectMetaAds] feature check failed', error);
    return res.status(500).json({ message: error.message });
  }
}

router.use(requireMetaAdsFeature);

function normalizeMetaAds(metaAds = {}) {
  const {
    metaAccessToken: _metaAccessToken,
    accessToken: _accessToken,
    graphVersion: rawGraphVersion,
    ...safeMetaAds
  } = metaAds;
  const digits =
    typeof safeMetaAds.adAccountId === 'string'
      ? safeMetaAds.adAccountId.replace(/^act_/i, '').replace(/\D/g, '')
      : '';
  const tokenSecretName =
    typeof safeMetaAds.tokenSecretName === 'string' ? safeMetaAds.tokenSecretName.trim() : '';
  const graphVersion =
    typeof rawGraphVersion === 'string' && META_GRAPH_VERSION_PATTERN.test(rawGraphVersion.trim())
      ? rawGraphVersion.trim()
      : undefined;
  if (looksLikeMetaAccessToken(tokenSecretName)) {
    throw Object.assign(
      new Error('Token secret name must be a secret name, not the Meta access token value.'),
      { statusCode: 400 },
    );
  }
  return {
    ...safeMetaAds,
    adAccountId: digits ? `act_${digits}` : safeMetaAds.adAccountId,
    tokenSecretName,
    ...(graphVersion ? { graphVersion } : {}),
    credentialMode: tokenSecretName ? 'project_secret' : 'tenant_default',
    scheduleIntervalMinutes: SCHEDULE_INTERVALS.has(Number(safeMetaAds.scheduleIntervalMinutes))
      ? Number(safeMetaAds.scheduleIntervalMinutes)
      : 180,
  };
}

async function resolveProjectForMetaAdsSettings(projectId) {
  return (await getProjectById(projectId)) || (await findProjectById(projectId));
}

async function prepareMetaAdsSettingsUpdate({
  projectId,
  tenantId,
  metaAds,
  metaAccessToken,
  resolveProject = resolveProjectForMetaAdsSettings,
  upsertSecret = upsertTenantSecret,
}) {
  const normalized = normalizeMetaAds(metaAds);
  const trimmedToken = typeof metaAccessToken === 'string' ? metaAccessToken.trim() : '';
  if (!trimmedToken) {
    return { metaAds: normalized };
  }

  const project = await resolveProject(projectId);
  if (!project) {
    return null;
  }

  const projectSecretName = getProjectMetaTokenSecretName(project.projectId || projectId);
  logger.debug('[projectMetaAds] saving project Meta token secret', {
    projectId,
    tenantId: project.tenantId || tenantId || getTenantId(),
    secretName: projectSecretName,
    tokenLength: trimmedToken.length,
  });
  await upsertSecret(
    project.tenantId || tenantId || getTenantId(),
    projectSecretName,
    trimmedToken,
    META_ACCESS_TOKEN_SECRET_TYPE,
  );

  return {
    metaAds: {
      ...normalized,
      tokenSecretName: projectSecretName,
      credentialMode: 'project_secret',
    },
  };
}

router.get(
  '/',
  canAccessProjectResource({ requiredPermission: PermissionBits.VIEW }),
  async (req, res) => {
    try {
      const tenantId = req.user.tenantId || getTenantId();
      logger.debug('[projectMetaAds] status requested', {
        tenantId,
        projectId: req.params.projectId,
      });
      return res.json(await getProjectMetaAdsStatus(req.params.projectId, tenantId));
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
      const update = await prepareMetaAdsSettingsUpdate({
        projectId: req.params.projectId,
        tenantId: req.user.tenantId,
        metaAds: req.body.metaAds,
        metaAccessToken: req.body.metaAccessToken,
      });
      if (!update) {
        return res.status(404).json({ message: 'Project not found' });
      }
      const project = await updateProject(req.params.projectId, update);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      logger.debug('[projectMetaAds] settings saved', {
        projectId: req.params.projectId,
        hasProjectTokenSecret: !!project.metaAds?.tokenSecretName,
      });
      return res.json(project);
    } catch (error) {
      logger.error('[projectMetaAds] settings failed', error);
      return res.status(error.statusCode ?? 500).json({ message: error.message });
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

router._normalizeMetaAdsForTest = normalizeMetaAds;
router._prepareMetaAdsSettingsUpdateForTest = prepareMetaAdsSettingsUpdate;
router._getProjectMetaTokenSecretNameForTest = getProjectMetaTokenSecretName;

module.exports = router;
