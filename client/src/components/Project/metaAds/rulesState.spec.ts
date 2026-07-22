import { getMetaAdsEntityRuleLabel } from './rulesState';
import type { MetaAdsSettingsState } from './types';

describe('Meta Ads rule labels', () => {
  it('shows the active effective rule label with global fallback', () => {
    const settings: MetaAdsSettingsState = {
      enabled: true,
      adAccountId: '',
      currency: 'BRL',
      automationMode: 'recommend',
      automationAnalysisPreset: 'last_2d',
      accountProfile: 'custom',
      rules: {},
      creativeRules: {},
      ruleGroups: [
        {
          id: 'paused-group',
          name: 'VALIDADOS - JUNHO',
          entityLevel: 'campaign',
          entityIds: ['campaign-1'],
          enabled: false,
          rules: {},
        },
      ],
      ruleOverrides: [
        {
          entityLevel: 'campaign',
          entityId: 'campaign-2',
          entityName: 'Campanha específica',
          enabled: true,
          rules: {},
        },
        {
          entityLevel: 'adset',
          entityId: 'adset-3',
          enabled: true,
          rules: {},
        },
      ],
    };

    expect(getMetaAdsEntityRuleLabel(settings, 'campaign', 'campaign-1', 'Regras globais')).toBe(
      'Regras globais',
    );
    expect(
      getMetaAdsEntityRuleLabel(settings, 'adset', 'adset-2', 'Regras globais', 'campaign-2'),
    ).toBe('Campanha específica');
    expect(
      getMetaAdsEntityRuleLabel(settings, 'adset', 'adset-3', 'Regras globais', 'campaign-2'),
    ).toBe('adset-3');
  });
});
