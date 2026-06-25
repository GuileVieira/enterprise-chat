import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { ProjectMetaAdsCampaignSummary } from 'librechat-data-provider';
import type {
  useApplyProjectMetaAdsRecommendationMutation,
  useUpdateProjectMetaAdsEntityStatusMutation,
} from '~/data-provider';
import { tableColumnMap, tableViewMinWidth } from '../constants';
import {
  metaAdsButton,
  metaAdsGhostButton,
  metaAdsInput,
  metaAdsStickyCell,
  metaAdsModalOverlay,
  metaAdsModalShell,
} from '../chrome';
import { getMetaAdsTableRowClass } from '../overviewCells';
import { createMetaAdsOverviewRenderers } from '../overviewRenderers';
import { MetaAdsOverviewWorkspace } from '../overviewWorkspace';
import { buildMetaAdsSummaryCardItems, getNextMetaAdsSortDirection } from '../overviewState';
import { buildMetaAdsOverviewState } from '../overviewState';
import { getTableViewColumns } from '../table';
import type { TableView, Localize } from '../types';
import type { useMetaAdsEntityActions } from './useMetaAdsEntityActions';
import type { useMetaAdsPeriodFilter } from './useMetaAdsPeriodFilter';
import type { useMetaAdsRules } from './useMetaAdsRules';
import type { useMetaAdsSelection } from './useMetaAdsSelection';
import type { useMetaAdsSettings } from './useMetaAdsSettings';
import type { useMetaAdsTableScrollSync } from './useMetaAdsTableScrollSync';

type MetaAdsOverviewWorkspaceProps = ComponentProps<typeof MetaAdsOverviewWorkspace>;

type UseMetaAdsOverviewAdapterParams = {
  campaigns: ProjectMetaAdsCampaignSummary[];
  pendingRecommendations: NonNullable<
    MetaAdsOverviewWorkspaceProps['actions']['pendingRecommendations']['recommendations']
  >;
  currency: string;
  canUseMetaAdsActions: boolean;
  isStatusLoading: boolean;
  isInitialStatusLoading: boolean;
  canOpenTrafficAgentChat: boolean;
  objectiveOptions: MetaAdsOverviewWorkspaceProps['toolbar']['objectiveOptions'];
  statusSummary: Parameters<typeof buildMetaAdsOverviewState>[0]['summary'];
  settingsState: ReturnType<typeof useMetaAdsSettings>;
  entityActions: ReturnType<typeof useMetaAdsEntityActions>;
  rulesState: ReturnType<typeof useMetaAdsRules>;
  selection: ReturnType<typeof useMetaAdsSelection>;
  tableScroll: ReturnType<typeof useMetaAdsTableScrollSync>;
  overviewPeriod: ReturnType<typeof useMetaAdsPeriodFilter>;
  applyRecommendation: ReturnType<typeof useApplyProjectMetaAdsRecommendationMutation>;
  updateEntityStatus: ReturnType<typeof useUpdateProjectMetaAdsEntityStatusMutation>;
  localize: Localize;
  onOpenTrafficAgentChat: () => void;
};

