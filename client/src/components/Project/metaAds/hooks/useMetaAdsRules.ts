import { useState } from 'react';
import type { ProjectMetaAdsCampaignSummary } from 'librechat-data-provider';
import {
  defaultRules,
  accountProfileRules,
  getRuleOverrideKey,
  hasRulePerformanceMetric,
} from '../rules';
import {
  buildMetaAdsRuleRows,
  getMetaAdsEntityRuleLabel,
  getMetaAdsRuleDraftEntityLabels,
  getMetaAdsRuleDraftEntityOptions,
} from '../rulesState';
import type {
  RuleRow,
  RuleGroupDraft,
  MetaAdsRuleGroup,
  MetaAdsRulesState,
  MetaAdsRuleOverride,
  MetaAdsSettingsState,
  Localize,
} from '../types';

type CreativeRuleChangeKey =
  | 'maxFrequency'
  | 'pauseHighCost.enabled'
  | 'pauseHighCost.maxCostPerResult'
  | 'pauseHighCost.lookbackDays'
  | 'pauseHighCost.minCreativesInScope'
  | 'pauseHighCost.minSpend'
  | 'pauseHighCost.cooldownHours'
  | 'pauseHighCost.targetResultType';

type ToastStatus = 'success' | 'error' | 'warning' | 'info';

type ShowToast = (toast: { message: string; status: ToastStatus }) => void;

type UseMetaAdsRulesParams = {
  settings: MetaAdsSettingsState;
  setSettings: (settings: MetaAdsSettingsState) => void;
  campaigns: ProjectMetaAdsCampaignSummary[];
  selectedCampaignIds: string[];
  selectedAdSetIds: string[];
  canUseMetaAdsActions: boolean;
  localize: Localize;
  showToast: ShowToast;
};

