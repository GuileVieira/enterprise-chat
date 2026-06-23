import type { ReactNode, RefObject, UIEvent } from 'react';

import type {
  ProjectMetaAdsAdSummary,
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsRecommendation,
} from 'librechat-data-provider';
import type { Localize, TableColumn } from './types';
import { renderOverviewRows } from './overviewRows';

type SortableHeaderArgs = {
  key: string;
  label: string;
  className?: string;
  defaultDirection?: 'asc' | 'desc';
};

type MetaAdsOverviewTableProps = {
  columns: TableColumn[];
  campaigns: ProjectMetaAdsCampaignSummary[];
  selectedEntityIds: string[];
  expandedCampaignIds: string[];
  collapsedAboCampaignIds: string[];
  collapsedAdSetAdsIds: string[];
  tableColumnCount: number;
  tableMinWidthClassName: string;
  stickyCellClassName: string;
  isInitialStatusLoading: boolean;
  localize: Localize;
  tableScrollRef: RefObject<HTMLDivElement>;
  stickyHorizontalScrollRef: RefObject<HTMLDivElement>;
  onTableScroll: (event: UIEvent<HTMLDivElement>) => void;
  onStickyHorizontalScroll: (event: UIEvent<HTMLDivElement>) => void;
  onToggleCampaign: (campaign: ProjectMetaAdsCampaignSummary) => void;
  onToggleCampaignExpanded: (campaign: ProjectMetaAdsCampaignSummary) => void;
  onToggleAdSet: (entityId: string) => void;
  onToggleAdSetAds: (entityId: string) => void;
  getTableRowClass: (
    rowIndex: number,
    rowType: 'campaign' | 'adset' | 'ad',
    clickable?: boolean,
  ) => string;
  getEntityRecommendation: (entityId: string) => ProjectMetaAdsRecommendation | undefined;
  renderSortableHeader: (args: SortableHeaderArgs) => ReactNode;
  renderCampaignCell: (
    column: TableColumn,
    campaign: ProjectMetaAdsCampaignSummary,
    recommendation: ProjectMetaAdsRecommendation | undefined,
  ) => ReactNode;
  renderAdSetCell: (
    column: TableColumn,
    campaign: ProjectMetaAdsCampaignSummary,
    adset: ProjectMetaAdsCampaignSummary['adSets'][number],
    recommendation: ProjectMetaAdsRecommendation | undefined,
  ) => ReactNode;
  renderAdRow: (
    campaign: ProjectMetaAdsCampaignSummary,
    ad: ProjectMetaAdsAdSummary,
    rowIndex: number,
  ) => ReactNode;
};

function getHeaderStickyClass(column: TableColumn) {
  if (column.key === 'adStatus') {
    return 'sticky left-20 z-40 bg-slate-100/95 dark:bg-[#1a2438]';
  }
  if (column.key === 'name') {
    return 'sticky left-32 z-40 bg-slate-100/95 shadow-[14px_0_26px_-22px_rgba(15,23,42,0.45)] dark:bg-[#1a2438] dark:shadow-[14px_0_26px_-22px_rgba(0,0,0,0.9)]';
  }
  return '';
}

function renderHeaderContent({
  column,
  label,
  renderSortableHeader,
}: {
  column: TableColumn;
  label: string;
  renderSortableHeader: (args: SortableHeaderArgs) => ReactNode;
}) {
  if (column.key === 'actions' || column.key === 'adStatus') {
    return <span className="sr-only">{label}</span>;
  }
  if (column.sortableKey) {
    return renderSortableHeader({
      key: column.sortableKey,
      label,
      className: column.align === 'right' ? 'justify-end text-right' : '',
      defaultDirection: column.defaultDirection,
    });
  }
  return label;
}

