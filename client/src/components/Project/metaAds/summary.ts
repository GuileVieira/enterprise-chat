import type {
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsObjectiveSummary,
} from 'librechat-data-provider';
import type {
  FrequencyAccumulator,
  MetaAdsSettingsState,
  ResultTypeSummary,
  SummaryResultTypeOption,
} from './types';

export function isEcommerceContext(
  settings: MetaAdsSettingsState,
  objectiveFilter: string,
  campaigns: ProjectMetaAdsCampaignSummary[],
) {
  if (settings.accountProfile === 'ecommerce' || settings.rules.targetResultType === 'purchase') {
    return true;
  }
  if (objectiveFilter === 'OUTCOME_SALES') {
    return true;
  }
  const visibleCampaigns =
    objectiveFilter === 'all'
      ? campaigns
      : campaigns.filter((campaign) => (campaign.objective || 'UNKNOWN') === objectiveFilter);
  return (
    visibleCampaigns.length > 0 &&
    visibleCampaigns.every((campaign) => campaign.objective === 'OUTCOME_SALES')
  );
}

export function calculateWeightedRoas(campaigns: ProjectMetaAdsCampaignSummary[]) {
  let weightedRoas = 0;
  let spendWeight = 0;
  for (const campaign of campaigns) {
    const roas = Number(campaign.roas);
    const spend = Number(campaign.spend);
    if (!Number.isFinite(roas) || !Number.isFinite(spend) || spend <= 0) {
      continue;
    }
    weightedRoas += roas * spend;
    spendWeight += spend;
  }
  return spendWeight > 0 ? Number((weightedRoas / spendWeight).toFixed(2)) : null;
}

export function collectBiResultTypes(campaigns: ProjectMetaAdsCampaignSummary[]) {
  const resultTypes = new Set<string>();
  for (const campaign of campaigns) {
    const fallbackAdSet = campaign.adSets?.find((adSet) => adSet.resultType);
    const fallbackAd = campaign.adSets
      ?.flatMap((adSet) => adSet.ads ?? [])
      .find((ad) => ad.resultType);
    resultTypes.add(
      campaign.resultType || fallbackAdSet?.resultType || fallbackAd?.resultType || 'UNKNOWN',
    );
  }
  return Array.from(resultTypes);
}

export function buildSummaryResultTypeOptions(
  objectiveSummaries: ProjectMetaAdsObjectiveSummary[],
  objectiveFilter: string,
  isEcommerce: boolean,
): SummaryResultTypeOption[] {
  const canonicalResultTypes: Record<string, string> = {
    leadgen_grouped: 'lead',
    offsite_conversion_fb_pixel_lead: 'lead',
    'offsite_conversion.fb_pixel_lead': 'lead',
    onsite_conversion_lead_grouped: 'lead',
    'onsite_conversion.lead_grouped': 'lead',
    omni_purchase: 'purchase',
    offsite_conversion_fb_pixel_purchase: 'purchase',
    'offsite_conversion.fb_pixel_purchase': 'purchase',
    onsite_conversion_messaging_first_reply: 'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.messaging_first_reply':
      'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.instagram_profile_visit': 'instagram_profile_visit',
    onsite_conversion_instagram_profile_visit: 'instagram_profile_visit',
    profile_visit: 'instagram_profile_visit',
    'onsite_conversion.instagram_profile_follow': 'instagram_profile_follow',
    onsite_conversion_instagram_profile_follow: 'instagram_profile_follow',
    profile_follow: 'instagram_profile_follow',
    instagram_profile_follows: 'instagram_profile_follow',
    ig_profile_follow: 'instagram_profile_follow',
    video_view: 'thruplay',
    video_thruplay: 'thruplay',
    video_thruplay_watched_actions: 'thruplay',
  };
  const allowedResultTypes = new Set([
    'instagram_profile_visit',
    'instagram_profile_follow',
    'lead',
    'leadgen_grouped',
    'link_click',
    'omni_purchase',
    'offsite_conversion.fb_pixel_lead',
    'offsite_conversion.fb_pixel_purchase',
    'onsite_conversion.lead_grouped',
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.messaging_first_reply',
    'profile_visit',
    'purchase',
    'thruplay',
    'video_view',
  ]);
  const options = new Map<string, SummaryResultTypeOption>();
  const summaries =
    objectiveFilter === 'all'
      ? objectiveSummaries
      : objectiveSummaries.filter(
          (summary) => (summary.objective || 'UNKNOWN') === objectiveFilter,
        );

  for (const summary of summaries) {
    for (const resultType of summary.resultTypes) {
      const rawResultTypeKey = resultType.resultType || 'UNKNOWN';
      const resultTypeKey = canonicalResultTypes[rawResultTypeKey] ?? rawResultTypeKey;
      if (isEcommerce && resultTypeKey !== 'purchase') {
        continue;
      }
      if (!allowedResultTypes.has(resultTypeKey)) {
        continue;
      }
      const option =
        options.get(resultTypeKey) ??
        ({
          resultType: resultTypeKey,
          totalSpend: 0,
          totalResults: 0,
          averageCostPerResult: null,
          spendKeys: new Set<string>(),
        } satisfies SummaryResultTypeOption);
      const spendKey = `${summary.objective || 'UNKNOWN'}:${Number(resultType.totalSpend ?? 0)}`;
      if (!option.spendKeys?.has(spendKey)) {
        option.totalSpend += Number(resultType.totalSpend ?? 0);
        option.spendKeys?.add(spendKey);
      }
      option.totalResults += Number(resultType.totalResults ?? 0);
      options.set(resultTypeKey, option);
    }
  }

  return Array.from(options.values())
    .map((option) => {
      const averageCostPerResult =
        option.totalResults > 0
          ? Number((option.totalSpend / option.totalResults).toFixed(2))
          : null;
      return {
        resultType: option.resultType,
        totalSpend: Number(option.totalSpend.toFixed(2)),
        totalResults: Number(option.totalResults.toFixed(2)),
        averageCostPerResult,
      };
    })
    .sort((left, right) => Number(right.totalResults ?? 0) - Number(left.totalResults ?? 0));
}

