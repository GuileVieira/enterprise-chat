import { useState } from 'react';
import { OGDialog, OGDialogTitle, OGDialogHeader, OGDialogContent } from '@librechat/client';
import type {
  ProjectMetaAdsRulePerformanceItem,
  ProjectMetaAdsRulePerformanceEntity,
  ProjectMetaAdsRulePerformanceResponse,
} from 'librechat-data-provider';

import { defaultRules, getRuleRowTypeLabelKey } from './rules';
import {
  formatMoney,
  formatMetric,
  getResultTypeLabel,
  getRuleTargetMetricValue,
} from './formatters';
import { MetaAdsPanel } from './ui';
import { MetaAdsPeriodControls } from './periodControls';
import { MetaAdsNameTooltip } from './overviewCells';
import type { Localize, RuleRow, MetaAdsRuleGroup, MetaAdsRuleOverride } from './types';
import type { MetaAdsPeriodControlProps } from './periodControls';

function getRulePerformanceKey(rule: RuleRow) {
  if (rule.type === 'global') {
    return 'global:global';
  }
  if (rule.type === 'group') {
    return rule.key;
  }
  return rule.override ? `override:${rule.override.entityId}` : rule.key;
}

function createRuleRowFromPerformance(rule: ProjectMetaAdsRulePerformanceItem): RuleRow {
  const firstEntity = rule.entities?.[0];
  let rowType: RuleRow['type'] = 'global';
  if (rule.ruleSourceType === 'group') {
    rowType = 'group';
  } else if (rule.ruleSourceType === 'override') {
    rowType = firstEntity?.entityLevel === 'adset' ? 'adset_override' : 'campaign_override';
  }
  return {
    key: rule.ruleKey,
    type: rowType,
    enabled: false,
    name: rule.ruleName,
    scopeLabel: rule.ruleScope ?? firstEntity?.entityName ?? '-',
    precedenceLabel: rule.ruleSourceType,
    entityLevel: firstEntity?.entityLevel === 'adset' ? 'adset' : 'campaign',
    entityIds: (rule.entities ?? []).map((entity) => entity.entityId),
    rules: {
      ...defaultRules,
      primaryMetric: rule.targetMetric ?? defaultRules.primaryMetric,
      targetCpa:
        rule.targetMetric === 'cpa' && rule.targetMetricGoal != null
          ? rule.targetMetricGoal
          : defaultRules.targetCpa,
      minRoas:
        rule.targetMetric === 'roas' && rule.targetMetricGoal != null
          ? rule.targetMetricGoal
          : defaultRules.minRoas,
    },
  };
}

