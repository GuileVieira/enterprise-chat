import type { TProject } from 'librechat-data-provider';
import { getGraphVersionOptions, normalizeSettings } from './settings';

describe('Meta Ads settings normalization', () => {
  it('strips legacy cooldown fields from editable settings', () => {
    const settings = normalizeSettings({
      projectId: 'p1',
      metaAds: {
        rules: {
          cooldownHours: 24,
        },
        creativeRules: {
          pauseHighCost: {
            cooldownHours: 24,
          },
        },
        ruleGroups: [
          {
            id: 'g1',
            name: 'Group',
            entityLevel: 'campaign',
            entityIds: ['campaign-1'],
            rules: {
              cooldownHours: 24,
            },
            creativeRules: {
              pauseHighCost: {
                cooldownHours: 24,
              },
            },
          },
        ],
        ruleOverrides: [
          {
            entityLevel: 'adset',
            entityId: 'adset-1',
            rules: {
              cooldownHours: 24,
            },
            creativeRules: {
              pauseHighCost: {
                cooldownHours: 24,
              },
            },
          },
        ],
      },
    } as TProject);

    expect(settings.rules).not.toHaveProperty('cooldownHours');
    expect(settings.creativeRules.pauseHighCost).not.toHaveProperty('cooldownHours');
    expect(settings.ruleGroups?.[0].rules).not.toHaveProperty('cooldownHours');
    expect(settings.ruleGroups?.[0].creativeRules?.pauseHighCost).not.toHaveProperty(
      'cooldownHours',
    );
    expect(settings.ruleOverrides?.[0].rules).not.toHaveProperty('cooldownHours');
    expect(settings.ruleOverrides?.[0].creativeRules?.pauseHighCost).not.toHaveProperty(
      'cooldownHours',
    );
  });
});

describe('Meta Graph version options', () => {
  it('includes discovered and configured versions without duplicates or invalid values', () => {
    expect(getGraphVersionOptions('v29.0', ['v28.0', 'v27.0', 'v23.0', 'invalid'])).toEqual([
      'v24.0',
      'v25.0',
      'v26.0',
      'v27.0',
      'v28.0',
      'v29.0',
    ]);
  });
});
