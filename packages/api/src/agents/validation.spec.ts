import { EModelEndpoint, MAX_SUBAGENTS } from 'librechat-data-provider';

import type { Agent } from 'librechat-data-provider';

import {
  agentCreateSchema,
  agentUpdateSchema,
  validateAgentModel,
  agentSubagentsSchema,
} from './validation';

describe('agentSubagentsSchema', () => {
  it('accepts enabled:true with a list within the cap', () => {
    const result = agentSubagentsSchema.safeParse({
      enabled: true,
      allowSelf: false,
      agent_ids: ['agent_1', 'agent_2'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts the feature-off shape (enabled:false, no agents)', () => {
    const result = agentSubagentsSchema.safeParse({ enabled: false });
    expect(result.success).toBe(true);
  });

  it('rejects agent_ids longer than MAX_SUBAGENTS', () => {
    const oversized = Array.from({ length: MAX_SUBAGENTS + 1 }, (_, i) => `agent_${i}`);
    const result = agentSubagentsSchema.safeParse({
      enabled: true,
      agent_ids: oversized,
    });
    expect(result.success).toBe(false);
  });

  it('accepts exactly MAX_SUBAGENTS entries', () => {
    const atCap = Array.from({ length: MAX_SUBAGENTS }, (_, i) => `agent_${i}`);
    const result = agentSubagentsSchema.safeParse({
      enabled: true,
      agent_ids: atCap,
    });
    expect(result.success).toBe(true);
  });
});

describe('agentCreateSchema with subagents', () => {
  const base = {
    provider: 'openAI',
    model: 'gpt-4o-mini',
    tools: [],
  };

  it('passes with subagents omitted', () => {
    const result = agentCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('passes with a valid subagents config', () => {
    const result = agentCreateSchema.safeParse({
      ...base,
      subagents: { enabled: true, allowSelf: true, agent_ids: [] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects when subagents.agent_ids exceeds the cap', () => {
    const oversized = Array.from({ length: MAX_SUBAGENTS + 1 }, (_, i) => `agent_${i}`);
    const result = agentCreateSchema.safeParse({
      ...base,
      subagents: { enabled: true, agent_ids: oversized },
    });
    expect(result.success).toBe(false);
  });
});

describe('agentUpdateSchema with subagents', () => {
  it('accepts a partial update with only the disabled flag set', () => {
    const result = agentUpdateSchema.safeParse({
      subagents: { enabled: false, allowSelf: true, agent_ids: [] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects oversized agent_ids on update', () => {
    const oversized = Array.from({ length: MAX_SUBAGENTS + 3 }, (_, i) => `agent_${i}`);
    const result = agentUpdateSchema.safeParse({
      subagents: { enabled: true, agent_ids: oversized },
    });
    expect(result.success).toBe(false);
  });
});

describe('validateAgentModel fallback', () => {
  it('uses the first configured model when the agent model is invalid', async () => {
    const agent = {
      provider: 'OpenRouter',
      model: 'removed-model',
      model_parameters: { model: 'removed-model', temperature: 0.2 },
    } as Agent;
    const logViolation = jest.fn();

    const result = await validateAgentModel({
      agent,
      logViolation,
      req: {} as never,
      res: {} as never,
      modelsConfig: {
        [EModelEndpoint.assistants]: ['gpt-assistant'],
        OpenRouter: ['openai/gpt-5.6-luna', 'google/gemini-3.8-flash'],
      },
    });

    expect(result).toEqual({
      isValid: true,
      fallback: { provider: 'OpenRouter', model: 'openai/gpt-5.6-luna' },
    });
    expect(agent).toMatchObject({
      provider: 'OpenRouter',
      model: 'openai/gpt-5.6-luna',
      model_parameters: { model: 'openai/gpt-5.6-luna', temperature: 0.2 },
    });
    expect(logViolation).not.toHaveBeenCalled();
  });

  it('moves to the first allowed provider when the saved provider is unavailable', async () => {
    const agent = { provider: 'RemovedProvider', model: null } as Agent;

    const result = await validateAgentModel({
      agent,
      req: {} as never,
      res: {} as never,
      logViolation: jest.fn(),
      allowedProviders: new Set(['OpenRouter']),
      modelsConfig: {
        [EModelEndpoint.google]: ['gemini-available-but-not-allowed'],
        OpenRouter: ['openai/gpt-5.6-luna'],
      },
    });

    expect(result.fallback).toEqual({
      provider: 'OpenRouter',
      model: 'openai/gpt-5.6-luna',
    });
    expect(agent.provider).toBe('OpenRouter');
    expect(agent.model).toBe('openai/gpt-5.6-luna');
  });
});