export function buildObjectiveSummaries(
  campaigns: ProjectMetaAdsCampaignSummary[],
): ProjectMetaAdsObjectiveSummary[] {
  const objectives = new Map<string, ProjectMetaAdsObjectiveSummary & ObjectiveSummaryDraft>();

  for (const campaign of campaigns) {
    const objective = campaign.objective || 'UNKNOWN';
    const summary = objectives.get(objective) ?? createObjectiveSummaryDraft(objective);
    objectives.set(objective, summary);

    const spend = Number(campaign.spend ?? 0);
    const results = Number(campaign.resultCount ?? 0);
    const impressions = Number(campaign.impressions ?? 0);
    const clicks = Number(campaign.clicks ?? 0);

    summary.campaignCount += 1;
    summary.totalSpend += Number.isFinite(spend) ? spend : 0;
    summary.totalResults = (summary.totalResults ?? 0) + (Number.isFinite(results) ? results : 0);
    summary.impressions += Number.isFinite(impressions) ? impressions : 0;
    summary.clicks += Number.isFinite(clicks) ? clicks : 0;
    addFrequencySample(summary, campaign.frequency, impressions);

    const sources = campaign.adSets.length > 0 ? campaign.adSets : [campaign];
    for (const source of sources) {
      addResultTypeSummary(
        summary.resultTypeMap,
        source.resultType || campaign.resultType || 'UNKNOWN',
        source.spend,
        source.resultCount,
        source.clicks,
        source.impressions,
      );
    }
  }

  return Array.from(objectives.values())
    .map((summary) => toObjectiveSummary(summary))
    .sort((left, right) => Number(right.totalSpend ?? 0) - Number(left.totalSpend ?? 0));
}

type ObjectiveSummaryDraft = FrequencyAccumulator & {
  impressions: number;
  clicks: number;
  resultTypeMap: Map<string, ResultTypeSummary>;
};

function createObjectiveSummaryDraft(
  objective: string,
): ProjectMetaAdsObjectiveSummary & ObjectiveSummaryDraft {
  return {
    objective,
    label: objective,
    campaignCount: 0,
    totalSpend: 0,
    totalResults: 0,
    averageCostPerResult: null,
    averageFrequency: null,
    averageCtr: null,
    resultTypes: [],
    impressions: 0,
    clicks: 0,
    frequencyWeightedTotal: 0,
    frequencyWeight: 0,
    frequencyTotal: 0,
    frequencyCount: 0,
    resultTypeMap: new Map(),
  };
}

