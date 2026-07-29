import type { ProjectMetaAdsCampaignSummary } from 'librechat-data-provider';
import type { useLocalize } from '~/hooks';
import { defaultRules, getRuleOverrideKey } from './rules';
import type {
  MetaAdsRuleGroup,
  MetaAdsSettingsState,
  RuleGroupDraft,
  RuleGroupEntityOption,
  RuleRow,
} from './types';

type RulesStateInput = {
  settings: MetaAdsSettingsState;
  campaigns: ProjectMetaAdsCampaignSummary[];
  localize: ReturnType<typeof useLocalize>;
};

export function getMetaAdsEntityRuleLabel(
  settings: MetaAdsSettingsState,
  entityLevel: MetaAdsRuleGroup['entityLevel'],
  entityId: string,
  globalLabel: string,
  campaignId?: string,
) {
  const activeOverrides = (settings.ruleOverrides ?? []).filter(
    (override) => override.enabled !== false,
  );
  const adsetOverride =
    entityLevel === 'adset'
      ? activeOverrides.find(
          (override) => override.entityLevel === 'adset' && override.entityId === entityId,
        )
      : undefined;
  const campaignOverride = activeOverrides.find(
    (override) =>
      override.entityLevel === 'campaign' &&
      override.entityId === (entityLevel === 'campaign' ? entityId : campaignId),
  );
  const ruleGroup = settings.ruleGroups?.find((group) => {
    if (group.enabled === false || !Array.isArray(group.entityIds)) {
      return false;
    }
    return group.entityLevel === entityLevel
      ? group.entityIds.includes(entityId)
      : group.entityLevel === 'campaign' && group.entityIds.includes(campaignId ?? '');
  });

  return (
    adsetOverride?.entityName ||
    adsetOverride?.entityId ||
    campaignOverride?.entityName ||
    campaignOverride?.entityId ||
    ruleGroup?.name ||
    (settings.enabled ? globalLabel : '-')
  );
}

export function getMetaAdsEffectiveRules(
  settings: MetaAdsSettingsState,
  {
    campaignId,
    adsetId,
  }: {
    campaignId?: string;
    adsetId?: string;
  },
) {
  const ruleGroup = settings.ruleGroups?.find((group) => {
    if (group.enabled === false || !Array.isArray(group.entityIds)) {
      return false;
    }
    return group.entityLevel === 'campaign'
      ? group.entityIds.includes(campaignId ?? '')
      : group.entityIds.includes(adsetId ?? '');
  });
  const campaignOverride = settings.ruleOverrides?.find(
    (override) =>
      override.enabled !== false &&
      override.entityLevel === 'campaign' &&
      override.entityId === campaignId,
  );
  const adsetOverride = settings.ruleOverrides?.find(
    (override) =>
      override.enabled !== false &&
      override.entityLevel === 'adset' &&
      override.entityId === adsetId,
  );

  return {
    ...defaultRules,
    ...settings.rules,
    ...(ruleGroup?.rules ?? {}),
    ...(campaignOverride?.rules ?? {}),
    ...(adsetOverride?.rules ?? {}),
  };
}

export function getMetaAdsCampaignName(
  campaigns: ProjectMetaAdsCampaignSummary[],
  campaignId: string,
) {
  return (
    campaigns.find((campaign) => campaign.campaignId === campaignId)?.campaignName ?? campaignId
  );
}

export function getMetaAdsAdSetName(campaigns: ProjectMetaAdsCampaignSummary[], adSetId: string) {
  return (
    campaigns.flatMap((campaign) => campaign.adSets).find((adSet) => adSet.entityId === adSetId)
      ?.entityName ?? adSetId
  );
}

export function getMetaAdsRuleEntityLabel(
  campaigns: ProjectMetaAdsCampaignSummary[],
  entityLevel: MetaAdsRuleGroup['entityLevel'],
  entityId: string,
) {
  return entityLevel === 'campaign'
    ? getMetaAdsCampaignName(campaigns, entityId)
    : getMetaAdsAdSetName(campaigns, entityId);
}

export function getMetaAdsRuleDraftEntityLabels(
  draft: RuleGroupDraft | null,
  campaigns: ProjectMetaAdsCampaignSummary[],
) {
  if (!draft) {
    return [];
  }

  return draft.entityIds.map((entityId) =>
    getMetaAdsRuleEntityLabel(campaigns, draft.entityLevel, entityId),
  );
}