export function useMetaAdsRules({
  settings,
  setSettings,
  campaigns,
  selectedCampaignIds,
  selectedAdSetIds,
  canUseMetaAdsActions,
  localize,
  showToast,
}: UseMetaAdsRulesParams) {
  const [ruleGroupDraft, setRuleGroupDraft] = useState<RuleGroupDraft | null>(null);
  const canCreateRuleGroup = canUseMetaAdsActions;
  const getEntityRuleLabel = (entityLevel: MetaAdsRuleGroup['entityLevel'], entityId: string) =>
    getMetaAdsEntityRuleLabel(settings, entityLevel, entityId);
  const ruleDraftEntityLabels = getMetaAdsRuleDraftEntityLabels(ruleGroupDraft, campaigns);
  const ruleDraftEntityOptions = getMetaAdsRuleDraftEntityOptions(ruleGroupDraft, campaigns);
  const ruleRows = buildMetaAdsRuleRows({ settings, campaigns, localize });

  const onOpenRuleGroupDraft = () => {
    if (!canCreateRuleGroup) {
      return;
    }
    if (selectedCampaignIds.length === 0 && selectedAdSetIds.length === 0) {
      setRuleGroupDraft({
        scope: 'global',
        name: localize('com_ui_project_meta_ads_global_rules'),
        entityLevel: 'campaign',
        entityIds: [],
        rules: { ...settings.rules },
        creativeRules: { ...settings.creativeRules },
      });
      return;
    }
    const entityLevel = selectedCampaignIds.length > 0 ? 'campaign' : 'adset';
    const entityIds = entityLevel === 'campaign' ? selectedCampaignIds : selectedAdSetIds;
    setRuleGroupDraft({
      scope: 'group',
      name: '',
      entityLevel,
      entityIds,
      rules: { ...settings.rules },
      creativeRules: { ...settings.creativeRules },
    });
  };

  const onEditGlobalRule = () => {
    setRuleGroupDraft({
      scope: 'global',
      name: localize('com_ui_project_meta_ads_global_rules'),
      entityLevel: 'campaign',
      entityIds: [],
      rules: { ...settings.rules },
      creativeRules: { ...settings.creativeRules },
    });
  };

  const onEditRuleGroup = (group: MetaAdsRuleGroup) => {
    setRuleGroupDraft({
      id: group.id,
      scope: 'group',
      name: group.name ?? '',
      entityLevel: group.entityLevel,
      entityIds: group.entityIds ?? [],
      rules: { ...defaultRules, ...(group.rules ?? {}) },
      creativeRules: { ...settings.creativeRules, ...(group.creativeRules ?? {}) },
    });
  };

  const onEditRuleOverride = (ruleOverride: MetaAdsRuleOverride) => {
    setRuleGroupDraft({
      overrideKey: getRuleOverrideKey(ruleOverride),
      scope: 'override',
      name: ruleOverride.entityName ?? '',
      entityLevel: ruleOverride.entityLevel,
      entityIds: [ruleOverride.entityId],
      entityName: ruleOverride.entityName,
      rules: { ...defaultRules, ...(ruleOverride.rules ?? {}) },
      creativeRules: { ...settings.creativeRules, ...(ruleOverride.creativeRules ?? {}) },
    });
  };

  const onToggleRuleRow = (row: RuleRow) => {
    if (!canUseMetaAdsActions) {
      return;
    }
    if (row.type === 'global') {
      setSettings({ ...settings, enabled: !row.enabled });
      return;
    }
    if (row.type === 'group' && row.group?.id) {
      setSettings({
        ...settings,
        ruleGroups: (settings.ruleGroups ?? []).map((group) =>
          group.id === row.group?.id ? { ...group, enabled: !row.enabled } : group,
        ),
      });
      return;
    }
    if (row.override) {
      const targetKey = getRuleOverrideKey(row.override);
      setSettings({
        ...settings,
        ruleOverrides: (settings.ruleOverrides ?? []).map((ruleOverride) =>
          getRuleOverrideKey(ruleOverride) === targetKey
            ? { ...ruleOverride, enabled: !row.enabled }
            : ruleOverride,
        ),
      });
    }
  };

  const onDeleteRuleGroup = (groupId?: string) => {
    setSettings({
      ...settings,
      ruleGroups: (settings.ruleGroups ?? []).filter((group) => group.id !== groupId),
    });
  };

  const onDeleteRuleOverride = (ruleOverride: MetaAdsRuleOverride) => {
    const targetKey = getRuleOverrideKey(ruleOverride);
    setSettings({
      ...settings,
      ruleOverrides: (settings.ruleOverrides ?? []).filter(
        (currentRuleOverride) => getRuleOverrideKey(currentRuleOverride) !== targetKey,
      ),
    });
  };

  const onRuleGroupRuleChange = (key: keyof MetaAdsRulesState, value: string) => {
    setRuleGroupDraft((current) =>
      current
        ? {
            ...current,
            rules: {
              ...current.rules,
              [key]: value === '' ? undefined : Number(value),
            },
          }
        : current,
    );
  };

  const onRuleGroupEntityToggle = (entityId: string) => {
    setRuleGroupDraft((current) => {
      if (!current || current.scope !== 'group') {
        return current;
      }
      const isSelected = current.entityIds.includes(entityId);
      return {
        ...current,
        entityIds: isSelected
          ? current.entityIds.filter((currentEntityId) => currentEntityId !== entityId)
          : [...current.entityIds, entityId],
      };
    });
  };

  const onRuleGroupRuleTextChange = (key: keyof MetaAdsRulesState, value: string) => {
    setRuleGroupDraft((current) =>
      current
        ? {
            ...current,
            rules: {
              ...current.rules,
              [key]: value,
            },
          }
        : current,
    );
  };

  const onAccountProfileChange = (value: MetaAdsSettingsState['accountProfile']) => {
    const profile = value ?? 'custom';
    const nextSettings = {
      ...settings,
      accountProfile: profile,
      rules: {
        ...settings.rules,
        ...(accountProfileRules[profile] ?? {}),
      },
    };
    setSettings(nextSettings);
    setRuleGroupDraft((current) =>
      current?.scope === 'global'
        ? {
            ...current,
            rules: nextSettings.rules,
          }
        : current,
    );
  };

  const onRuleGroupCreativeRuleChange = (key: CreativeRuleChangeKey, value: string) => {
    setRuleGroupDraft((current) =>
      current
        ? key.startsWith('pauseHighCost.')
          ? {
              ...current,
              creativeRules: {
                ...current.creativeRules,
                pauseHighCost: {
                  ...current.creativeRules.pauseHighCost,
                  [key.replace('pauseHighCost.', '')]:
                    key === 'pauseHighCost.enabled'
                      ? value === 'true'
                      : key === 'pauseHighCost.targetResultType'
                        ? value
                        : value === ''
                          ? undefined
                          : Number(value),
                },
              },
            }
          : {
              ...current,
              creativeRules: {
                ...current.creativeRules,
                [key]: value === '' ? undefined : Number(value),
              },
            }
        : current,
    );
  };

  const onSaveRuleGroup = () => {
    if (!ruleGroupDraft) {
      return;
    }
    if (!hasRulePerformanceMetric(ruleGroupDraft.rules)) {
      showToast({
        message: localize('com_ui_project_meta_ads_metric_required'),
        status: 'error',
      });
      return;
    }
    const pauseRule = ruleGroupDraft.creativeRules.pauseHighCost;
    if (
      pauseRule &&
      (Number(pauseRule.minCreativesInScope) < 3 ||
        Number(pauseRule.cooldownHours) < 1 ||
        Number(pauseRule.cooldownHours) > 168 ||
        ![1, 2, 3, 7].includes(Number(pauseRule.lookbackDays)) ||
        Number(pauseRule.maxCostPerResult) <= 0 ||
        Number(pauseRule.minSpend) < 0)
    ) {
      showToast({
        message: localize('com_ui_project_meta_ads_invalid_creative_rules'),
        status: 'error',
      });
      return;
    }
    if (ruleGroupDraft.scope === 'global') {
      setSettings({
        ...settings,
        rules: ruleGroupDraft.rules,
        creativeRules: ruleGroupDraft.creativeRules,
      });
      setRuleGroupDraft(null);
      return;
    }
    if (ruleGroupDraft.scope === 'override') {
      const targetKey = ruleGroupDraft.overrideKey;
      setSettings({
        ...settings,
        ruleOverrides: (settings.ruleOverrides ?? []).map((ruleOverride) =>
          getRuleOverrideKey(ruleOverride) === targetKey
            ? {
                ...ruleOverride,
                entityName: ruleGroupDraft.name.trim() || ruleGroupDraft.entityName,
                rules: ruleGroupDraft.rules,
                creativeRules: ruleGroupDraft.creativeRules,
              }
            : ruleOverride,
        ),
      });
      setRuleGroupDraft(null);
      return;
    }
    if (ruleGroupDraft.entityIds.length === 0) {
      showToast({
        message: localize('com_ui_project_meta_ads_rule_group_entities_required'),
        status: 'error',
      });
      return;
    }
    const nextGroup: MetaAdsRuleGroup = {
      id: ruleGroupDraft.id ?? `${ruleGroupDraft.entityLevel}-${Date.now()}`,
      name:
        ruleGroupDraft.name.trim() || localize('com_ui_project_meta_ads_rule_group_default_name'),
      entityLevel: ruleGroupDraft.entityLevel,
      entityIds: ruleGroupDraft.entityIds,
      enabled:
        ruleGroupDraft.id == null
          ? true
          : (settings.ruleGroups ?? []).find((group) => group.id === ruleGroupDraft.id)?.enabled,
      rules: ruleGroupDraft.rules,
      creativeRules: ruleGroupDraft.creativeRules,
    };
    const existingGroups = settings.ruleGroups ?? [];
    setSettings({
      ...settings,
      ruleGroups: ruleGroupDraft.id
        ? existingGroups.map((group) => (group.id === ruleGroupDraft.id ? nextGroup : group))
        : [...existingGroups, nextGroup],
    });
    setRuleGroupDraft(null);
  };

  return {
    ruleGroupDraft,
    ruleDraftEntityLabels,
    ruleDraftEntityOptions,
    ruleRows,
    canCreateRuleGroup,
    getEntityRuleLabel,
    setRuleGroupDraft,
    onOpenRuleGroupDraft,
    onEditGlobalRule,
    onEditRuleGroup,
    onEditRuleOverride,
    onToggleRuleRow,
    onDeleteRuleGroup,
    onDeleteRuleOverride,
    onRuleGroupRuleChange,
    onRuleGroupRuleTextChange,
    onRuleGroupEntityToggle,
    onAccountProfileChange,
    onRuleGroupCreativeRuleChange,
    onSaveRuleGroup,
  };
}