function formatRuleDateTime(value?: string): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  const parts = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}`;
}

type RulePerformanceComparison =
  | ProjectMetaAdsRulePerformanceItem
  | ProjectMetaAdsRulePerformanceEntity;

function getStatusTone(status?: ProjectMetaAdsRulePerformanceItem['status']) {
  if (status === 'improved') {
    return 'text-emerald-700 dark:text-emerald-200';
  }
  if (status === 'regressed') {
    return 'text-rose-700 dark:text-rose-200';
  }
  if (status === 'awaiting_results') {
    return 'text-amber-700 dark:text-amber-200';
  }
  if (status === 'no_result_after_spend') {
    return 'text-rose-700 dark:text-rose-200';
  }
  return 'text-slate-600 dark:text-slate-300';
}

function hasMultipleEvaluatedEntities(rule: ProjectMetaAdsRulePerformanceItem) {
  return (rule.entities?.length ?? 0) > 1;
}

function getRuleTableStatusLabel(rule: ProjectMetaAdsRulePerformanceItem, localize: Localize) {
  const entities = rule.entities ?? [];
  if (entities.length > 1) {
    return localize('com_ui_project_meta_ads_view_entities');
  }
  const entityStatus = entities[0]?.status;
  return localize(`com_ui_project_meta_ads_rule_performance_${entityStatus ?? rule.status}`);
}

function getDeltaTone(metric: 'cpa' | 'roas', value?: number | null) {
  if (value == null || Number.isNaN(value) || value === 0) {
    return 'text-slate-500 dark:text-slate-400';
  }
  const improved = metric === 'cpa' ? value < 0 : value > 0;
  return improved ? 'text-emerald-700 dark:text-emerald-200' : 'text-rose-700 dark:text-rose-200';
}

function getTargetMetricCardClassName({
  isNoResultAfterSpend,
  isAwaitingResults,
}: {
  isNoResultAfterSpend: boolean;
  isAwaitingResults: boolean;
}) {
  if (isNoResultAfterSpend) {
    return 'border-rose-300/35 bg-rose-50/80 dark:border-rose-300/20 dark:bg-rose-300/10';
  }
  if (isAwaitingResults) {
    return 'border-amber-300/35 bg-amber-50/80 dark:border-amber-300/20 dark:bg-amber-300/10';
  }
  return 'border-teal-300/30 bg-teal-50/80 dark:border-teal-300/20 dark:bg-teal-300/10';
}

function getTargetMetricLabelClassName({
  isNoResultAfterSpend,
  isAwaitingResults,
}: {
  isNoResultAfterSpend: boolean;
  isAwaitingResults: boolean;
}) {
  if (isNoResultAfterSpend) {
    return 'text-rose-700 dark:text-rose-200';
  }
  if (isAwaitingResults) {
    return 'text-amber-700 dark:text-amber-200';
  }
  return 'text-teal-700 dark:text-teal-200';
}

function formatSignedMetricValue(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  if (value > 0) {
    return `+${formatMetric(value)}`;
  }
  if (value < 0) {
    return `-${formatMetric(Math.abs(value))}`;
  }
  return formatMetric(value);
}

function formatSignedMoneyValue(value: number | null | undefined, currency: string) {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  if (value > 0) {
    return `+${formatMoney(value, currency)}`;
  }
  if (value < 0) {
    return `-${formatMoney(Math.abs(value), currency)}`;
  }
  return formatMoney(value, currency);
}

function getMetricLabel(metric: string | null | undefined, localize: Localize) {
  if (metric === 'roas') {
    return localize('com_ui_project_meta_ads_roas');
  }
  if (metric === 'cpc') {
    return localize('com_ui_project_meta_ads_cpc');
  }
  if (metric === 'ctr') {
    return localize('com_ui_project_meta_ads_ctr');
  }
  return localize('com_ui_project_meta_ads_cpa');
}

function formatComparisonMetricValue(
  metric: string | null | undefined,
  value: number | null | undefined,
  currency: string,
) {
  if (metric === 'cpa' || metric === 'cpc') {
    return formatMoney(value, currency);
  }
  return formatMetric(value);
}

function formatSignedComparisonMetricValue(
  metric: string | null | undefined,
  value: number | null | undefined,
  currency: string,
) {
  if (metric === 'cpa' || metric === 'cpc') {
    return formatSignedMoneyValue(value, currency);
  }
  return formatSignedMetricValue(value);
}

function getComparisonReasons(item: RulePerformanceComparison) {
  const reasons: string[] = [];
  if (item.status === 'awaiting_results') {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_missing_expected_result');
    return reasons;
  }
  if (item.status === 'no_result_after_spend') {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_no_result_after_spend');
    return reasons;
  }
  const targetMetric = item.targetMetric;
  if (targetMetric === 'cpa' && item.targetMetricDelta != null && item.targetMetricDelta < 0) {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_cpa_down');
  }
  if (targetMetric === 'cpa' && item.targetMetricDelta != null && item.targetMetricDelta > 0) {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_cpa_up');
  }
  if (targetMetric === 'roas' && item.targetMetricDelta != null && item.targetMetricDelta > 0) {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_roas_up');
  }
  if (targetMetric === 'roas' && item.targetMetricDelta != null && item.targetMetricDelta < 0) {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_roas_down');
  }
  if (targetMetric === 'cpc' && item.targetMetricDelta != null && item.targetMetricDelta < 0) {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_cpc_down');
  }
  if (targetMetric === 'cpc' && item.targetMetricDelta != null && item.targetMetricDelta > 0) {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_cpc_up');
  }
  if (targetMetric === 'ctr' && item.targetMetricDelta != null && item.targetMetricDelta > 0) {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_ctr_up');
  }
  if (targetMetric === 'ctr' && item.targetMetricDelta != null && item.targetMetricDelta < 0) {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_ctr_down');
  }
  return reasons;
}

function getComparisonMissingItems(item: RulePerformanceComparison) {
  const missingItems: string[] = [];
  if (item.status === 'awaiting_results') {
    return missingItems;
  }
  if (item.status === 'no_result_after_spend') {
    return missingItems;
  }
  if (item.targetMetric && (item.firstTargetMetric == null || item.lastTargetMetric == null)) {
    missingItems.push('com_ui_project_meta_ads_rule_performance_missing_target_metric');
    return missingItems;
  }
  if (item.firstCpa == null || item.lastCpa == null) {
    missingItems.push('com_ui_project_meta_ads_rule_performance_missing_cpa');
  }
  if (item.firstRoas == null || item.lastRoas == null) {
    missingItems.push('com_ui_project_meta_ads_rule_performance_missing_roas');
  }
  return missingItems;
}

function NameWithTooltip({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`group relative block min-w-0 focus-within:z-50 hover:z-50 ${className}`}>
      <span tabIndex={0} className="block truncate focus:outline-none">
        {value}
      </span>
      <MetaAdsNameTooltip value={value} />
    </span>
  );
}

export function MetaAdsRulePerformanceWorkspace({
  data,
  fetching,
  period,
  currency,
  localize,
  rows,
  canCreateRuleGroup,
  canUseMetaAdsActions,
  saving,
  primaryButtonClassName,
  onCreateRuleGroup,
  onToggleRuleRow,
  onEditGlobalRule,
  onEditRuleGroup,
  onEditRuleOverride,
  onDeleteRuleGroup,
  onDeleteRuleOverride,
}: {
  data?: ProjectMetaAdsRulePerformanceResponse;
  fetching: boolean;
  period: Omit<MetaAdsPeriodControlProps, 'localize' | 'testIdPrefix'>;
  currency: string;
  localize: Localize;
  rows: RuleRow[];
  canCreateRuleGroup: boolean;
  canUseMetaAdsActions: boolean;
  saving: boolean;
  primaryButtonClassName: string;
  onCreateRuleGroup: () => void;
  onToggleRuleRow: (row: RuleRow) => void;
  onEditGlobalRule: () => void;
  onEditRuleGroup: (group: MetaAdsRuleGroup) => void;
  onEditRuleOverride: (override: MetaAdsRuleOverride) => void;
  onDeleteRuleGroup: (groupId?: string) => void;
  onDeleteRuleOverride: (override: MetaAdsRuleOverride) => void;
}) {
  const performanceRules = data?.rules ?? [];
  const configuredRuleKeys = new Set(rows.map((row) => getRulePerformanceKey(row)));
  const historicalRows = performanceRules
    .filter((rule) => !configuredRuleKeys.has(rule.ruleKey))
    .map(createRuleRowFromPerformance);
  const allRows = [...rows, ...historicalRows];
  const performanceByKey = new Map(performanceRules.map((rule) => [rule.ruleKey, rule]));
  const [selectedRuleKey, setSelectedRuleKey] = useState<string | null>(null);
  const selectedRow =
    selectedRuleKey == null
      ? null
      : (allRows.find((row) => getRulePerformanceKey(row) === selectedRuleKey) ?? null);
  const selectedPerformance = selectedRow
    ? (performanceByKey.get(getRulePerformanceKey(selectedRow)) ?? null)
    : null;

  return (
    <div
      id="meta-ads-rules-tab-panel"
      role="tabpanel"
      aria-labelledby="meta-ads-tab-rules"
      data-testid="meta-ads-rules-center-tab-panel"
      className="space-y-4 p-4"
    >
      <MetaAdsPanel className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetaAdsPeriodControls {...period} localize={localize} testIdPrefix="meta-ads-rules" />
          </div>
          <button
            type="button"
            disabled={!canCreateRuleGroup}
            onClick={onCreateRuleGroup}
            className={primaryButtonClassName}
          >
            {localize('com_ui_project_meta_ads_create_rule_group')}
          </button>
        </div>
      </MetaAdsPanel>
      {fetching && (
        <div className="rounded-2xl border border-amber-300/35 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
          {localize('com_ui_project_meta_ads_loading')}
        </div>
      )}
      <MetaAdsPanel className="overflow-hidden p-0">
        {allRows.length === 0 ? (
          <div className="p-5 text-sm text-slate-600 dark:text-slate-300">
            <div className="font-semibold text-slate-900 dark:text-white">
              {localize('com_ui_project_meta_ads_rules_empty_title')}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_rules_empty')}
            </p>
            <button
              type="button"
              disabled={!canCreateRuleGroup}
              onClick={onCreateRuleGroup}
              className={`mt-4 ${primaryButtonClassName}`}
            >
              {localize('com_ui_project_meta_ads_create_rule_group')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] table-fixed border-separate border-spacing-0 text-left text-xs">
              <thead className="bg-slate-50/90 text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:bg-white/[0.035] dark:text-slate-400">
                <tr>
                  <th className="w-28 border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
                    {localize('com_ui_project_meta_ads_status')}
                  </th>
                  <th className="w-[34%] border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
                    {localize('com_ui_project_meta_ads_rule_scope')}
                  </th>
                  <th className="w-36 border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
                    {localize('com_ui_project_meta_ads_primary_metric')}
                  </th>
                  <th className="w-40 border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
                    {localize('com_ui_project_meta_ads_last_record')}
                  </th>
                  <th className="w-24 border-b border-slate-200/70 px-4 py-3 text-right dark:border-white/10">
                    {localize('com_ui_project_meta_ads_actions')}
                  </th>
                  <th className="w-32 border-b border-slate-200/70 px-4 py-3 text-right dark:border-white/10">
                    {localize('com_ui_project_meta_ads_spend')}
                  </th>
                  <th className="w-56 border-b border-slate-200/70 px-4 py-3 text-right dark:border-white/10">
                    {localize('com_ui_project_meta_ads_actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row) => {
                  const ruleKey = getRulePerformanceKey(row);
                  const performance = performanceByKey.get(ruleKey);
                  return (
                    <RuleListItem
                      key={row.key}
                      row={row}
                      performance={performance}
                      currency={currency}
                      canUseMetaAdsActions={canUseMetaAdsActions}
                      saving={saving}
                      localize={localize}
                      onSelect={() => setSelectedRuleKey(ruleKey)}
                      onToggleRuleRow={onToggleRuleRow}
                      onEditGlobalRule={onEditGlobalRule}
                      onEditRuleGroup={onEditRuleGroup}
                      onEditRuleOverride={onEditRuleOverride}
                      onDeleteRuleGroup={onDeleteRuleGroup}
                      onDeleteRuleOverride={onDeleteRuleOverride}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </MetaAdsPanel>
      <RulePerformanceDetailsModal
        row={selectedRow}
        performance={selectedPerformance}
        currency={currency}
        localize={localize}
        onClose={() => setSelectedRuleKey(null)}
      />
    </div>
  );
}

function RuleListItem({
  row,
  performance,
  currency,
  canUseMetaAdsActions,
  saving,
  localize,
  onSelect,
  onToggleRuleRow,
  onEditGlobalRule,
  onEditRuleGroup,
  onEditRuleOverride,
  onDeleteRuleGroup,
  onDeleteRuleOverride,
}: {
  row: RuleRow;
  performance?: ProjectMetaAdsRulePerformanceItem;
  currency: string;
  canUseMetaAdsActions: boolean;
  saving: boolean;
  localize: Localize;
  onSelect: () => void;
  onToggleRuleRow: (row: RuleRow) => void;
  onEditGlobalRule: () => void;
  onEditRuleGroup: (group: MetaAdsRuleGroup) => void;
  onEditRuleOverride: (override: MetaAdsRuleOverride) => void;
  onDeleteRuleGroup: (groupId?: string) => void;
  onDeleteRuleOverride: (override: MetaAdsRuleOverride) => void;
}) {
  const statusLabel = performance
    ? getRuleTableStatusLabel(performance, localize)
    : localize('com_ui_project_meta_ads_rule_no_execution');
  const canMutateRow = row.type === 'global' || Boolean(row.group) || Boolean(row.override);
  const onEdit = () => {
    if (row.type === 'global') {
      onEditGlobalRule();
      return;
    }
    if (row.group) {
      onEditRuleGroup(row.group);
      return;
    }
    if (row.override) {
      onEditRuleOverride(row.override);
    }
  };

  return (
    <tr
      data-testid="meta-ads-rule-row"
      onClick={onSelect}
      className="group cursor-pointer bg-white/60 transition duration-200 odd:bg-slate-50/60 hover:bg-teal-50/70 dark:bg-white/[0.025] dark:odd:bg-white/[0.045] dark:hover:bg-teal-300/[0.08]"
    >
      <td className="border-b border-slate-200/60 px-4 py-4 align-top dark:border-white/[0.06]">
        <span
          className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
            row.enabled
              ? 'border-emerald-300/45 bg-emerald-50 text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-100'
              : 'border-amber-300/45 bg-amber-50 text-amber-700 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100'
          }`}
        >
          {localize(
            row.enabled
              ? 'com_ui_project_meta_ads_rule_enabled'
              : 'com_ui_project_meta_ads_rule_disabled',
          )}
        </span>
        {!canMutateRow && (
          <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {localize('com_ui_project_meta_ads_rule_history')}
          </div>
        )}
      </td>
      <td className="border-b border-slate-200/60 px-4 py-4 align-top dark:border-white/[0.06]">
        <div className="min-w-0 max-w-full">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {localize(getRuleRowTypeLabelKey(row.type))}
            </span>
          </div>
          <NameWithTooltip
            value={row.name}
            className="mt-2 font-semibold text-slate-950 dark:text-white"
          />
          <div className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
            {row.scopeLabel}
          </div>
        </div>
      </td>
      <td className="border-b border-slate-200/60 px-4 py-4 align-top font-mono uppercase text-slate-900 dark:border-white/[0.06] dark:text-white">
        {row.rules.primaryMetric ?? 'cpa'}
        <div className="mt-1 text-[11px] font-semibold normal-case text-slate-600 dark:text-slate-300">
          {getRuleTargetMetricValue(row.rules, currency)}
        </div>
      </td>
      <td className="border-b border-slate-200/60 px-4 py-4 align-top font-mono text-slate-700 dark:border-white/[0.06] dark:text-slate-200">
        {formatRuleDateTime(performance?.lastActionAt)}
      </td>
      <td className="border-b border-slate-200/60 px-4 py-4 text-right align-top font-mono text-slate-900 dark:border-white/[0.06] dark:text-white">
        {performance?.actionCount ?? 0}
      </td>
      <td className="border-b border-slate-200/60 px-4 py-4 text-right align-top font-mono text-slate-900 dark:border-white/[0.06] dark:text-white">
        {formatMoney(performance?.totalSpend, currency)}
        <div className={`mt-1 text-[11px] font-semibold ${getStatusTone(performance?.status)}`}>
          {statusLabel}
        </div>
      </td>
      <td className="border-b border-slate-200/60 px-4 py-4 align-top dark:border-white/[0.06]">
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
            className="rounded-lg border border-teal-300/40 px-2 py-1 text-[11px] font-semibold text-teal-700 transition hover:bg-teal-50 dark:border-teal-300/25 dark:text-teal-100 dark:hover:bg-teal-300/10"
          >
            {localize('com_ui_project_meta_ads_view_details')}
          </button>
          <button
            type="button"
            aria-label={localize(
              row.enabled
                ? 'com_ui_project_meta_ads_disable_rule'
                : 'com_ui_project_meta_ads_enable_rule',
            )}
            disabled={!canUseMetaAdsActions || saving || !canMutateRow}
            onClick={(event) => {
              event.stopPropagation();
              onToggleRuleRow(row);
            }}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-teal-300/60 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
          >
            {localize(
              row.enabled
                ? 'com_ui_project_meta_ads_disable_rule'
                : 'com_ui_project_meta_ads_enable_rule',
            )}
          </button>
          <button
            type="button"
            aria-label={localize('com_ui_project_meta_ads_edit_rule')}
            disabled={!canUseMetaAdsActions || !canMutateRow}
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-teal-300/60 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
          >
            {localize('com_ui_project_meta_ads_edit_rule')}
          </button>
          {row.type !== 'global' && canMutateRow && (
            <button
              type="button"
              aria-label={localize('com_ui_project_meta_ads_delete_rule')}
              disabled={!canUseMetaAdsActions}
              onClick={(event) => {
                event.stopPropagation();
                if (row.group) {
                  onDeleteRuleGroup(row.group.id);
                  return;
                }
                if (row.override) {
                  onDeleteRuleOverride(row.override);
                }
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-red-300/60 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:text-red-100"
            >
              {localize('com_ui_project_meta_ads_delete_rule')}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function RulePerformanceDetailsModal({
  row,
  performance,
  currency,
  localize,
  onClose,
}: {
  row: RuleRow | null;
  performance: ProjectMetaAdsRulePerformanceItem | null;
  currency: string;
  localize: Localize;
  onClose: () => void;
}) {
  return (
    <OGDialog
      open={Boolean(row)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      {row && (
        <OGDialogContent
          overlayStyle={{ zIndex: 10030 }}
          style={{ zIndex: 10040 }}
          className="flex h-[92dvh] w-[min(96vw,1540px)] max-w-none flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-0 text-slate-950 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.75)] dark:border-white/10 dark:bg-[#121a2b] dark:text-slate-50 dark:shadow-[0_28px_90px_-54px_rgba(0,0,0,0.95)]"
        >
          <OGDialogHeader className="shrink-0 border-b border-slate-200/75 bg-slate-50 px-5 py-4 text-left dark:border-white/10 dark:bg-[#172033]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_rule_details')}
            </div>
            <OGDialogTitle className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
              {row.name}
            </OGDialogTitle>
            <div className="mt-1 max-w-[84ch] truncate text-xs text-slate-500 dark:text-slate-400">
              {row.scopeLabel}
            </div>
          </OGDialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <RuleCenterDetailPanel
              row={row}
              performance={performance}
              currency={currency}
              localize={localize}
            />
          </div>
        </OGDialogContent>
      )}
    </OGDialog>
  );
}

function RuleCenterDetailPanel({
  row,
  performance,
  currency,
  localize,
}: {
  row: RuleRow;
  performance: ProjectMetaAdsRulePerformanceItem | null;
  currency: string;
  localize: Localize;
}) {
  const suppressGeneralStatus = Boolean(performance && hasMultipleEvaluatedEntities(performance));
  return (
    <div className="space-y-4">
      <MetaAdsPanel className="p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_rule_details')}
            </div>
            <div className="mt-1 break-words text-lg font-semibold text-slate-950 dark:text-white">
              {row.name}
            </div>
            <div className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
              {row.scopeLabel}
            </div>
          </div>
          <RuleDetailStatus
            performance={performance}
            suppressGeneralStatus={suppressGeneralStatus}
            localize={localize}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailMetric
            label={localize('com_ui_project_meta_ads_rule_type')}
            value={localize(getRuleRowTypeLabelKey(row.type))}
          />
          <DetailMetric
            label={localize('com_ui_project_meta_ads_target_result_type')}
            value={getResultTypeLabel(row.rules.targetResultType, localize)}
          />
          <DetailMetric
            label={localize('com_ui_project_meta_ads_primary_metric')}
            value={row.rules.primaryMetric ?? 'cpa'}
          />
          <DetailMetric
            label={localize('com_ui_project_meta_ads_cooldown')}
            value={localize('com_ui_project_meta_ads_cooldown_hours_value', {
              0: String(row.rules.cooldownHours),
            })}
          />
          <DetailMetric
            label={localize('com_ui_project_meta_ads_rule_goal')}
            value={getRuleTargetMetricValue(row.rules, currency)}
          />
          <DetailMetric
            label={localize('com_ui_project_meta_ads_budget_range')}
            value={`${formatMoney(row.rules.minDailyBudget, currency)} - ${formatMoney(row.rules.maxDailyBudget, currency)}`}
          />
          <DetailMetric
            label={localize('com_ui_project_meta_ads_actions')}
            value={String(performance?.actionCount ?? 0)}
          />
          <DetailMetric
            label={localize('com_ui_project_meta_ads_spend')}
            value={formatMoney(performance?.totalSpend, currency)}
          />
        </div>
      </MetaAdsPanel>

      {performance ? (
        <>
          <PerformanceComparisonPanel
            item={performance}
            currency={currency}
            localize={localize}
            suppressStatus={suppressGeneralStatus}
          />
          {suppressGeneralStatus && (
            <EntityStatusSummaryPanel rule={performance} localize={localize} />
          )}
          <RuleEntitiesPanel rule={performance} currency={currency} localize={localize} />
          <RuleTimelinePanel rule={performance} currency={currency} localize={localize} />
        </>
      ) : (
        <MetaAdsPanel className="p-5 text-sm text-slate-600 dark:text-slate-300">
          <div className="font-semibold text-slate-900 dark:text-white">
            {localize('com_ui_project_meta_ads_rule_no_execution')}
          </div>
          <p className="mt-2 max-w-[72ch] text-xs leading-5 text-slate-500 dark:text-slate-400">
            {localize('com_ui_project_meta_ads_rule_performance_empty_hint')}
          </p>
        </MetaAdsPanel>
      )}
    </div>
  );
}

function RuleEntitiesPanel({
  rule,
  currency,
  localize,
}: {
  rule: ProjectMetaAdsRulePerformanceItem;
  currency: string;
  localize: Localize;
}) {
  return (
    <MetaAdsPanel className="overflow-hidden p-0">
      <div className="border-b border-slate-200/70 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
        {localize('com_ui_project_meta_ads_affected_entities')}
      </div>
      {(rule.entities ?? []).length > 0 ? (
        <div className="divide-y divide-slate-200/70 dark:divide-white/10">
          {(rule.entities ?? []).map((entity) => {
            const entityName = entity.entityName ?? entity.entityId;
            const parentNames = `${entity.campaignName ?? '-'}${
              entity.adsetName ? ` · ${entity.adsetName}` : ''
            }`;
            return (
              <div
                key={`${entity.entityLevel}:${entity.entityId}`}
                className="grid gap-3 p-4 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.4fr)_repeat(7,minmax(0,0.65fr))]"
              >
                <div className="min-w-0">
                  <NameWithTooltip
                    value={entityName}
                    className="font-semibold text-slate-950 dark:text-white"
                  />
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {entity.entityLevel} ·{' '}
                    <NameWithTooltip
                      value={parentNames}
                      className="inline-block max-w-full align-bottom"
                    />
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formatRuleDateTime(entity.lastActionAt)}
                  </div>
                </div>
                <DetailMetric
                  label={localize('com_ui_project_meta_ads_status')}
                  value={
                    entity.status
                      ? localize(`com_ui_project_meta_ads_rule_performance_${entity.status}`)
                      : '-'
                  }
                />
                <DetailMetric
                  label={localize('com_ui_project_meta_ads_cpa')}
                  value={formatEntityComparison('cpa', entity, currency, localize)}
                />
                <DetailMetric
                  label={localize('com_ui_project_meta_ads_roas')}
                  value={formatEntityComparison('roas', entity, currency, localize)}
                />
                <DetailMetric
                  label={localize('com_ui_project_meta_ads_spend')}
                  value={formatMoney(entity.totalSpend, currency)}
                />
                <DetailMetric
                  label={localize('com_ui_project_meta_ads_actions')}
                  value={String(entity.actionCount)}
                />
                <DetailMetric
                  label={localize('com_ui_project_meta_ads_average_cpa')}
                  value={formatMoney(entity.averageCpa, currency)}
                />
                <DetailMetric
                  label={localize('com_ui_project_meta_ads_average_roas')}
                  value={formatMetric(entity.averageRoas)}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 text-sm text-slate-600 dark:text-slate-300">
          {rule.ruleScope ?? '-'}
        </div>
      )}
    </MetaAdsPanel>
  );
}

function RuleTimelinePanel({
  rule,
  currency,
  localize,
}: {
  rule: ProjectMetaAdsRulePerformanceItem;
  currency: string;
  localize: Localize;
}) {
  const actions = [...(rule.actions ?? [])].sort((left, right) =>
    String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')),
  );
  return (
    <MetaAdsPanel className="overflow-hidden p-0">
      <div className="border-b border-slate-200/70 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
        {localize('com_ui_project_meta_ads_rule_timeline')}
      </div>
      {actions.length > 0 ? (
        <div className="divide-y divide-slate-200/70 dark:divide-white/10">
          {actions.map((action) => (
            <div
              key={action._id ?? `${action.entityId}-${action.createdAt}`}
              className="grid gap-3 p-4 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-[150px_minmax(0,1fr)_120px_120px_minmax(0,1.2fr)]"
            >
              <div className="font-mono">{formatRuleDateTime(action.createdAt)}</div>
              <NameWithTooltip
                value={action.entityName ?? action.entityId}
                className="font-semibold text-slate-950 dark:text-white"
              />
              <div>{action.actionType}</div>
              <div className="font-mono">{formatMoney(action.cpa, currency)}</div>
              <div className="min-w-0 truncate">{action.reason ?? '-'}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 text-sm text-slate-600 dark:text-slate-300">
          {localize('com_ui_project_meta_ads_rule_no_execution')}
        </div>
      )}
    </MetaAdsPanel>
  );
}

function formatEntityComparison(
  metric: 'cpa' | 'roas',
  entity: ProjectMetaAdsRulePerformanceEntity,
  currency: string,
  localize: Localize,
) {
  const before = metric === 'cpa' ? entity.firstCpa : entity.firstRoas;
  const after = metric === 'cpa' ? entity.lastCpa : entity.lastRoas;
  const hasComparison = before != null && after != null;
  const formatValue = (value?: number | null) =>
    metric === 'cpa' ? formatMoney(value, currency) : formatMetric(value);
  if (hasComparison) {
    return `${formatValue(before)} → ${formatValue(after)}`;
  }
  if (
    (entity.status === 'awaiting_results' || entity.status === 'no_result_after_spend') &&
    before != null
  ) {
    const finalValue =
      entity.status === 'no_result_after_spend'
        ? localize('com_ui_project_meta_ads_no_result_after_spend_short')
        : localize('com_ui_project_meta_ads_awaiting_result');
    return `${formatValue(before)} → ${finalValue}`;
  }
  return localize('com_ui_project_meta_ads_insufficient_comparison_data');
}

function EntityStatusSummaryPanel({
  rule,
  localize,
}: {
  rule: ProjectMetaAdsRulePerformanceItem;
  localize: Localize;
}) {
  const summary = rule.entityStatusSummary;
  const items: Array<keyof NonNullable<ProjectMetaAdsRulePerformanceItem['entityStatusSummary']>> =
    [
      'improved',
      'regressed',
      'awaiting_results',
      'no_result_after_spend',
      'neutral',
      'insufficient_data',
    ];
  return (
    <div className="rounded-2xl border border-amber-300/30 bg-amber-50/70 p-4 dark:border-amber-300/20 dark:bg-amber-300/10">
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {localize('com_ui_project_meta_ads_entity_result_summary')}
      </div>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
        {localize('com_ui_project_meta_ads_no_general_conclusion_hint')}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((status) => (
          <div
            key={status}
            className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.045]"
          >
            <div className={`text-lg font-semibold ${getStatusTone(status)}`}>
              {summary?.[status] ?? 0}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {localize(`com_ui_project_meta_ads_rule_performance_${status}`)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformanceComparisonPanel({
  item,
  currency,
  localize,
  suppressStatus,
}: {
  item: RulePerformanceComparison;
  currency: string;
  localize: Localize;
  suppressStatus?: boolean;
}) {
  const reasons = getComparisonReasons(item);
  const missingItems = getComparisonMissingItems(item);
  const targetMetricLabel = getMetricLabel(item.targetMetric, localize);
  const isAwaitingResults = item.status === 'awaiting_results';
  const isNoResultAfterSpend = item.status === 'no_result_after_spend';
  const isWaitingForFinalValue = isAwaitingResults || isNoResultAfterSpend;
  const hasTargetMetric = Boolean(
    item.targetMetric && item.firstTargetMetric != null && item.lastTargetMetric != null,
  );
  const hasEvidence =
    item.evidenceSpend != null ||
    item.evidenceSpendThreshold != null ||
    item.evidenceSpendBasis != null;
  const targetMetricCardClassName = getTargetMetricCardClassName({
    isNoResultAfterSpend: !suppressStatus && isNoResultAfterSpend,
    isAwaitingResults: !suppressStatus && isAwaitingResults,
  });
  const targetMetricLabelClassName = getTargetMetricLabelClassName({
    isNoResultAfterSpend: !suppressStatus && isNoResultAfterSpend,
    isAwaitingResults: !suppressStatus && isAwaitingResults,
  });
  const finalValueLabel = isNoResultAfterSpend
    ? localize('com_ui_project_meta_ads_no_result_after_spend_short')
    : localize('com_ui_project_meta_ads_awaiting_result');
  let targetBeforeAfterValue = localize('com_ui_project_meta_ads_insufficient_comparison_data');
  if (hasTargetMetric) {
    targetBeforeAfterValue = `${formatComparisonMetricValue(
      item.targetMetric,
      item.firstTargetMetric,
      currency,
    )} → ${formatComparisonMetricValue(item.targetMetric, item.lastTargetMetric, currency)}`;
  } else if (isWaitingForFinalValue && item.firstTargetMetric != null) {
    targetBeforeAfterValue = `${formatComparisonMetricValue(
      item.targetMetric,
      item.firstTargetMetric,
      currency,
    )} → ${finalValueLabel}`;
  }
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {localize('com_ui_project_meta_ads_before_after')}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {item.comparisonBasis === 'real_before_after'
              ? localize('com_ui_project_meta_ads_rule_performance_basis_real')
              : localize('com_ui_project_meta_ads_rule_performance_basis_period')}
          </p>
        </div>
        {item.status && !suppressStatus && (
          <span className={`text-xs font-semibold ${getStatusTone(item.status)}`}>
            {localize(`com_ui_project_meta_ads_rule_performance_${item.status}`)}
          </span>
        )}
      </div>
      {item.targetMetric && (
        <div className={`mt-4 rounded-xl border p-4 ${targetMetricCardClassName}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div
                className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${targetMetricLabelClassName}`}
              >
                {localize('com_ui_project_meta_ads_target_metric')}
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                {targetMetricLabel}
              </div>
            </div>
            {!suppressStatus && (
              <div className={`text-sm font-semibold ${getStatusTone(item.status)}`}>
                {item.status
                  ? localize(`com_ui_project_meta_ads_rule_performance_${item.status}`)
                  : '-'}
              </div>
            )}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <DetailMetric
              label={localize('com_ui_project_meta_ads_rule_goal')}
              value={formatComparisonMetricValue(
                item.targetMetric,
                item.targetMetricGoal,
                currency,
              )}
            />
            <DetailMetric
              label={localize('com_ui_project_meta_ads_before_after')}
              value={targetBeforeAfterValue}
            />
            <DetailMetric
              label={localize('com_ui_project_meta_ads_variation')}
              value={formatSignedComparisonMetricValue(
                item.targetMetric,
                item.targetMetricDelta,
                currency,
              )}
            />
          </div>
          {hasEvidence && (
            <div className="mt-4 grid gap-3 border-t border-slate-200/70 pt-3 dark:border-white/10 md:grid-cols-4">
              <DetailMetric
                label={localize('com_ui_project_meta_ads_evidence_spend')}
                value={formatMoney(item.evidenceSpend, currency)}
              />
              <DetailMetric
                label={localize('com_ui_project_meta_ads_evidence_spend_threshold')}
                value={formatMoney(item.evidenceSpendThreshold, currency)}
              />
              <DetailMetric
                label={localize('com_ui_project_meta_ads_evidence_spend_basis')}
                value={formatMoney(item.evidenceSpendBasis, currency)}
              />
              <DetailMetric
                label={localize('com_ui_project_meta_ads_evidence_multiplier')}
                value={formatMetric(item.evidenceMultiplier)}
              />
            </div>
          )}
        </div>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <MetricComparisonBlock
          metric="cpa"
          label={localize('com_ui_project_meta_ads_cpa')}
          before={item.firstCpa}
          after={item.lastCpa}
          delta={item.cpaDelta}
          average={item.averageCpa}
          awaiting={isWaitingForFinalValue}
          finalValueLabel={finalValueLabel}
          currency={currency}
          localize={localize}
        />
        <MetricComparisonBlock
          metric="roas"
          label={localize('com_ui_project_meta_ads_roas')}
          before={item.firstRoas}
          after={item.lastRoas}
          delta={item.roasDelta}
          average={item.averageRoas}
          awaiting={isWaitingForFinalValue}
          finalValueLabel={finalValueLabel}
          currency={currency}
          localize={localize}
        />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
        <div>
          {localize('com_ui_project_meta_ads_first_record')}:{' '}
          {formatRuleDateTime(item.firstActionAt)}
        </div>
        <div>
          {localize('com_ui_project_meta_ads_last_record')}: {formatRuleDateTime(item.lastActionAt)}
        </div>
      </div>
      {(reasons.length > 0 || missingItems.length > 0) && (
        <div className="mt-4 grid gap-3 border-t border-slate-200 pt-3 text-xs dark:border-white/10 md:grid-cols-2">
          {reasons.length > 0 && (
            <div>
              <div className="font-semibold text-slate-700 dark:text-slate-200">
                {localize('com_ui_project_meta_ads_rule_performance_why')}
              </div>
              <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
                {reasons.map((reason) => (
                  <li key={reason}>{localize(reason as Parameters<typeof localize>[0])}</li>
                ))}
              </ul>
            </div>
          )}
          {missingItems.length > 0 && (
            <div>
              <div className="font-semibold text-slate-700 dark:text-slate-200">
                {localize('com_ui_project_meta_ads_rule_performance_missing')}
              </div>
              <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
                {missingItems.map((missingItem) => (
                  <li key={missingItem}>
                    {localize(missingItem as Parameters<typeof localize>[0])}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricComparisonBlock({
  metric,
  label,
  before,
  after,
  delta,
  average,
  awaiting,
  finalValueLabel,
  currency,
  localize,
}: {
  metric: 'cpa' | 'roas';
  label: string;
  before?: number | null;
  after?: number | null;
  delta?: number | null;
  average?: number | null;
  awaiting?: boolean;
  finalValueLabel?: string;
  currency: string;
  localize: Localize;
}) {
  const hasData = before != null && after != null;
  const formatValue = (value?: number | null) =>
    metric === 'cpa' ? formatMoney(value, currency) : formatMetric(value);
  const formattedDelta =
    metric === 'cpa' ? formatSignedMoneyValue(delta, currency) : formatSignedMetricValue(delta);
  let comparisonContent = (
    <div className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
      {localize('com_ui_project_meta_ads_insufficient_comparison_data')}
    </div>
  );
  if (hasData) {
    comparisonContent = (
      <div className="mt-2 font-mono text-base font-semibold text-slate-950 dark:text-white">
        {formatValue(before)} → {formatValue(after)}
      </div>
    );
  } else if (awaiting && before != null) {
    comparisonContent = (
      <div className="mt-2 font-mono text-base font-semibold text-slate-950 dark:text-white">
        {formatValue(before)} →{' '}
        {finalValueLabel ?? localize('com_ui_project_meta_ads_awaiting_result')}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className={`text-xs font-semibold ${getDeltaTone(metric, delta)}`}>
          {localize('com_ui_project_meta_ads_variation')}: {formattedDelta}
        </div>
      </div>
      {comparisonContent}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {localize('com_ui_project_meta_ads_before')}
          </div>
          <div className="mt-1 font-mono text-slate-800 dark:text-slate-100">
            {formatValue(before)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {localize('com_ui_project_meta_ads_after')}
          </div>
          <div className="mt-1 font-mono text-slate-800 dark:text-slate-100">
            {awaiting
              ? (finalValueLabel ?? localize('com_ui_project_meta_ads_awaiting_result'))
              : formatValue(after)}
          </div>
        </div>
      </div>
      <div className="mt-3 border-t border-slate-200 pt-2 text-xs dark:border-white/10">
        <div className="text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_average_in_period')}
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {localize(
            metric === 'cpa'
              ? 'com_ui_project_meta_ads_average_cpa'
              : 'com_ui_project_meta_ads_average_roas',
          )}
        </div>
        <span className="mt-1 block font-mono font-semibold text-slate-900 dark:text-white">
          {formatValue(average)}
        </span>
      </div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 font-mono text-xs text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  );
}

function RuleDetailStatus({
  performance,
  suppressGeneralStatus,
  localize,
}: {
  performance: ProjectMetaAdsRulePerformanceItem | null;
  suppressGeneralStatus: boolean;
  localize: Localize;
}) {
  if (!performance) {
    return (
      <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
        {localize('com_ui_project_meta_ads_rule_no_execution')}
      </div>
    );
  }
  const label = suppressGeneralStatus
    ? localize('com_ui_project_meta_ads_no_general_conclusion')
    : localize(`com_ui_project_meta_ads_rule_performance_${performance.status}`);
  return (
    <div className={`text-sm font-semibold ${getStatusTone(performance.status)}`}>{label}</div>
  );
}
