import { Fragment, useState } from 'react';
import type {
  ProjectMetaAdsTrendSeries,
  ProjectMetaAdsEvolutionDelta,
} from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';

import {
  formatMetric,
  formatMoney,
  formatTrendDate,
  formatIntegerMetric,
  shouldShowTrendLabel,
  getEvolutionMetricLabel,
  formatEvolutionMetricValue,
} from './formatters';
import { MetaAdsNameTooltip } from './overviewCells';
import { MetaAdsEvolutionDeltaTables } from './evolutionDeltaTables';
import type { EvolutionHoverPoint, EvolutionMetric, Localize, MetaAdsBiRankLevel } from './types';

type EvolutionPoint = {
  x: number;
  y: number;
  value: number;
  date: string;
  rawPoint?: ProjectMetaAdsTrendSeries['points'][number];
};

type EvolutionSeriesPath = {
  series: ProjectMetaAdsTrendSeries & { total: number };
  color: string;
  points: EvolutionPoint[];
  path: string;
};

const chartWidth = 480;
const chartHeight = 160;
const chartPadding = 18;
const chartBottom = chartHeight - chartPadding;

function getEvolutionTooltipTransform(point: EvolutionHoverPoint) {
  const ratio = point.x / chartWidth;
  if (ratio < 0.18) {
    return 'translate(0, calc(-100% - 10px))';
  }
  if (ratio > 0.82) {
    return 'translate(-100%, calc(-100% - 10px))';
  }
  return 'translate(-50%, calc(-100% - 10px))';
}

