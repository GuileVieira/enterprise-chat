import type { ComponentProps, ReactNode } from 'react';

import { MetaAdsOverviewTable } from './overviewTable';
import { MetaAdsOverviewToolbar } from './overviewToolbar';
import { MetaAdsSummaryCards } from './summaryCards';
import { MetaAdsRulesWorkspace } from './rulesWorkspace';
import { MetaAdsPendingRecommendationsPanel } from './pendingRecommendationsPanel';

type SortableHeaderArgs = {
  key: string;
  label: string;
  className?: string;
  defaultDirection?: 'asc' | 'desc';
};

type MetaAdsOverviewWorkspaceProps = {
  filters: {
    campaignSort: string;
    onSortColumn: (key: string, defaultDirection: 'asc' | 'desc') => void;
  };
  selection: {
    campaignCount: number;
  };
  summary: ComponentProps<typeof MetaAdsSummaryCards>;
  rules: ComponentProps<typeof MetaAdsRulesWorkspace>;
  table: Omit<ComponentProps<typeof MetaAdsOverviewTable>, 'renderSortableHeader'>;
  actions: {
    pendingRecommendations: ComponentProps<typeof MetaAdsPendingRecommendationsPanel>;
  };
  chrome: {
    showPendingRecommendations: boolean;
  };
  toolbar: ComponentProps<typeof MetaAdsOverviewToolbar>;
};

function renderSortableHeader({
  campaignSort,
  onSortColumn,
  key,
  label,
  className,
  defaultDirection = 'desc',
}: SortableHeaderArgs &
  Pick<MetaAdsOverviewWorkspaceProps['filters'], 'campaignSort' | 'onSortColumn'>): ReactNode {
  const [activeKey, activeDirection] = campaignSort.split('_') as [string, 'asc' | 'desc'];
  const isActive = activeKey === key;

  return (
    <button
      type="button"
      onClick={() => onSortColumn(key, defaultDirection)}
      className={`inline-flex w-full min-w-0 flex-wrap items-center gap-0.5 text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-[#8f8677] transition hover:text-[#f8f1e5] ${
        className ?? ''
      }`}
    >
      <span className="min-w-0 break-words">{label}</span>
      {isActive && (
        <span aria-hidden="true" className="text-amber-200">
          {activeDirection === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  );
}

export function MetaAdsOverviewWorkspace({
  filters,
  selection,
  summary,
  rules,
  table,
  actions,
  chrome,
  toolbar,
}: MetaAdsOverviewWorkspaceProps) {
  return (
    <div
      id="meta-ads-overview-tab-panel"
      role="tabpanel"
      aria-labelledby="meta-ads-tab-overview"
      data-testid="meta-ads-overview-tab-panel"
    >
      <MetaAdsOverviewToolbar {...toolbar} />
      <MetaAdsSummaryCards {...summary} />

      {selection.campaignCount === 0 && chrome.showPendingRecommendations && (
        <MetaAdsPendingRecommendationsPanel {...actions.pendingRecommendations} />
      )}

      <MetaAdsRulesWorkspace {...rules} />
      <MetaAdsOverviewTable
        {...table}
        renderSortableHeader={(args) =>
          renderSortableHeader({
            ...args,
            campaignSort: filters.campaignSort,
            onSortColumn: filters.onSortColumn,
          })
        }
      />
    </div>
  );
}
