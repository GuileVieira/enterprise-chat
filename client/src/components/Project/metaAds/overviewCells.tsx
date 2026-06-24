import type { MouseEvent } from 'react';
import { ArrowSquareOut } from '@phosphor-icons/react';
import type {
  ProjectMetaAdsAdSummary,
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsEntityStatusLevel,
} from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';

import { getAdThumbnailUrl } from './bi';
import { formatIntegerMetric, formatMetric, formatMoney } from './formatters';
import type { Localize, TableColumn } from './types';

export type EntityStatusConfirmationPayload = {
  entityLevel: ProjectMetaAdsEntityStatusLevel;
  entityId: string;
  entityName?: string;
  status?: string;
};

export function getMetaAdsTableRowClass(
  rowIndex: number,
  level: 'campaign' | 'adset' | 'ad',
  isClickable = false,
) {
  const stripeClass =
    rowIndex % 2 === 0
      ? 'bg-white/75 dark:bg-white/[0.035]'
      : 'bg-slate-50/70 dark:bg-white/[0.06]';
  let levelClass = 'text-slate-500 dark:text-slate-400';

  if (level === 'campaign') {
    levelClass = 'font-semibold text-slate-950 dark:text-white';
  } else if (level === 'adset') {
    levelClass = 'text-slate-700 dark:text-slate-300';
  }

  const cursorClass = isClickable ? 'cursor-pointer' : '';

  return `group ${cursorClass} ${stripeClass} ${levelClass} border-b border-slate-200/70 transition-colors duration-200 hover:bg-teal-50/70 dark:border-white/5 dark:hover:bg-teal-300/[0.08]`;
}

export function MetaAdsEmptyCell({ column }: { column: TableColumn }) {
  return (
    <td
      key={column.key}
      className={`px-2 py-2 ${
        column.align === 'right' ? 'text-right font-mono tabular-nums' : ''
      } text-slate-400 dark:text-slate-600`}
    >
      -
    </td>
  );
}

export function MetaAdsFrequencyValue({
  source,
  localize,
}: {
  source: { frequency?: number | null; impressions?: number | null; reach?: number | null };
  localize: Localize;
}) {
  const hasAuditMetrics = source.impressions != null && source.reach != null;
  const title = hasAuditMetrics
    ? `${localize('com_ui_project_meta_ads_impressions')}: ${formatIntegerMetric(
        source.impressions,
      )} / ${localize('com_ui_project_meta_ads_reach')}: ${formatIntegerMetric(source.reach)}`
    : undefined;

  return <span title={title}>{formatMetric(source.frequency)}</span>;
}

export function MetaAdsLevelCell({
  column,
  labelKey,
  localize,
}: {
  column: TableColumn;
  labelKey: TranslationKeys;
  localize: Localize;
}) {
  return (
    <td key={column.key} className="px-3 py-3 text-slate-500 dark:text-slate-400">
      <span className="inline-flex rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] dark:border-white/10 dark:bg-white/[0.055]">
        {localize(labelKey)}
      </span>
    </td>
  );
}

export function MetaAdsNameTooltip({ value }: { value: string }) {
  return (
    <span
      aria-hidden="true"
      data-tooltip={value}
      className="pointer-events-none absolute bottom-full left-0 z-[1000] mb-2 hidden max-w-[640px] whitespace-normal rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium leading-5 text-slate-800 shadow-xl group-focus-within:block group-hover:block dark:border-teal-300/25 dark:bg-[#101827] dark:text-teal-100"
    >
      {value}
    </span>
  );
}

export function MetaAdsEvolutionNameCell({ name }: { name: string }) {
  return (
    <td className="max-w-64 px-3 py-2.5 text-sm font-medium text-slate-900 focus-within:z-50 hover:z-50 dark:text-white">
      <div className="group relative min-w-0">
        <div className="truncate">{name}</div>
        <MetaAdsNameTooltip value={name} />
      </div>
    </td>
  );
}

function MetaAdsStatusBadge({ status }: { status?: string }) {
  const normalizedStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';

  if (!normalizedStatus || normalizedStatus === 'ACTIVE') {
    return null;
  }

  return (
    <span className="ml-2 inline-flex shrink-0 border border-rose-300/30 bg-rose-500/10 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-100">
      {normalizedStatus}
    </span>
  );
}

export function MetaAdsBudgetBadge({
  value,
  currency,
  canUseMetaAdsActions,
  onClick,
}: {
  value: number | null | undefined;
  currency: string;
  canUseMetaAdsActions: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.7)]" />
      <span>{formatMoney(value, currency)}</span>
    </>
  );

  if (!onClick) {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-slate-800 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.55)] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={!canUseMetaAdsActions}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-amber-300/45 bg-amber-300/10 px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-amber-900 shadow-[0_14px_30px_-24px_rgba(245,158,11,0.75)] transition duration-200 hover:-translate-y-0.5 hover:border-amber-300/70 hover:bg-amber-300/15 focus:outline-none focus:ring-2 focus:ring-amber-300/40 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 dark:border-amber-300/25 dark:bg-amber-300/[0.08] dark:text-[#fff3d7] dark:shadow-[0_12px_26px_-22px_rgba(245,158,11,0.95)] dark:hover:border-amber-300/60 dark:hover:bg-amber-300/[0.14]"
    >
      {content}
    </button>
  );
}

