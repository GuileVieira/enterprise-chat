import type { ProjectMetaAdsCampaignSummary } from 'librechat-data-provider';
import type { useLocalize } from '~/hooks';
import { defaultRules, getRuleOverrideKey } from './rules';
import type { MetaAdsRuleGroup, MetaAdsSettingsState, RuleGroupDraft, RuleRow } from './types';

type RulesStateInput = {
  settings: MetaAdsSettingsState;
  campaigns: ProjectMetaAdsCampaignSummary[];
  localize: ReturnType<typeof useLocalize>;
};

export function getMetaAdsEntityRuleLabel(
  settings: MetaAdsSettingsState,
  entityLevel: MetaAdsRuleGroup['entityLevel'],
  entityId: string,
) {
  return (
    settings.ruleGroups?.find(
      (group) => group.entityLevel === entityLevel && group.entityIds?.includes(entityId),
    )?.name ?? '-'
  );
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

export function buildMetaAdsRuleRows({ settings, campaigns, localize }: RulesStateInput) {
  const getCampaignName = (campaignId: string) => getMetaAdsCampaignName(campaigns, campaignId);
  const getAdSetName = (adSetId: string) => getMetaAdsAdSetName(campaigns, adSetId);

  const globalRow: RuleRow = {
    key: 'global',
    type: 'global',
    enabled: settings.enabled,
    name: localize('com_ui_project_meta_ads_global_rules'),
    scopeLabel: localize('com_ui_project_meta_ads_scope_all_campaigns'),
    precedenceLabel: localize('com_ui_project_meta_ads_precedence_global'),
    entityIds: [],
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
    group,
    rules: { ...defaultRules, ...(group.rules ?? {}) },
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
      override,
      rules: { ...defaultRules, ...(override.rules ?? {}) },
    };
  });

  return [globalRow, ...groupRows, ...overrideRows];
}
