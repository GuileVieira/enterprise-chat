import type { ReactNode } from 'react';
import { OGDialog, OGDialogTitle, OGDialogHeader, OGDialogContent } from '@librechat/client';
import type { ProjectMetaAdsAdSummary } from 'librechat-data-provider';
import type { Localize, MetaAdsBiRankItem } from './types';
import type { TranslationKeys } from '~/hooks';
import {
  formatMoney,
  formatMetric,
  formatPercent,
  getObjectiveLabel,
  formatRankingCost,
  getResultTypeLabel,
  formatIntegerMetric,
} from './formatters';
import { getRankEfficiency, getAdThumbnailUrl } from './bi';

type MetaAdsDialogChrome = {
  modalShellClassName: string;
  modalHeaderClassName: string;
  modalTileClassName: string;
};

export function MetaAdsAdPreviewDialog({
  ad,
  currency,
  localize,
  metricsFullscreen,
  onClose,
  chrome,
}: {
  ad: ProjectMetaAdsAdSummary | null;
  currency: string;
  localize: Localize;
  metricsFullscreen: boolean;
  onClose: () => void;
  chrome: MetaAdsDialogChrome;
}) {
  const fullscreenLayerProps = metricsFullscreen
    ? {
        overlayStyle: { zIndex: 10010 },
        style: { zIndex: 10020 },
      }
    : {};

  return (
    <OGDialog
      open={Boolean(ad)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      {ad && (
        <OGDialogContent
          className={`max-w-3xl p-0 ${chrome.modalShellClassName}`}
          {...fullscreenLayerProps}
        >
          <OGDialogHeader className={chrome.modalHeaderClassName}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_ad_preview')}
            </div>
            <OGDialogTitle className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
              {ad.adName ?? ad.title ?? ad.adId}
            </OGDialogTitle>
            <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {ad.adId}
            </div>
          </OGDialogHeader>
          <div className="grid gap-0 bg-white dark:bg-[#101827] sm:grid-cols-[minmax(220px,280px)_1fr]">
            <div className="border-b border-slate-200/75 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/[0.035] sm:border-b-0 sm:border-r">
              <AdPreviewMedia ad={ad} localize={localize} />
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {getAdPreviewMetrics(ad, currency).map(([labelKey, value]) => (
                  <MetricTile
                    key={labelKey}
                    labelKey={labelKey}
                    value={value}
                    localize={localize}
                    className={chrome.modalTileClassName}
                  />
                ))}
              </div>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {getAdPreviewFields(ad).map(([labelKey, value]) => (
                  <div
                    key={labelKey}
                    className="flex items-start justify-between gap-3 border-b border-slate-200/75 py-2 dark:border-white/10"
                  >
                    <span className="shrink-0 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      {localize(labelKey)}
                    </span>
                    <span className="min-w-0 text-right font-medium text-slate-950 dark:text-white">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </OGDialogContent>
      )}
    </OGDialog>
  );
}

export function MetaAdsBiRankDetailsDialog({
  item,
  currency,
  localize,
  renderRankMedia,
  cleanName,
  onClose,
  chrome,
}: {
  item: MetaAdsBiRankItem | null;
  currency: string;
  localize: Localize;
  renderRankMedia: (item: MetaAdsBiRankItem, size: 'sm' | 'lg') => ReactNode;
  cleanName: (value: string | undefined, fallback: string) => string;
  onClose: () => void;
  chrome: MetaAdsDialogChrome;
}) {
  return (
    <OGDialog
      open={Boolean(item)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      {item && (
        <OGDialogContent className={`max-w-2xl p-0 ${chrome.modalShellClassName}`}>
          <OGDialogHeader className={chrome.modalHeaderClassName}>
            <div className="flex gap-4">
              {renderRankMedia(item, 'lg')}
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {localize('com_ui_project_meta_ads_bi_rank_detail')}
                </div>
                <OGDialogTitle className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
                  {cleanName(item.name, item.id)}
                </OGDialogTitle>
                {item.parentName && (
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {cleanName(item.parentName, item.parentName)}
                  </div>
                )}
              </div>
            </div>
          </OGDialogHeader>
          <div className="bg-white p-5 dark:bg-[#101827]">
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  [
                    'com_ui_project_meta_ads_cost_per_result',
                    formatRankingCost(getRankEfficiency(item), currency),
                  ],
                  ['com_ui_project_meta_ads_results', formatMetric(item.resultCount)],
                  ['com_ui_project_meta_ads_spend', formatMoney(item.spend, currency)],
                ] satisfies Array<[TranslationKeys, string]>
              ).map(([labelKey, value]) => (
                <MetricTile
                  key={labelKey}
                  labelKey={labelKey}
                  value={value}
                  localize={localize}
                  className={chrome.modalTileClassName}
                />
              ))}
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
              {getBiRankDetails(item, localize).map(([labelKey, value]) => (
                <div
                  key={labelKey}
                  className="flex items-center justify-between gap-3 border-b border-slate-200/75 py-2 dark:border-white/10"
                >
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {localize(labelKey)}
                  </span>
                  <span className="text-right font-medium text-slate-950 dark:text-white">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </OGDialogContent>
      )}
    </OGDialog>
  );
}

function AdPreviewMedia({ ad, localize }: { ad: ProjectMetaAdsAdSummary; localize: Localize }) {
  const thumbnailUrl = getAdThumbnailUrl(ad);
  return (
    <button
      type="button"
      aria-label={localize(
        ad.adsManagerUrl
          ? 'com_ui_project_meta_ads_open_meta_ads'
          : 'com_ui_project_meta_ads_manager_unavailable',
      )}
      title={localize(
        ad.adsManagerUrl
          ? 'com_ui_project_meta_ads_open_meta_ads'
          : 'com_ui_project_meta_ads_manager_unavailable',
      )}
      disabled={!ad.adsManagerUrl}
      onClick={() => {
        if (!ad.adsManagerUrl) {
          return;
        }
        window.open(ad.adsManagerUrl, '_blank', 'noopener,noreferrer');
      }}
      className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 text-left transition hover:border-teal-300/60 focus:outline-none focus:ring-2 focus:ring-teal-300/60 disabled:cursor-not-allowed disabled:hover:border-slate-200/80 dark:border-white/10 dark:bg-slate-950/35 dark:disabled:hover:border-white/10"
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={ad.adName ?? ad.title ?? ad.adId}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_no_creative_media')}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-black/75 px-3 py-2 text-xs font-semibold text-white">
        {localize(
          ad.adsManagerUrl
            ? 'com_ui_project_meta_ads_open_meta_ads'
            : 'com_ui_project_meta_ads_manager_unavailable',
        )}
      </div>
    </button>
  );
}

function MetricTile({
  labelKey,
  value,
  localize,
  className,
}: {
  labelKey: TranslationKeys;
  value: string;
  localize: Localize;
  className: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {localize(labelKey)}
      </div>
      <div className="mt-2 font-mono text-base font-semibold text-slate-950 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function getAdPreviewMetrics(
  ad: ProjectMetaAdsAdSummary,
  currency: string,
): Array<[TranslationKeys, string]> {
  return [
    ['com_ui_project_meta_ads_spend', formatMoney(ad.spend, ad.currency ?? currency)],
    ['com_ui_project_meta_ads_cpa', formatMoney(ad.cpa, ad.currency ?? currency)],
    ['com_ui_project_meta_ads_results', formatMetric(ad.resultCount)],
    ['com_ui_project_meta_ads_ctr', formatPercent(ad.ctr)],
    ['com_ui_project_meta_ads_clicks', formatIntegerMetric(ad.clicks)],
    ['com_ui_project_meta_ads_frequency', formatMetric(ad.frequency)],
    ['com_ui_project_meta_ads_impressions', formatIntegerMetric(ad.impressions)],
  ];
}

function getAdPreviewFields(ad: ProjectMetaAdsAdSummary): Array<[TranslationKeys, string]> {
  return [
    ['com_ui_project_meta_ads_title_text', ad.title],
    ['com_ui_project_meta_ads_body_text', ad.body],
    ['com_ui_project_meta_ads_description_text', ad.description],
    ['com_ui_project_meta_ads_link_url', ad.linkUrl],
    ['com_ui_project_meta_ads_call_to_action', ad.callToActionType],
  ].filter((field): field is [TranslationKeys, string] => Boolean(field[1]));
}

function getBiRankDetails(
  item: MetaAdsBiRankItem,
  localize: Localize,
): Array<[TranslationKeys, string]> {
  return [
    ['com_ui_project_meta_ads_level', getBiRankLevelLabel(item, localize)],
    ['com_ui_project_meta_ads_objective', getObjectiveLabel(item.objective, localize)],
    ['com_ui_project_meta_ads_target_result_type', getResultTypeLabel(item.resultType, localize)],
    ['com_ui_project_meta_ads_ctr', formatPercent(item.ctr)],
  ];
}

function getBiRankLevelLabel(item: MetaAdsBiRankItem, localize: Localize) {
  if (item.level === 'campaign') {
    return localize('com_ui_project_meta_ads_level_campaign');
  }
  if (item.level === 'adset') {
    return localize('com_ui_project_meta_ads_level_ad_set');
  }
  return localize('com_ui_project_meta_ads_level_ad');
}