function MetricSummaryCard({
  labelKey,
  value,
  localize,
}: {
  labelKey: TranslationKeys;
  value: string;
  localize: Localize;
}) {
  return (
    <div className="rounded-xl border border-slate-200/75 bg-slate-50/75 p-3 dark:border-white/10 dark:bg-white/[0.035]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {localize(labelKey)}
      </div>
      <div
        className="mt-1 truncate font-mono text-sm font-semibold text-slate-900 dark:text-white"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function EvolutionTooltip({
  point,
  metric,
  currency,
  localize,
}: {
  point: EvolutionHoverPoint;
  metric: EvolutionMetric;
  currency: string;
  localize: Localize;
}) {
  return (
    <div
      data-testid="meta-ads-evolution-point-tooltip"
      className="pointer-events-none absolute z-[1000] min-w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-[0_18px_60px_-32px_rgba(15,23,42,0.45)] dark:border-teal-300/25 dark:bg-[#101827] dark:text-teal-100 dark:shadow-xl"
      style={{
        left: `${(point.x / chartWidth) * 100}%`,
        top: `${(point.y / chartHeight) * 100}%`,
        maxWidth: 'min(18rem, calc(100% - 1rem))',
        overflowWrap: 'anywhere',
        transform: getEvolutionTooltipTransform(point),
      }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0"
          style={{ backgroundColor: point.color }}
        />
        <span className="truncate font-semibold text-slate-950 dark:text-white">
          {point.entityName}
        </span>
      </div>
      {point.parentCampaignName && (
        <div className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-300">
          {point.parentCampaignName}
        </div>
      )}
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono">
        <span className="text-slate-500 dark:text-slate-400">{formatTrendDate(point.date)}</span>
        <span className="text-right text-slate-950 dark:text-white">
          {formatEvolutionMetricValue(point.value, metric, currency)}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_results')}
        </span>
        <span className="text-right text-slate-950 dark:text-white">
          {formatMetric(point.point?.resultCount)}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_spend')}
        </span>
        <span className="text-right text-slate-950 dark:text-white">
          {formatMoney(point.point?.spend, currency)}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_cpa')}
        </span>
        <span className="text-right text-slate-950 dark:text-white">
          {formatMoney(point.point?.cpa, currency)}
        </span>
      </div>
    </div>
  );
}

export function MetaAdsEvolutionDashboard({
  level,
  metric,
  seriesPaths,
  dates,
  maxValue,
  totalBudgetChangeCount,
  bestEvolution,
  evolutionAlerts,
  currency,
  localize,
  cleanName,
}: {
  level: MetaAdsBiRankLevel;
  metric: EvolutionMetric;
  seriesPaths: EvolutionSeriesPath[];
  dates: string[];
  maxValue: number;
  totalBudgetChangeCount: number;
  bestEvolution: ProjectMetaAdsEvolutionDelta[];
  evolutionAlerts: ProjectMetaAdsEvolutionDelta[];
  currency: string;
  localize: Localize;
  cleanName: (value: string | undefined, fallback: string) => string;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<EvolutionHoverPoint | null>(null);
  const canRenderSeries = seriesPaths.length > 0 && dates.length > 1 && maxValue > 0;
  const allMetricCards = [
    ['com_ui_project_meta_ads_metric', getEvolutionMetricLabel(metric, localize)],
    ['com_ui_project_meta_ads_series', formatIntegerMetric(seriesPaths.length)],
    ['com_ui_project_meta_ads_peak_value', formatEvolutionMetricValue(maxValue, metric, currency)],
    ['com_ui_project_meta_ads_budget_changes', formatIntegerMetric(totalBudgetChangeCount)],
  ] satisfies Array<[TranslationKeys, string]>;
  const metricCards = allMetricCards.filter(
    ([labelKey]): boolean =>
      level !== 'ad' || labelKey !== 'com_ui_project_meta_ads_budget_changes',
  );

  return (
    <div className="px-4 pb-4">
      <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
        {localize('com_ui_project_meta_ads_evolution_analysis')}
      </h4>
      <div data-testid="meta-ads-evolution-dashboard" className="grid gap-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_18px_58px_-46px_rgba(15,23,42,0.42)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
                {localize('com_ui_project_meta_ads_evolution_comparison')}
              </h5>
              <p className="mt-1 max-w-[62ch] text-xs leading-5 text-slate-500 dark:text-slate-400">
                {localize('com_ui_project_meta_ads_evolution_comparison_hint')}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {metricCards.map(([labelKey, value]) => (
              <MetricSummaryCard
                key={labelKey}
                labelKey={labelKey}
                value={value}
                localize={localize}
              />
            ))}
          </div>
          <div className="relative mt-4 h-56 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-2 dark:border-white/10 dark:bg-slate-950/20">
            {canRenderSeries ? (
              <svg
                data-testid="meta-ads-evolution-chart"
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                role="img"
                aria-label={localize('com_ui_project_meta_ads_evolution_comparison')}
                className="h-full w-full text-slate-700 dark:text-slate-100"
                preserveAspectRatio="none"
              >
                {[0.25, 0.5, 0.75].map((line) => (
                  <line
                    key={line}
                    x1={chartPadding}
                    x2={chartWidth - chartPadding}
                    y1={chartBottom - line * (chartHeight - chartPadding * 2)}
                    y2={chartBottom - line * (chartHeight - chartPadding * 2)}
                    stroke="currentColor"
                    strokeOpacity="0.08"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {seriesPaths.map((seriesPath) => (
                  <Fragment key={seriesPath.series.entityId}>
                    <path
                      d={seriesPath.path}
                      fill="none"
                      stroke={seriesPath.color}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </Fragment>
                ))}
              </svg>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                {localize('com_ui_project_meta_ads_insufficient_evolution')}
              </div>
            )}
            {canRenderSeries &&
              seriesPaths.flatMap((seriesPath) =>
                seriesPath.points.map((point) => {
                  const entityName = cleanName(
                    seriesPath.series.entityName,
                    seriesPath.series.entityId,
                  );
                  const hoverPoint: EvolutionHoverPoint = {
                    seriesId: seriesPath.series.entityId,
                    entityName,
                    parentCampaignName: seriesPath.series.parentCampaignName,
                    date: point.date,
                    value: point.value,
                    x: point.x,
                    y: point.y,
                    color: seriesPath.color,
                    point: point.rawPoint,
                  };
                  return (
                    <button
                      key={`${seriesPath.series.entityId}:${point.date}`}
                      type="button"
                      data-testid="meta-ads-evolution-point"
                      data-date={point.date}
                      data-entity-id={seriesPath.series.entityId}
                      aria-label={`${entityName} ${formatTrendDate(point.date)}`}
                      className="absolute z-20 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full outline-none transition duration-150 hover:scale-125 focus:ring-2 focus:ring-teal-300/60"
                      style={{
                        left: `${(point.x / chartWidth) * 100}%`,
                        top: `${(point.y / chartHeight) * 100}%`,
                      }}
                      onMouseEnter={() => setHoveredPoint(hoverPoint)}
                      onMouseLeave={() => setHoveredPoint(null)}
                      onFocus={() => setHoveredPoint(hoverPoint)}
                      onBlur={() => setHoveredPoint(null)}
                    >
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_2px_rgba(15,23,42,0.9)]"
                        style={{ backgroundColor: seriesPath.color }}
                      />
                    </button>
                  );
                }),
              )}
            {hoveredPoint && canRenderSeries && (
              <EvolutionTooltip
                point={hoveredPoint}
                metric={metric}
                currency={currency}
                localize={localize}
              />
            )}
          </div>
          <div className="mt-2 flex justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            {dates.map((date, index) =>
              shouldShowTrendLabel(index, dates.length) ? (
                <span key={date} className="font-mono">
                  {formatTrendDate(date)}
                </span>
              ) : null,
            )}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {seriesPaths.map((seriesPath) => {
              const name = cleanName(seriesPath.series.entityName, seriesPath.series.entityId);
              return (
                <div
                  key={seriesPath.series.entityId}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200/75 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.035]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0"
                      style={{ backgroundColor: seriesPath.color }}
                    />
                    <div className="min-w-0">
                      <div className="group relative min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                          {name}
                        </div>
                        <MetaAdsNameTooltip value={name} />
                      </div>
                      {seriesPath.series.parentCampaignName && (
                        <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                          {cleanName(
                            seriesPath.series.parentCampaignName,
                            seriesPath.series.parentCampaignName,
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                    {formatEvolutionMetricValue(seriesPath.series.total, metric, currency)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <MetaAdsEvolutionDeltaTables
          bestEvolution={bestEvolution}
          evolutionAlerts={evolutionAlerts}
          currency={currency}
          localize={localize}
          cleanName={cleanName}
        />
      </div>
    </div>
  );
}
