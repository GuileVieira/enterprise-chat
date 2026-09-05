const { Tool } = require('@librechat/agents/langchain/tools');
const {
  Permissions,
  SystemRoles,
  PermissionBits,
  PermissionTypes,
} = require('librechat-data-provider');
const { updateProject, getRoleByName } = require('~/models');
const {
  findProjectForRequest,
  userCanAccessProject,
} = require('~/server/services/Projects/access');
const {
  analyzeProject,
  applyManualBudgetChange,
  applyRecommendation,
  duplicateProjectMetaAdsEntity,
  getProjectMetaAdsStatus,
  updateProjectMetaAdsEntityFields,
  updateProjectMetaAdsEntityStatus,
} = require('~/server/services/MetaAds/budget');

const metaAdsBudgetManagerJsonSchema = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: [
        'get_status',
        'list_recommendations',
        'run_now',
        'approve_change',
        'pause_automation',
        'update_budget',
        'pause_campaign',
        'activate_campaign',
        'duplicate_adset',
        'update_entity',
        'set_status',
        'duplicate_entity',
      ],
      description:
        'Action to run. Use approve_change only after showing the recommendation to the user.',
    },
    project_id: {
      type: 'string',
      description: 'Project id that owns the Meta Ads configuration.',
    },
    recommendation_id: {
      type: 'string',
      description: 'Recommendation id. Required for approve_change.',
    },
    entity_id: {
      type: 'string',
      description: 'Meta campaign or ad set id, depending on the action.',
    },
    entity_name: {
      type: 'string',
      description: 'Optional current entity name, stored in the action history.',
    },
    daily_budget: {
      type: 'number',
      description: 'New daily budget in the ad account currency. Required for update_budget.',
    },
    target_name: {
      type: 'string',
      description: 'Name for the duplicated ad set. Required for duplicate_adset.',
    },
    entity_level: {
      type: 'string',
      enum: ['campaign', 'adset', 'ad', 'creative', 'custom_audience'],
      description:
        'Meta entity level. Budget supports campaign/adset; status supports campaign/adset/ad.',
    },
    reason: {
      type: 'string',
      description: 'Optional reason recorded with a manual budget update.',
    },
    status: {
      type: 'string',
      enum: ['ACTIVE', 'PAUSED'],
      description: 'Required for set_status.',
    },
    fields: {
      type: 'object',
      description:
        'Whitelisted fields for update_entity. Campaign: name, bid_strategy, spend_cap, special_ad_categories. Ad set: name, bid_amount, billing_event, optimization_goal, targeting, start_time, end_time, promoted_object. Ad: name, creative, conversion_domain, ad schedule. Creative: name, adlabels, status. Custom audience: metadata and rules; customer data upload is not supported.',
      additionalProperties: true,
    },
  },
  required: ['action', 'project_id'],
};

const META_ADS_SYSTEM_ROLES = new Set([
  SystemRoles.ADMIN,
  SystemRoles.OWNER,
  SystemRoles.AD_MANAGER,
]);

function parseArgs(args) {
  if (!args || typeof args !== 'object') {
    throw new Error('Arguments are required.');
  }
  if (typeof args.action !== 'string' || args.action.length === 0) {
    throw new Error('action is required.');
  }
  if (typeof args.project_id !== 'string' || args.project_id.length === 0) {
    throw new Error('project_id is required.');
  }
  return args;
}

class MetaAdsBudgetManager extends Tool {
  name = 'meta_ads_budget_manager';
  description =
    'Read and change Meta Ads for a project-linked ad account. ' +
    'Can update campaigns, ad sets, ads, creative metadata, custom audience metadata, budgets, statuses, targeting, schedules, bidding, and duplicate campaigns or ad sets. ' +
    'Write actions call the Meta Graph API and require project EDIT permission.';

  schema = metaAdsBudgetManagerJsonSchema;

  static get jsonSchema() {
    return metaAdsBudgetManagerJsonSchema;
  }

  constructor(fields = {}) {
    super();
    this.req = fields.req;
  }

  async requireMetaAdsAccess() {
    const roleName = this.req?.user?.role;
    if (!roleName) {
      throw new Error('Insufficient Meta Ads permissions.');
    }
    if (META_ADS_SYSTEM_ROLES.has(roleName)) {
      return;
    }
    const role = await getRoleByName(roleName);
    if (role?.permissions?.[PermissionTypes.META_ADS]?.[Permissions.USE] !== true) {
      throw new Error('Insufficient Meta Ads permissions.');
    }
  }

  async requireProject(projectId, requiredPermission) {
    if (!this.req?.user) {
      throw new Error('User context is required.');
    }
    const project = await findProjectForRequest({ projectId, user: this.req.user });
    if (!project) {
      throw new Error('Project not found.');
    }
    const hasAccess = await userCanAccessProject({
      req: this.req,
      project,
      requiredPermission,
    });
    if (!hasAccess) {
      throw new Error('Project access denied.');
    }
    return project;
  }

