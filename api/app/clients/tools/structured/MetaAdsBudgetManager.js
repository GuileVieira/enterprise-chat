const { Tool } = require('@librechat/agents/langchain/tools');
const { PermissionBits } = require('librechat-data-provider');
const { updateProject } = require('~/models');
const {
  findProjectForRequest,
  userCanAccessProject,
} = require('~/server/services/Projects/access');
const {
  analyzeProject,
  applyRecommendation,
  getProjectMetaAdsStatus,
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
  },
  required: ['action', 'project_id'],
};

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
    'Manage Meta Ads budget recommendations for a project. ' +
    'Reads the project Meta Ads status, creates recommendations, pauses automation, and applies one approved recommendation. ' +
    'Requires project VIEW for status and project EDIT for run, pause, or apply.';

  schema = metaAdsBudgetManagerJsonSchema;

  static get jsonSchema() {
    return metaAdsBudgetManagerJsonSchema;
  }

  constructor(fields = {}) {
    super();
    this.req = fields.req;
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
      const writeActions = new Set(['run_now', 'approve_change', 'pause_automation']);
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

      throw new Error(`Unsupported action: ${args.action}`);
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