export function useMetaAdsOverviewAdapter({
  campaigns,
  pendingRecommendations,
  currency,
  canUseMetaAdsActions,
  isStatusLoading,
  isInitialStatusLoading,
  canOpenTrafficAgentChat,
  objectiveOptions,
  statusSummary,
  settingsState,
  entityActions,
  rulesState,
  selection,
  tableScroll,
  overviewPeriod,
  applyRecommendation,
  updateEntityStatus,
  localize,
  onOpenTrafficAgentChat,
}: UseMetaAdsOverviewAdapterParams): MetaAdsOverviewWorkspaceProps {
  const [campaignSearch, setCampaignSearch] = useState('');
  const [objectiveFilter, setObjectiveFilter] = useState('all');
  const [resultTypeSelectorOpen, setResultTypeSelectorOpen] = useState(false);
  const [selectedSummaryResultType, setSelectedSummaryResultType] = useState<string | null>(null);
  const [budgetModeFilter, setBudgetModeFilter] = useState('all');
  const [campaignSort, setCampaignSort] = useState('name_asc');
  const [tableView, setTableView] = useState<TableView>('summary');
  const { settings } = settingsState;
  const {
    actionMenuKey,
    setActionMenuKey,
    getDuplicateName,
    onApply,
    onOpenBudgetEditor,
    onOpenEntityStatusConfirmation,
    onOpenDuplicateDraft,
  } = entityActions;
  const { canCreateRuleGroup, getEntityRuleLabel, onOpenRuleGroupDraft } = rulesState;
  const {
    selectedEntityIds,
    expandedCampaignIds,
    collapsedAboCampaignIds,
    collapsedAdSetAdsIds,
    selectedCount,
    clearSelection,
    onToggleCampaign,
    onToggleAdSet,
    onToggleCampaignExpanded,
    onToggleAdSetAds,
    expandAllRows,
    collapseAllRows,
  } = selection;
  const { tableScrollRef, stickyHorizontalScrollRef, onTableScroll, onStickyHorizontalScroll } =
    tableScroll;
  const {
    scopedObjectiveSummary,
    isEcommerceDashboard,
    summaryResultTypeOptions,
    summaryMetricContext,
    summaryTotalSpend,
    summaryTotalResults,
    summaryAverageCost,
    summaryAverageFrequency,
    summaryAverageRoas,
    filteredCampaigns,
  } = buildMetaAdsOverviewState({
    campaigns,
    settings,
    summary: statusSummary,
    campaignSearch,
    objectiveFilter,
    budgetModeFilter,
    campaignSort,
    selectedSummaryResultType,
    localize,
  });
  const tableColumns = getTableViewColumns(tableView, isEcommerceDashboard).map(
    (key) => tableColumnMap[key],
  );
  const tableColumnCount = tableColumns.length + 2;
  const summaryCards = buildMetaAdsSummaryCardItems({
    isEcommerceDashboard,
    summaryAverageRoas,
    summaryTotalSpend,
    summaryTotalResults,
    summaryAverageCost,
    summaryAverageFrequency,
    summaryMetricContext,
    summaryResultTypeOptionsLength: summaryResultTypeOptions.length,
    scopedObjectiveSummary,
    currency,
    localize,
  });
  const getEntityRecommendation = (entityId: string) =>
    pendingRecommendations.find((recommendation) => recommendation.entityId === entityId);
  const getTableRowClass = getMetaAdsTableRowClass;
  const { renderCampaignCell, renderAdSetCell, renderAdRow } = createMetaAdsOverviewRenderers({
    columns: tableColumns,
    currency,
    actionMenuKey,
    stickyCellClassName: metaAdsStickyCell,
    canUseMetaAdsActions,
    applyingRecommendation: applyRecommendation.isLoading,
    updatingEntityStatus: updateEntityStatus.isLoading,
    localize,
    getTableRowClass,
    getEntityRuleLabel,
    getDuplicateName,
    onApply,
    onToggleActionMenu: (menuKey) =>
      setActionMenuKey((current) => (current === menuKey ? null : menuKey)),
    onOpenDuplicateDraft,
    onOpenBudgetEditor,
    onOpenEntityStatusConfirmation,
    onPreviewAd: entityActions.setSelectedAdPreview,
  });
  const onSortColumn = (key: string, defaultDirection: 'asc' | 'desc') => {
    const nextDirection = getNextMetaAdsSortDirection({ campaignSort, key, defaultDirection });
    setCampaignSort(`${key}_${nextDirection}`);
  };

  return {
    filters: { campaignSort, onSortColumn },
    selection: { campaignCount: campaigns.length },
    toolbar: {
      loading: isStatusLoading,
      campaignSearch,
      budgetModeFilter,
      objectiveFilter,
      campaignSort,
      tableView,
      period: {
        periodFilter: overviewPeriod.periodFilter,
        customSince: overviewPeriod.customSince,
        customUntil: overviewPeriod.customUntil,
        appliedCustomSince: overviewPeriod.appliedCustomSince,
        appliedCustomUntil: overviewPeriod.appliedCustomUntil,
        inputClassName: metaAdsInput,
        onPeriodFilterChange: overviewPeriod.setPeriodFilter,
        onCustomSinceChange: overviewPeriod.onCustomSinceChange,
        onCustomUntilChange: overviewPeriod.onCustomUntilChange,
        onApplyCustomPeriod: overviewPeriod.onApplyCustomPeriod,
      },
      selectedCount,
      campaignCount: campaigns.length,
      canCreateRuleGroup,
      canOpenTrafficAgentChat,
      objectiveOptions,
      localize,
      onCampaignSearchChange: setCampaignSearch,
      onBudgetModeFilterChange: setBudgetModeFilter,
      onObjectiveFilterChange: setObjectiveFilter,
      onCampaignSortChange: setCampaignSort,
      onTableViewChange: setTableView,
      onClearSelection: clearSelection,
      onExpandAllRows: () => expandAllRows(campaigns),
      onCollapseAllRows: () => collapseAllRows(campaigns),
      onCreateRuleGroup: onOpenRuleGroupDraft,
      onOpenTrafficAgentChat,
    },
    summary: {
      cards: summaryCards,
      resultTypeOptions: summaryResultTypeOptions,
      selectorOpen: resultTypeSelectorOpen,
      selectedResultType: selectedSummaryResultType,
      initialLoading: isInitialStatusLoading,
      currency,
      localize,
      onOpenSelector: () => setResultTypeSelectorOpen(true),
      onCloseSelector: () => setResultTypeSelectorOpen(false),
      onSelectResultType: (resultType) => {
        setSelectedSummaryResultType(resultType);
        setResultTypeSelectorOpen(false);
      },
      onClearResultType: () => {
        setSelectedSummaryResultType(null);
        setResultTypeSelectorOpen(false);
      },
      chrome: {
        modalOverlayClassName: metaAdsModalOverlay,
        modalShellClassName: metaAdsModalShell,
      },
      buttons: {
        buttonClassName: metaAdsButton,
        ghostButtonClassName: metaAdsGhostButton,
      },
    },
    actions: {
      pendingRecommendations: {
        recommendations: pendingRecommendations,
        currency,
        canUseMetaAdsActions,
        applyingRecommendation: applyRecommendation.isLoading,
        localize,
        onApply,
      },
    },
    chrome: { showPendingRecommendations: true },
    table: {
      columns: tableColumns,
      campaigns: filteredCampaigns,
      selectedEntityIds,
      expandedCampaignIds,
      collapsedAboCampaignIds,
      collapsedAdSetAdsIds,
      tableColumnCount,
      tableMinWidthClassName: tableViewMinWidth[tableView],
      stickyCellClassName: metaAdsStickyCell,
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
      renderCampaignCell,
      renderAdSetCell,
      renderAdRow,
    },
  };
}