export function MetaAdsOverviewTable({
  columns,
  campaigns,
  selectedEntityIds,
  expandedCampaignIds,
  collapsedAboCampaignIds,
  collapsedAdSetAdsIds,
  tableColumnCount,
  tableMinWidthClassName,
  stickyCellClassName,
  isInitialStatusLoading,
  localize,
  tableScrollRef,
  stickyHorizontalScrollRef,
  onTableScroll,
  onStickyHorizontalScroll,
  onToggleCampaign,
  onToggleCampaignExpanded,
  onToggleAdSet,
  onToggleAdSetAds,
  getTableRowClass,
  getEntityRecommendation,
  renderSortableHeader,
  renderCampaignCell,
  renderAdSetCell,
  renderAdRow,
}: MetaAdsOverviewTableProps) {
  return (
    <>
      <div
        ref={tableScrollRef}
        onScroll={onTableScroll}
        className="max-w-full overflow-x-auto bg-white/55 dark:bg-slate-950/20"
      >
        <table
          className={`w-full ${tableMinWidthClassName} table-fixed border-separate border-spacing-0 text-left text-xs [&_td:last-child]:border-r-0 [&_td]:border-r [&_td]:border-slate-200/60 dark:[&_td]:border-white/[0.06] [&_th:last-child]:border-r-0 [&_th]:border-r [&_th]:border-slate-200/70 dark:[&_th]:border-white/10`}
        >
          <thead className="sticky top-0 z-30 border-b border-slate-200 bg-slate-100/95 text-[11px] uppercase tracking-[0.12em] text-slate-500 shadow-[0_16px_36px_-32px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#1a2438]/95 dark:text-slate-400 dark:shadow-[0_16px_40px_-32px_rgba(0,0,0,0.9)]">
            <tr>
              <th className="sticky left-0 z-40 w-10 border-b border-slate-200 bg-slate-100/95 px-2 py-3 dark:border-white/10 dark:bg-[#1a2438]">
                <span className="sr-only">{localize('com_ui_project_meta_ads_select_ad_set')}</span>
              </th>
              <th className="sticky left-10 z-40 w-10 border-b border-slate-200 bg-slate-100/95 px-2 py-3 shadow-[10px_0_18px_-18px_rgba(20,184,166,0.55)] dark:border-white/10 dark:bg-[#1a2438]">
                <span className="sr-only">
                  {localize('com_ui_project_meta_ads_expand_campaign')}
                </span>
              </th>
              {columns.map((column) => {
                const label = column.label ?? (column.labelKey ? localize(column.labelKey) : '');
                const alignClass = column.align === 'right' ? 'text-right' : '';
                const stickyClass = getHeaderStickyClass(column);
                return (
                  <th
                    key={column.key}
                    className={`${column.widthClass} ${alignClass} ${stickyClass} border-b border-slate-200 px-3 py-3 dark:border-white/10`}
                  >
                    {renderHeaderContent({ column, label, renderSortableHeader })}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isInitialStatusLoading &&
              Array.from({ length: 5 }).map((_, index) => (
                <tr
                  key={`meta-ads-row-skeleton-${index}`}
                  data-testid="meta-ads-row-skeleton"
                  className="border-b border-border-light"
                >
                  <td className="px-2 py-3" colSpan={tableColumnCount}>
                    <div className="flex items-center gap-4">
                      <div className="h-[18px] w-[18px] animate-pulse border border-border-light bg-surface-secondary" />
                      <div className="h-7 w-7 animate-pulse border border-border-light bg-surface-secondary" />
                      <div className="h-4 w-48 animate-pulse bg-surface-secondary" />
                      <div className="h-4 w-28 animate-pulse bg-surface-secondary" />
                      <div className="h-4 w-24 animate-pulse bg-surface-secondary" />
                      <div className="h-4 w-20 animate-pulse bg-surface-secondary" />
                    </div>
                  </td>
                </tr>
              ))}
            {renderOverviewRows({
              columns,
              campaigns,
              selectedEntityIds,
              expandedCampaignIds,
              collapsedAboCampaignIds,
              collapsedAdSetAdsIds,
              stickyCellClassName,
              localize,
              onToggleCampaign,
              onToggleCampaignExpanded,
              onToggleAdSet,
              onToggleAdSetAds,
              getTableRowClass,
              getEntityRecommendation,
              renderCampaignCell,
              renderAdSetCell,
              renderAdRow,
            })}
          </tbody>
        </table>
        {campaigns.length === 0 && !isInitialStatusLoading && (
          <div className="border-t border-dashed border-border-light py-8 text-center text-sm text-text-secondary">
            {localize('com_ui_project_meta_ads_no_snapshots')}
          </div>
        )}
      </div>
      <div className="sticky bottom-0 z-20 border-t border-slate-200/70 bg-white/80 px-4 py-2 backdrop-blur dark:border-white/10 dark:bg-[#152033]/80">
        <div
          ref={stickyHorizontalScrollRef}
          onScroll={onStickyHorizontalScroll}
          className="max-w-full overflow-x-auto"
          aria-hidden="true"
        >
          <div className={`h-2 w-full ${tableMinWidthClassName}`} />
        </div>
      </div>
    </>
  );
}
