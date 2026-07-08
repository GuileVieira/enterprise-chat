import { getObjectiveLabel, getResultTypeLabel } from './formatters';
import { tableViewOptions } from './constants';
import { MetaAdsPeriodControls } from './periodControls';
import type { Localize, TableView } from './types';
import type { MetaAdsPeriodControlProps } from './periodControls';
import { MetaAdsButton, MetaAdsField, MetaAdsInput, MetaAdsPanel, MetaAdsSelect } from './ui';

export function MetaAdsOverviewToolbar({
  loading,
  campaignSearch,
  budgetModeFilter,
  objectiveFilter,
  resultTypeFilter,
  campaignStatusFilter,
  campaignSort,
  tableView,
  period,
  selectedCount,
  campaignCount,
  canCreateRuleGroup,
  canOpenTrafficAgentChat,
  objectiveOptions,
  resultTypeOptions,
  localize,
  onCampaignSearchChange,
  onBudgetModeFilterChange,
  onObjectiveFilterChange,
  onResultTypeFilterChange,
  onCampaignStatusFilterChange,
  onCampaignSortChange,
  onTableViewChange,
  onClearSelection,
  onExpandAllRows,
  onCollapseAllRows,
  onCreateRuleGroup,
  onOpenTrafficAgentChat,
}: {
  loading: boolean;
  campaignSearch: string;
  budgetModeFilter: string;
  objectiveFilter: string;
  resultTypeFilter: string;
  campaignStatusFilter: string;
  campaignSort: string;
  tableView: TableView;
  period: Omit<MetaAdsPeriodControlProps, 'localize' | 'testIdPrefix'>;
  selectedCount: number;
  campaignCount: number;
  canCreateRuleGroup: boolean;
  canOpenTrafficAgentChat: boolean;
  objectiveOptions: string[];
  resultTypeOptions: string[];
  localize: Localize;
  onCampaignSearchChange: (value: string) => void;
  onBudgetModeFilterChange: (value: string) => void;
  onObjectiveFilterChange: (value: string) => void;
  onResultTypeFilterChange: (value: string) => void;
  onCampaignStatusFilterChange: (value: string) => void;
  onCampaignSortChange: (value: string) => void;
  onTableViewChange: (value: TableView) => void;
  onClearSelection: () => void;
  onExpandAllRows: () => void;
  onCollapseAllRows: () => void;
  onCreateRuleGroup: () => void;
  onOpenTrafficAgentChat: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200/70 bg-white/45 p-4 shadow-[0_20px_60px_-50px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-slate-950/10 dark:shadow-[0_20px_70px_-54px_rgba(0,0,0,0.9)]">
      {loading && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-amber-300/35 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100"
        >
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-900 border-t-amber-200" />
          <span>{localize('com_ui_project_meta_ads_loading')}</span>
        </div>
      )}
      <MetaAdsPanel className="p-3">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
            <MetaAdsPeriodControls
              {...period}
              localize={localize}
              testIdPrefix="meta-ads-overview"
            />
            <MetaAdsField label={localize('com_ui_project_meta_ads_search')}>
              <MetaAdsInput
                value={campaignSearch}
                onChange={(event) => onCampaignSearchChange(event.target.value)}
              />
            </MetaAdsField>
            <MetaAdsField label={localize('com_ui_project_meta_ads_budget_mode_filter')}>
              <MetaAdsSelect
                value={budgetModeFilter}
                onChange={(event) => onBudgetModeFilterChange(event.target.value)}
              >
                <option value="all">{localize('com_ui_all')}</option>
                <option value="CBO">CBO</option>
                <option value="ABO">ABO</option>
                <option value="UNKNOWN">UNKNOWN</option>
              </MetaAdsSelect>
            </MetaAdsField>
            <MetaAdsField label={localize('com_ui_project_meta_ads_campaign_status_filter')}>
              <MetaAdsSelect
                value={campaignStatusFilter}
                onChange={(event) => onCampaignStatusFilterChange(event.target.value)}
              >
                <option value="all">{localize('com_ui_all')}</option>
                <option value="active">{localize('com_ui_project_meta_ads_active')}</option>
                <option value="inactive">
                  {localize('com_ui_project_meta_ads_inactive_campaigns')}
                </option>
              </MetaAdsSelect>
            </MetaAdsField>
            <MetaAdsField label={localize('com_ui_project_meta_ads_objective_filter')}>
              <MetaAdsSelect
                value={objectiveFilter}
                onChange={(event) => onObjectiveFilterChange(event.target.value)}
              >
                <option value="all">{localize('com_ui_all')}</option>
                {objectiveOptions.map((objective) => (
                  <option key={objective} value={objective}>
                    {getObjectiveLabel(objective, localize)}
                  </option>
                ))}
              </MetaAdsSelect>
            </MetaAdsField>
            <MetaAdsField label={localize('com_ui_project_meta_ads_target_metric_filter')}>
              <MetaAdsSelect
                value={resultTypeFilter}
                onChange={(event) => onResultTypeFilterChange(event.target.value)}
              >
                <option value="all">{localize('com_ui_all')}</option>
                {resultTypeOptions.map((resultType) => (
                  <option key={resultType} value={resultType}>
                    {getResultTypeLabel(resultType, localize)}
                  </option>
                ))}
              </MetaAdsSelect>
            </MetaAdsField>
            <MetaAdsField label={localize('com_ui_project_meta_ads_sort')}>
              <MetaAdsSelect
                value={campaignSort}
                onChange={(event) => onCampaignSortChange(event.target.value)}
              >
                <option value="name_asc">{localize('com_ui_name')}</option>
                <option value="budget_desc">
                  {localize('com_ui_project_meta_ads_budget_defined')}
                </option>
                <option value="frequency_desc">
                  {localize('com_ui_project_meta_ads_frequency')}
                </option>
                <option value="spend_desc">{localize('com_ui_project_meta_ads_spend')}</option>
                <option value="roas_desc">{localize('com_ui_project_meta_ads_roas')}</option>
                <option value="cpa_asc">{localize('com_ui_project_meta_ads_cost_result')}</option>
                <option value="result_desc">{localize('com_ui_project_meta_ads_result')}</option>
                <option value="ctr_desc">CTR</option>
                <option value="clicks_desc">{localize('com_ui_project_meta_ads_clicks')}</option>
              </MetaAdsSelect>
            </MetaAdsField>
            <MetaAdsField label={localize('com_ui_project_meta_ads_table_view')}>
              <MetaAdsSelect
                value={tableView}
                onChange={(event) => onTableViewChange(event.target.value as TableView)}
              >
                {tableViewOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {localize(option.labelKey)}
                  </option>
                ))}
              </MetaAdsSelect>
            </MetaAdsField>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
            <span className="h-10 rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 font-mono text-xs tabular-nums text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
              {localize('com_ui_project_meta_ads_selection_count', {
                0: String(selectedCount),
              })}
            </span>
            <MetaAdsButton
              variant="ghost"
              disabled={selectedCount === 0}
              onClick={onClearSelection}
            >
              {localize('com_ui_project_meta_ads_clear_selection')}
            </MetaAdsButton>
            <MetaAdsButton variant="ghost" disabled={campaignCount === 0} onClick={onExpandAllRows}>
              {localize('com_ui_project_meta_ads_expand_all')}
            </MetaAdsButton>
            <MetaAdsButton
              variant="ghost"
              disabled={campaignCount === 0}
              onClick={onCollapseAllRows}
            >
              {localize('com_ui_project_meta_ads_collapse_all')}
            </MetaAdsButton>
            <MetaAdsButton disabled={!canCreateRuleGroup} onClick={onCreateRuleGroup}>
              {localize('com_ui_project_meta_ads_create_rule_group')}
            </MetaAdsButton>
            <MetaAdsButton disabled={!canOpenTrafficAgentChat} onClick={onOpenTrafficAgentChat}>
              {localize('com_ui_project_meta_ads_chat_with_agent')}
            </MetaAdsButton>
          </div>
        </div>
      </MetaAdsPanel>
    </div>
  );
}