export function getMetaAdsRuleDraftEntityOptions(
  draft: RuleGroupDraft | null,
  campaigns: ProjectMetaAdsCampaignSummary[],
): RuleGroupEntityOption[] {
  if (!draft || draft.scope !== 'group') {
    return [];
  }
  const selectedIds = new Set(draft.entityIds);
  const options =
    draft.entityLevel === 'campaign'
      ? campaigns.map((campaign) => ({
          id: campaign.campaignId,
          label: campaign.campaignName ?? campaign.campaignId,
          selected: selectedIds.has(campaign.campaignId),
        }))
      : campaigns.flatMap((campaign) =>
          (campaign.adSets ?? []).map((adSet) => ({
            id: adSet.entityId,
            label: adSet.entityName ?? adSet.entityId,
            selected: selectedIds.has(adSet.entityId),
          })),
        );
  const optionIds = new Set(options.map((option) => option.id));
  const missingSelectedOptions = draft.entityIds
    .filter((entityId) => !optionIds.has(entityId))
    .map((entityId) => ({
      id: entityId,
      label: getMetaAdsRuleEntityLabel(campaigns, draft.entityLevel, entityId),
      selected: true,
    }));

  return [...missingSelectedOptions, ...options].sort((left, right) => {
    if (left.selected !== right.selected) {
      return left.selected ? -1 : 1;
    }
    return left.label.localeCompare(right.label);
  });
}

export function buildMetaAdsRuleRows({ settings, campaigns, localize }: RulesStateInput) {
  const getCampaignName = (campaignId: string) => getMetaAdsCampaignName(campaigns, campaignId);
  const getAdSetName = (adSetId: string) => getMetaAdsAdSetName(campaigns, adSetId);

  const globalRow: RuleRow = {
    key: 'global',
    type: 'global',
    enabled: settings.enabled ?? false,
    name: localize('com_ui_project_meta_ads_global_rules'),
    scopeLabel: localize('com_ui_project_meta_ads_scope_all_campaigns'),
    precedenceLabel: localize('com_ui_project_meta_ads_precedence_global'),
    entityIds: [],
    ruleAudit: settings.globalRuleAudit,
    rules: settings.rules,
    creativeRules: settings.creativeRules,
  };

  const groupRows = (settings.ruleGroups ?? []).map<RuleRow>((group) => ({
    key: `group:${group.id}`,
    type: 'group',
    enabled: group.enabled !== false,
    name: group.name,
    scopeLabel: `${
      group.entityLevel === 'campaign'
        ? localize('com_ui_project_meta_ads_level_campaign')
        : localize('com_ui_project_meta_ads_level_ad_set')
    } · ${group.entityIds?.length ?? 0}`,
    precedenceLabel: localize('com_ui_project_meta_ads_precedence_group'),
    entityLevel: group.entityLevel,
    entityIds: group.entityIds ?? [],
    ruleAudit: group.ruleAudit,
    group,
    rules: { ...defaultRules, ...(group.rules ?? {}) },
    creativeRules: { ...settings.creativeRules, ...(group.creativeRules ?? {}) },
  }));

  const overrideRows = (settings.ruleOverrides ?? []).map<RuleRow>((override) => {
    const isCampaign = override.entityLevel === 'campaign';
    const entityName = isCampaign
      ? getCampaignName(override.entityId)
      : getAdSetName(override.entityId);

    return {
      key: `override:${getRuleOverrideKey(override)}`,
      type: isCampaign ? 'campaign_override' : 'adset_override',
      enabled: override.enabled !== false,
      name: override.entityName || entityName,
      scopeLabel: `${
        isCampaign
          ? localize('com_ui_project_meta_ads_level_campaign')
          : localize('com_ui_project_meta_ads_level_ad_set')
      } · ${override.entityId}`,
      precedenceLabel: localize(
        isCampaign
          ? 'com_ui_project_meta_ads_precedence_campaign_override'
          : 'com_ui_project_meta_ads_precedence_adset_override',
      ),
      entityLevel: override.entityLevel,
      entityIds: [override.entityId],
      ruleAudit: override.ruleAudit,
      override,
      rules: { ...defaultRules, ...(override.rules ?? {}) },
      creativeRules: { ...settings.creativeRules, ...(override.creativeRules ?? {}) },
    };
  });

  return [globalRow, ...groupRows, ...overrideRows];
}