  async _call(rawArgs) {
    try {
      const args = parseArgs(rawArgs);
      await this.requireMetaAdsAccess();
      const writeActions = new Set([
        'run_now',
        'approve_change',
        'pause_automation',
        'update_budget',
        'pause_campaign',
        'activate_campaign',
        'duplicate_adset',
        'update_entity',
        'set_status',
        'duplicate_entity',
      ]);
      const requiredPermission = writeActions.has(args.action)
        ? PermissionBits.EDIT
        : PermissionBits.VIEW;
      const project = await this.requireProject(args.project_id, requiredPermission);

      if (args.action === 'get_status' || args.action === 'list_recommendations') {
        const status = await getProjectMetaAdsStatus(project.projectId);
        return JSON.stringify({ ok: true, projectId: project.projectId, ...status });
      }

      if (args.action === 'run_now') {
        const result = await analyzeProject({
          projectId: project.projectId,
          actor: 'tool',
          applyAuto: false,
        });
        return JSON.stringify({ ok: true, ...result });
      }

      if (args.action === 'approve_change') {
        if (typeof args.recommendation_id !== 'string' || args.recommendation_id.length === 0) {
          throw new Error('recommendation_id is required for approve_change.');
        }
        const recommendation = await applyRecommendation({
          recommendationId: args.recommendation_id,
          projectId: project.projectId,
          actor: 'tool',
          actorUserId: this.req.user.id,
        });
        return JSON.stringify({ ok: true, recommendation });
      }

      if (args.action === 'pause_automation') {
        const metaAds = {
          ...(project.metaAds ?? {}),
          enabled: false,
          automationMode: 'recommend',
        };
        const updatedProject = await updateProject(project.projectId, { metaAds });
        return JSON.stringify({ ok: true, project: updatedProject });
      }

      const directActions = new Set([
        'update_budget',
        'pause_campaign',
        'activate_campaign',
        'duplicate_adset',
        'update_entity',
        'set_status',
        'duplicate_entity',
      ]);
      if (!directActions.has(args.action)) {
        throw new Error(`Unsupported action: ${args.action}`);
      }
      const entityId = typeof args.entity_id === 'string' ? args.entity_id.trim() : '';
      if (!entityId) {
        throw new Error(`entity_id is required for ${args.action}.`);
      }
      const common = {
        projectId: project.projectId,
        tenantId: this.req.user.tenantId,
        entityId,
        entityName: args.entity_name,
        actor: 'tool',
        actorUserId: this.req.user.id,
      };

      if (args.action === 'update_entity') {
        const result = await updateProjectMetaAdsEntityFields({
          ...common,
          entityLevel: args.entity_level,
          fields: args.fields,
        });
        return JSON.stringify({
          ok: true,
          action: args.action,
          confirmation: {
            confirmed: true,
            entityId: result.entityId,
            updatedFields: result.updatedFields,
          },
          ...result,
        });
      }

      if (args.action === 'set_status') {
        if (!['campaign', 'adset', 'ad'].includes(args.entity_level)) {
          throw new Error('entity_level must be campaign, adset, or ad for set_status.');
        }
        if (!['ACTIVE', 'PAUSED'].includes(args.status)) {
          throw new Error('status is required for set_status.');
        }
        const result = await updateProjectMetaAdsEntityStatus({
          ...common,
          entityLevel: args.entity_level,
          status: args.status,
        });
        return JSON.stringify({
          ok: true,
          action: args.action,
          confirmation: { confirmed: true, entityId, status: result.status },
          ...result,
        });
      }

      if (args.action === 'duplicate_entity') {
        if (!['campaign', 'adset'].includes(args.entity_level)) {
          throw new Error('entity_level must be campaign or adset for duplicate_entity.');
        }
        if (typeof args.target_name !== 'string' || args.target_name.trim().length === 0) {
          throw new Error('target_name is required for duplicate_entity.');
        }
        const result = await duplicateProjectMetaAdsEntity({
          ...common,
          entityLevel: args.entity_level,
          targetName: args.target_name,
        });
        return JSON.stringify({
          ok: true,
          action: args.action,
          confirmation: {
            confirmed: true,
            sourceEntityId: result.sourceEntityId,
            duplicatedEntityId: result.duplicatedEntityId,
          },
          ...result,
        });
      }

      if (args.action === 'update_budget') {
        if (!['campaign', 'adset'].includes(args.entity_level)) {
          throw new Error('entity_level is required for update_budget.');
        }
        if (!Number.isFinite(args.daily_budget)) {
          throw new Error('daily_budget is required for update_budget.');
        }
        const result = await applyManualBudgetChange({
          ...common,
          entityLevel: args.entity_level,
          dailyBudget: args.daily_budget,
          reason: args.reason || 'Budget updated through Meta Ads tool.',
        });
        return JSON.stringify({
          ok: true,
          action: args.action,
          confirmation: { confirmed: true, entityId, dailyBudget: args.daily_budget },
          ...result,
        });
      }

      if (args.action === 'pause_campaign' || args.action === 'activate_campaign') {
        const result = await updateProjectMetaAdsEntityStatus({
          ...common,
          entityLevel: 'campaign',
          status: args.action === 'pause_campaign' ? 'PAUSED' : 'ACTIVE',
        });
        return JSON.stringify({
          ok: true,
          action: args.action,
          confirmation: { confirmed: true, entityId, status: result.status },
          ...result,
        });
      }

      if (args.action === 'duplicate_adset') {
        if (typeof args.target_name !== 'string' || args.target_name.trim().length === 0) {
          throw new Error('target_name is required for duplicate_adset.');
        }
        const result = await duplicateProjectMetaAdsEntity({
          ...common,
          entityLevel: 'adset',
          targetName: args.target_name,
        });
        return JSON.stringify({
          ok: true,
          action: args.action,
          confirmation: {
            confirmed: true,
            sourceEntityId: result.sourceEntityId,
            duplicatedEntityId: result.duplicatedEntityId,
          },
          ...result,
        });
      }
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: {
          message: error instanceof Error ? error.message : 'Meta Ads budget manager failed.',
        },
      });
    }
  }
}

module.exports = MetaAdsBudgetManager;
