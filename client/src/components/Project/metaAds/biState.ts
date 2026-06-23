import type {
  ProjectMetaAdsAdDiagnostics,
  ProjectMetaAdsCampaignSummary,
} from 'librechat-data-provider';
import type { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';
import { BI_TOP_LIMIT } from './constants';
import { defaultRules } from './rules';
import { getObjectiveLabel, getResultTypeLabel } from './formatters';
import { collectBiResultTypes } from './summary';
import { buildMetaAdsBiRankings, getSortedBiRankingItems } from './bi';
import type {
  BiRankingSort,
  MetaAdsBiControls,
  MetaAdsBiRankItem,
  MetaAdsSettingsState,
} from './types';

type BiStateInput = {
  campaigns: ProjectMetaAdsCampaignSummary[];
  biCampaigns: ProjectMetaAdsCampaignSummary[];
  settings: MetaAdsSettingsState;
  controls: MetaAdsBiControls;
  sort: BiRankingSort;
  rankingItems: MetaAdsBiRankItem[];
  adDiagnostics: ProjectMetaAdsAdDiagnostics | undefined;
  localize: ReturnType<typeof useLocalize>;
};

export function buildMetaAdsBiState({
  campaigns,
  biCampaigns,
  settings,
  controls,
  sort,
  rankingItems,
  adDiagnostics,
  localize,
}: BiStateInput) {
  const objectiveOptions = Array.from(
    new Set(campaigns.map((campaign) => campaign.objective || 'UNKNOWN')),
  ).sort((left, right) =>
    getObjectiveLabel(left, localize).localeCompare(getObjectiveLabel(right, localize), 'pt-BR'),
  );
  const biResultTypeOptions = collectBiResultTypes(biCampaigns).sort((left, right) =>
    getResultTypeLabel(left, localize).localeCompare(getResultTypeLabel(right, localize), 'pt-BR'),
  );
  const biMinSpend = Number(settings.rules.minSpend || defaultRules.minSpend);
  const fallbackBiRankings = buildMetaAdsBiRankings(
    biCampaigns,
    controls.objective,
    controls.resultType,
    Number.isFinite(biMinSpend) && biMinSpend > 0 ? biMinSpend : defaultRules.minSpend,
  );
  const selectedBiRankingItems = getSortedBiRankingItems(
    rankingItems.length > 0 ? rankingItems : getFallbackRankingItems(fallbackBiRankings, controls),
    sort,
  ).slice(0, BI_TOP_LIMIT);

  return {
    objectiveOptions,
    biResultTypeOptions,
    selectedBiRankingItems,
    selectedBiRankingTitleKey: getBiRankingTitleKey(controls),
    selectedBiRankingTestId: getBiRankingTestId(controls),
    adRankingEmptyMessageKey: getAdRankingEmptyMessageKey(adDiagnostics),
  };
}

function getFallbackRankingItems(
  fallbackBiRankings: ReturnType<typeof buildMetaAdsBiRankings>,
  controls: MetaAdsBiControls,
) {
  if (controls.level === 'campaign') {
    return fallbackBiRankings.campaigns;
  }
  if (controls.level === 'adset') {
    return fallbackBiRankings.adSets;
  }
  return fallbackBiRankings.ads;
}

function getBiRankingTitleKey(controls: MetaAdsBiControls): TranslationKeys {
  if (controls.level === 'campaign') {
    return 'com_ui_project_meta_ads_bi_top_campaigns';
  }
  if (controls.level === 'adset') {
    return 'com_ui_project_meta_ads_bi_top_adsets';
  }
  return 'com_ui_project_meta_ads_bi_top_ads';
}

function getBiRankingTestId(controls: MetaAdsBiControls) {
  if (controls.level === 'campaign') {
    return 'meta-ads-bi-campaigns';
  }
  if (controls.level === 'adset') {
    return 'meta-ads-bi-adsets';
  }
  return 'meta-ads-bi-ads';
}

function getAdRankingEmptyMessageKey(
  adDiagnostics: ProjectMetaAdsAdDiagnostics | undefined,
): TranslationKeys {
  if (adDiagnostics?.adInsightsFetched === 0) {
    return 'com_ui_project_meta_ads_bi_no_ad_insights';
  }
  if (
    adDiagnostics &&
    adDiagnostics.adInsightsFetched > 0 &&
    adDiagnostics.adsAttachedToAdSets === 0
  ) {
    return 'com_ui_project_meta_ads_bi_no_attached_ads';
  }
  return 'com_ui_project_meta_ads_bi_no_rankings';
}