export function MetaAdsEntityStatusToggleCell({
  entityLevel,
  entityId,
  entityName,
  status,
  stickyCellClassName,
  canUseMetaAdsActions,
  updating,
  localize,
  onOpenConfirmation,
}: EntityStatusConfirmationPayload & {
  stickyCellClassName: string;
  canUseMetaAdsActions: boolean;
  updating: boolean;
  localize: Localize;
  onOpenConfirmation: (
    event: MouseEvent<HTMLElement>,
    payload: EntityStatusConfirmationPayload,
  ) => void;
}) {
  const normalizedStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';
  const isActive = normalizedStatus === 'ACTIVE';
  const canToggle = isActive || normalizedStatus === 'PAUSED';
  const labelKey: TranslationKeys = isActive
    ? 'com_ui_project_meta_ads_deactivate_ad'
    : 'com_ui_project_meta_ads_activate_ad';

  return (
    <td
      key="adStatus"
      className={`sticky left-20 z-30 px-2 py-2 align-middle ${stickyCellClassName}`}
    >
      {canToggle && (
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          aria-label={localize(labelKey)}
          title={localize(labelKey)}
          disabled={!canUseMetaAdsActions || updating}
          onClick={(event) =>
            onOpenConfirmation(event, { entityLevel, entityId, entityName, status })
          }
          className={`relative inline-flex h-5 w-9 items-center rounded-full border transition duration-200 focus:outline-none focus:ring-2 focus:ring-teal-300/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${
            isActive
              ? 'border-teal-300/60 bg-teal-400/25 hover:border-teal-200/70 hover:bg-teal-400/30'
              : 'border-slate-300 bg-slate-200/70 hover:border-rose-300/45 hover:bg-rose-100 dark:border-white/15 dark:bg-white/[0.055] dark:hover:border-rose-200/35 dark:hover:bg-rose-300/10'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-3.5 w-3.5 rounded-full bg-white shadow-[0_4px_12px_-8px_rgba(0,0,0,0.9)] transition duration-200 dark:bg-slate-50 ${
              isActive ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      )}
    </td>
  );
}

export function MetaAdsCampaignNameCell({
  campaign,
  stickyCellClassName,
}: {
  campaign: ProjectMetaAdsCampaignSummary;
  stickyCellClassName: string;
}) {
  const name = campaign.campaignName ?? campaign.campaignId;

  return (
    <td
      key="name"
      className={`sticky left-32 z-30 border-l-2 border-teal-300 px-3 py-3 font-semibold text-slate-950 focus-within:z-50 hover:z-50 dark:text-white ${stickyCellClassName}`}
    >
      <div className="group relative min-w-0">
        <div className="truncate">
          {name}
          <MetaAdsStatusBadge status={campaign.status} />
        </div>
        <MetaAdsNameTooltip value={name} />
      </div>
    </td>
  );
}

export function MetaAdsAdSetNameCell({
  adset,
  stickyCellClassName,
}: {
  adset: ProjectMetaAdsCampaignSummary['adSets'][number];
  stickyCellClassName: string;
}) {
  const name = adset.entityName ?? adset.entityId;

  return (
    <td
      key="name"
      className={`sticky left-32 z-30 border-l-2 border-teal-300/35 px-3 py-3 pl-6 text-slate-700 focus-within:z-50 hover:z-50 dark:text-slate-200 ${stickyCellClassName}`}
    >
      <div className="group relative min-w-0">
        <div className="truncate">
          {name}
          <MetaAdsStatusBadge status={adset.status} />
        </div>
        <MetaAdsNameTooltip value={name} />
      </div>
    </td>
  );
}

export function MetaAdsAdNameCell({
  ad,
  stickyCellClassName,
  localize,
  onPreview,
}: {
  ad: ProjectMetaAdsAdSummary;
  stickyCellClassName: string;
  localize: Localize;
  onPreview: (ad: ProjectMetaAdsAdSummary) => void;
}) {
  const mediaUrl = getAdThumbnailUrl(ad);
  const name = ad.adName ?? ad.title ?? ad.adId;
  const openAdPreview = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    onPreview(ad);
  };

  return (
    <td
      key="name"
      className={`sticky left-32 z-30 border-l-2 border-slate-200 px-3 py-3 pl-9 focus-within:z-50 hover:z-50 dark:border-white/10 ${stickyCellClassName}`}
    >
      <div className="group relative flex min-w-0 items-center gap-2">
        <button
          type="button"
          aria-label={localize('com_ui_project_meta_ads_open_meta_ads')}
          title={localize('com_ui_project_meta_ads_open_meta_ads')}
          onClick={openAdPreview}
          className="relative h-10 w-16 shrink-0 overflow-hidden border border-white/10 bg-[#242016] text-left shadow-[0_12px_30px_-24px_rgba(245,158,11,0.65)] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
        >
          {mediaUrl ? (
            <img
              src={mediaUrl}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-[#8a8172]">
              {localize('com_ui_project_meta_ads_no_creative_media')}
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center gap-1 bg-black/70 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <ArrowSquareOut className="h-3.5 w-3.5 text-white" aria-hidden="true" />
          </span>
        </button>
        <button type="button" onClick={openAdPreview} className="min-w-0 text-left">
          <div className="truncate text-sm font-medium text-slate-900 dark:text-white">{name}</div>
          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
            {ad.title ?? ad.body ?? '-'}
          </div>
        </button>
        <MetaAdsNameTooltip value={name} />
      </div>
    </td>
  );
}