export function addFrequencySample(
  target: FrequencyAccumulator,
  frequency: number | null | undefined,
  impressions: number | null | undefined,
) {
  const numericFrequency = Number(frequency);
  if (!Number.isFinite(numericFrequency)) {
    return;
  }
  const numericImpressions = Number(impressions);
  if (Number.isFinite(numericImpressions) && numericImpressions > 0) {
    target.frequencyWeightedTotal += numericFrequency * numericImpressions;
    target.frequencyWeight += numericImpressions;
    return;
  }
  target.frequencyTotal += numericFrequency;
  target.frequencyCount += 1;
}

export function resolveAverageFrequency(target: FrequencyAccumulator) {
  if (target.frequencyWeight > 0) {
    return Number((target.frequencyWeightedTotal / target.frequencyWeight).toFixed(2));
  }
  if (target.frequencyCount > 0) {
    return Number((target.frequencyTotal / target.frequencyCount).toFixed(2));
  }
  return null;
}

function addResultTypeSummary(
  resultTypeMap: Map<string, ResultTypeSummary>,
  resultType: string | undefined,
  spend: number | null | undefined,
  results: number | null | undefined,
  clicks: number | null | undefined,
  impressions: number | null | undefined,
) {
  const resultTypeKey = resultType || 'UNKNOWN';
  const resultTypeSummary = resultTypeMap.get(resultTypeKey) ?? {
    resultType: resultTypeKey,
    label: resultTypeKey,
    totalSpend: 0,
    totalResults: 0,
    averageCostPerResult: null,
    clicks: 0,
    impressions: 0,
    averageCtr: null,
  };
  resultTypeMap.set(resultTypeKey, resultTypeSummary);
  resultTypeSummary.totalSpend += Number(spend ?? 0);
  resultTypeSummary.totalResults += Number(results ?? 0);
  resultTypeSummary.clicks = Number(resultTypeSummary.clicks ?? 0) + Number(clicks ?? 0);
  resultTypeSummary.impressions =
    Number(resultTypeSummary.impressions ?? 0) + Number(impressions ?? 0);
}

function getCompatibleResultTotals(resultTypeMap: Map<string, ResultTypeSummary>) {
  if (resultTypeMap.size !== 1) {
    return {
      totalResults: null,
      averageCostPerResult: null,
    };
  }
  const [resultType] = Array.from(resultTypeMap.values());
  return {
    totalResults: Number(resultType.totalResults.toFixed(2)),
    averageCostPerResult:
      resultType.totalResults > 0
        ? Number((resultType.totalSpend / resultType.totalResults).toFixed(2))
        : null,
  };
}

function toObjectiveSummary(
  summary: ProjectMetaAdsObjectiveSummary & ObjectiveSummaryDraft,
): ProjectMetaAdsObjectiveSummary {
  const resultTypes = Array.from(summary.resultTypeMap.values()).map((resultType) => {
    const impressions = Number(resultType.impressions ?? 0);
    const clicks = Number(resultType.clicks ?? 0);
    const averageCtr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : null;
    const averageCostPerResult =
      resultType.totalResults > 0
        ? Number((resultType.totalSpend / resultType.totalResults).toFixed(2))
        : null;
    return {
      ...resultType,
      totalSpend: Number(resultType.totalSpend.toFixed(2)),
      totalResults: Number(resultType.totalResults.toFixed(2)),
      averageCostPerResult,
      averageCtr,
    };
  });
  const compatibleResults = getCompatibleResultTotals(summary.resultTypeMap);
  const averageCtr =
    summary.impressions > 0
      ? Number(((summary.clicks / summary.impressions) * 100).toFixed(2))
      : null;
  return {
    objective: summary.objective,
    label: summary.label,
    campaignCount: summary.campaignCount,
    totalSpend: Number(summary.totalSpend.toFixed(2)),
    totalResults: compatibleResults.totalResults,
    averageCostPerResult: compatibleResults.averageCostPerResult,
    averageFrequency: resolveAverageFrequency(summary),
    averageCtr,
    resultTypes: resultTypes.sort(
      (left, right) => Number(right.totalResults ?? 0) - Number(left.totalResults ?? 0),
    ),
  };
}
