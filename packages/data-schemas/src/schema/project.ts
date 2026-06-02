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
    minRoas: Number,
    maxIncreasePct: Number,
    maxDecreasePct: Number,
    minDailyBudget: Number,
    maxDailyBudget: Number,
    cooldownHours: Number,
    minSpend: Number,
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
    budgetLevel: {
      type: String,
      enum: ['adset'],
      default: 'adset',
    },
    rules: {
      type: ProjectMetaAdsRulesSchema,
      default: {},
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
