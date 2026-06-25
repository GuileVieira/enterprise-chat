import { Schema } from 'mongoose';
import { IProject } from '~/types';

const ProjectMemorySchema = new Schema(
  {
    key: {
      type: String,
      required: true,
    },
    value: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const ProjectPromptSnippetSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const ProjectMetaAdsRulesSchema = new Schema(
  {
    targetCpa: Number,
    targetResultType: String,
    primaryMetric: {
      type: String,
      enum: ['cpa', 'roas', 'cpc', 'ctr'],
    },
    minRoas: Number,
    minCtr: Number,
    maxCpc: Number,
    maxCpm: Number,
    maxIncreasePct: Number,
    maxDecreasePct: Number,
    minDailyBudget: Number,
    maxDailyBudget: Number,
    cooldownHours: Number,
    minSpend: Number,
    enabledSections: {
      performance: Boolean,
      creatives: Boolean,
      noResultSpendCap: Boolean,
    },
    noResultSpendCap: {
      enabled: Boolean,
      minSpend: Number,
    },
  },
  { _id: false },
);

const ProjectMetaAdsCreativeRulesSchema = new Schema(
  {
    maxFrequency: Number,
    pauseHighCost: {
      enabled: Boolean,
      maxCostPerResult: Number,
      lookbackDays: {
        type: Number,
        enum: [1, 2, 3, 7],
      },
      minCreativesInScope: Number,
      minSpend: Number,
      cooldownHours: Number,
      targetResultType: String,
    },
  },
  { _id: false },
);

const ProjectMetaAdsMonthlyBudgetSchema = new Schema(
  {
    month: String,
    baseAmount: Number,
    additionalAmount: Number,
    allowedOverspendPct: Number,
  },
  { _id: false },
);

const ProjectMetaAdsClientGoalSchema = new Schema(
  {
    resultType: String,
    monthlyTarget: Number,
  },
  { _id: false },
);

const ProjectMetaAdsRuleOverrideSchema = new Schema(
  {
    entityLevel: {
      type: String,
      enum: ['campaign', 'adset'],
      required: true,
    },
    entityId: {
      type: String,
      required: true,
    },
    entityName: {
      type: String,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    rules: {
      type: ProjectMetaAdsRulesSchema,
      default: {},
    },
    creativeRules: {
      type: ProjectMetaAdsCreativeRulesSchema,
      default: {},
    },
  },
  { _id: false },
);

const ProjectMetaAdsRuleGroupSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    entityLevel: {
      type: String,
      enum: ['campaign', 'adset'],
      required: true,
    },
    entityIds: {
      type: [String],
      default: [],
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    rules: {
      type: ProjectMetaAdsRulesSchema,
      default: {},
    },
    creativeRules: {
      type: ProjectMetaAdsCreativeRulesSchema,
      default: {},
    },
  },
  { _id: false },
);

const ProjectMetaAdsSchema = new Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    adAccountId: {
      type: String,
    },
    tokenSecretName: {
      type: String,
    },
    graphVersion: {
      type: String,
    },
    credentialMode: {
      type: String,
      enum: ['project_secret', 'tenant_default'],
      default: 'tenant_default',
    },
    automationMode: {
      type: String,
      enum: ['recommend', 'auto_limited'],
      default: 'recommend',
    },
    accountProfile: {
      type: String,
      enum: ['local_business', 'ecommerce', 'lead_gen', 'traffic', 'custom'],
      default: 'custom',
    },
    budgetLevel: {
      type: String,
      enum: ['campaign', 'adset'],
      default: 'adset',
    },
    scheduleIntervalMinutes: {
      type: Number,
      enum: [30, 60, 120, 180, 360, 720, 1440],
      default: 180,
    },
    automationAnalysisPreset: {
      type: String,
      enum: ['today', 'yesterday', 'last_2d', 'last_3d', 'last_7d', 'last_14d', 'last_30d'],
      default: 'last_2d',
    },
    lastRunAt: {
      type: Date,
    },
    clientGoal: {
      type: ProjectMetaAdsClientGoalSchema,
      default: undefined,
    },
    monthlyBudget: {
      type: ProjectMetaAdsMonthlyBudgetSchema,
      default: undefined,
    },
    monthlyBudgets: {
      type: Map,
      of: ProjectMetaAdsMonthlyBudgetSchema,
      default: undefined,
    },
    rules: {
      type: ProjectMetaAdsRulesSchema,
      default: {},
    },
    creativeRules: {
      type: ProjectMetaAdsCreativeRulesSchema,
      default: {},
    },
    ruleOverrides: {
      type: [ProjectMetaAdsRuleOverrideSchema],
      default: [],
    },
    ruleGroups: {
      type: [ProjectMetaAdsRuleGroupSchema],
      default: [],
    },
  },
  { _id: false },
);

const projectSchema = new Schema<IProject>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
      meiliIndex: true,
    },
    name: {
      type: String,
      required: true,
      meiliIndex: true,
    },
    description: {
      type: String,
    },
    user: {
      type: String,
      index: true,
      meiliIndex: true,
    },
    endpoint: {
      type: String,
      default: null,
    },
    model: {
      type: String,
    },
    instructions: {
      type: String,
    },
    memories: {
      type: [ProjectMemorySchema],
      default: [],
    },
    memoryKeys: {
      type: [String],
      default: [],
    },
    promptSnippets: {
      type: [ProjectPromptSnippetSchema],
      default: [],
    },
    promptGroupIds: {
      type: [String],
      default: [],
    },
    fileIds: {
      type: [String],
      default: [],
    },
    metaAds: {
      type: ProjectMetaAdsSchema,
      default: undefined,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    iconURL: {
      type: String,
    },
    accessLevel: {
      type: Number,
      default: 0,
    },
    tenantId: {
      type: String,
      index: true,
    },
  },
  { timestamps: true },
);

projectSchema.index({ projectId: 1, tenantId: 1 }, { unique: true });
projectSchema.index({ user: 1, updatedAt: -1 });

export default projectSchema;
