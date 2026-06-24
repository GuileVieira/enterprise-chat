import { useState } from 'react';
import { OGDialog, OGDialogTitle, OGDialogHeader, OGDialogContent } from '@librechat/client';
import type {
  ProjectMetaAdsRulePerformanceItem,
  ProjectMetaAdsRulePerformanceEntity,
  ProjectMetaAdsRulePerformanceResponse,
} from 'librechat-data-provider';

import { formatMoney, formatMetric } from './formatters';
import { MetaAdsMetricCard, MetaAdsPanel } from './ui';
import { MetaAdsPeriodControls } from './periodControls';
import { metaAdsModalHeader, metaAdsModalShell, metaAdsModalTile } from './chrome';
import { MetaAdsNameTooltip } from './overviewCells';
import type { Localize, RuleRow } from './types';
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

function getRuleScopeSummary(rule: ProjectMetaAdsRulePerformanceItem, localize: Localize) {
  const entityCount = rule.entities?.length ?? 0;
  if (entityCount > 0) {
    if (entityCount === 1) {
      return localize('com_ui_project_meta_ads_rule_entities_count_one');
    }
    return localize('com_ui_project_meta_ads_rule_entities_count', {
      0: String(entityCount),
    });
  }
  return rule.ruleScope ?? '-';
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
  return 'text-slate-600 dark:text-slate-300';
}

function getDeltaTone(metric: 'cpa' | 'roas', value?: number | null) {
  if (value == null || Number.isNaN(value) || value === 0) {
    return 'text-slate-500 dark:text-slate-400';
  }
  const improved = metric === 'cpa' ? value < 0 : value > 0;
  return improved ? 'text-emerald-700 dark:text-emerald-200' : 'text-rose-700 dark:text-rose-200';
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

function getComparisonReasons(item: RulePerformanceComparison) {
  const reasons: string[] = [];
  if (item.cpaDelta != null && item.cpaDelta < 0) {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_cpa_down');
  }
  if (item.cpaDelta != null && item.cpaDelta > 0) {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_cpa_up');
  }
  if (item.roasDelta != null && item.roasDelta > 0) {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_roas_up');
  }
  if (item.roasDelta != null && item.roasDelta < 0) {
    reasons.push('com_ui_project_meta_ads_rule_performance_reason_roas_down');
  }
  return reasons;
}

function getComparisonMissingItems(item: RulePerformanceComparison) {
  const missingItems: string[] = [];
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
  selectedRule,
  onClearSelectedRule,
}: {
  data?: ProjectMetaAdsRulePerformanceResponse;
  fetching: boolean;
  period: Omit<MetaAdsPeriodControlProps, 'localize' | 'testIdPrefix'>;
  currency: string;
  localize: Localize;
  selectedRule: RuleRow | null;
  onClearSelectedRule: () => void;
}) {
  const selectedRuleKey = selectedRule ? getRulePerformanceKey(selectedRule) : null;
  const rules = selectedRule
    ? (data?.rules ?? []).filter((rule) => rule.ruleKey === selectedRuleKey)
    : (data?.rules ?? []);
  const totalActions = rules.reduce((sum, rule) => sum + rule.actionCount, 0);
  const pausedAds = rules.reduce((sum, rule) => sum + rule.pausedAdCount, 0);
  const showEmptyState = !fetching && rules.length === 0;
  const [selectedRuleDetails, setSelectedRuleDetails] =
    useState<ProjectMetaAdsRulePerformanceItem | null>(null);

  return (
    <div
      id="meta-ads-rulePerformance-tab-panel"
      role="tabpanel"
      aria-labelledby="meta-ads-tab-rulePerformance"
      data-testid="meta-ads-rule-performance-tab-panel"
      className="space-y-4 p-4"
    >
      <MetaAdsPanel className="p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetaAdsPeriodControls {...period} localize={localize} testIdPrefix="meta-ads-rules" />
        </div>
        {selectedRule && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-teal-300/35 bg-teal-50/80 px-3 py-2 text-xs text-teal-900 dark:border-teal-300/20 dark:bg-teal-300/10 dark:text-teal-100">
            <span className="font-semibold">
              {localize('com_ui_project_meta_ads_selected_rule_performance', {
                0: selectedRule.name,
              })}
            </span>
            <button
              type="button"
              onClick={onClearSelectedRule}
              className="rounded-lg border border-teal-300/40 px-2 py-1 font-semibold transition hover:bg-teal-100 dark:border-teal-300/25 dark:hover:bg-teal-300/10"
            >
              {localize('com_ui_project_meta_ads_clear_rule_filter')}
            </button>
          </div>
        )}
      </MetaAdsPanel>
      {fetching && (
        <div className="rounded-2xl border border-amber-300/35 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
          {localize('com_ui_project_meta_ads_loading')}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetaAdsMetricCard
          label={localize('com_ui_project_meta_ads_rules')}
          value={String(rules.length)}
        />
        <MetaAdsMetricCard
          label={localize('com_ui_project_meta_ads_actions')}
          value={String(totalActions)}
        />
        <MetaAdsMetricCard
          label={localize('com_ui_project_meta_ads_paused_creatives')}
          value={String(pausedAds)}
        />
        <MetaAdsMetricCard
          label={localize('com_ui_project_meta_ads_spend')}
          value={formatMoney(
            rules.reduce((sum, rule) => sum + rule.totalSpend, 0),
            currency,
          )}
        />
      </div>
      <MetaAdsPanel className="overflow-x-auto p-0">
        {showEmptyState ? (
          <div className="px-4 py-8 text-sm text-slate-600 dark:text-slate-300">
            <div className="font-semibold text-slate-900 dark:text-white">
              {selectedRule
                ? localize('com_ui_project_meta_ads_rule_performance_empty_selected_title', {
                    0: selectedRule.name,
                  })
                : localize('com_ui_project_meta_ads_rule_performance_empty_title')}
            </div>
            <p className="mt-2 max-w-[72ch] text-xs leading-5 text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_rule_performance_empty_hint')}
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0 text-left text-xs">
            <thead className="bg-slate-50/90 text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:bg-white/[0.035] dark:text-slate-400">
              <tr>
                {[
                  'com_ui_project_meta_ads_rule',
                  'com_ui_project_meta_ads_rule_scope',
                  'com_ui_project_meta_ads_actions',
                  'com_ui_project_meta_ads_paused_creatives',
                  'com_ui_project_meta_ads_spend',
                  'com_ui_project_meta_ads_cost_result',
                  'com_ui_project_meta_ads_status',
                ].map((key) => (
                  <th
                    key={key}
                    className="border-b border-slate-200/70 px-3 py-2 dark:border-white/10"
                  >
                    {localize(key as Parameters<typeof localize>[0])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.ruleKey}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRuleDetails(rule)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedRuleDetails(rule);
                    }
                  }}
                  className="cursor-pointer transition odd:bg-slate-50/60 hover:bg-teal-50/80 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-300/60 dark:odd:bg-white/[0.045] dark:hover:bg-teal-300/10"
                >
                  <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                    <NameWithTooltip
                      value={rule.ruleName ?? localize('com_ui_project_meta_ads_unattributed_rule')}
                    />
                  </td>
                  <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                    {getRuleScopeSummary(rule, localize)}
                  </td>
                  <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                    {rule.actionCount}
                  </td>
                  <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                    {rule.pausedAdCount}
                  </td>
                  <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                    {formatMoney(rule.totalSpend, currency)}
                  </td>
                  <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                    <div className="grid gap-1 font-mono text-[11px] text-slate-700 dark:text-slate-200">
                      <span>
                        {localize('com_ui_project_meta_ads_average_cpa')}:{' '}
                        {formatMoney(rule.averageCpa, currency)}
                      </span>
                      <span>
                        {localize('com_ui_project_meta_ads_average_roas')}:{' '}
                        {formatMetric(rule.averageRoas)}
                      </span>
                    </div>
                  </td>
                  <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {localize(`com_ui_project_meta_ads_rule_performance_${rule.status}`)}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-700 dark:text-teal-200">
                        {localize('com_ui_project_meta_ads_view_details')}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </MetaAdsPanel>
      <RulePerformanceDetailsDialog
        rule={selectedRuleDetails}
        currency={currency}
        localize={localize}
        onClose={() => setSelectedRuleDetails(null)}
      />
    </div>
  );
}

function RulePerformanceDetailsDialog({
  rule,
  currency,
  localize,
  onClose,
}: {
  rule: ProjectMetaAdsRulePerformanceItem | null;
  currency: string;
  localize: Localize;
  onClose: () => void;
}) {
  return (
    <OGDialog
      open={Boolean(rule)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      {rule && (
        <OGDialogContent className={`max-w-4xl p-0 ${metaAdsModalShell}`}>
          <OGDialogHeader className={metaAdsModalHeader}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_rule_details')}
            </div>
            <OGDialogTitle className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
              <NameWithTooltip
                value={rule.ruleName ?? localize('com_ui_project_meta_ads_unattributed_rule')}
              />
            </OGDialogTitle>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {rule.ruleScope ?? '-'}
            </div>
          </OGDialogHeader>
          <div className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <MetricTile
                label={localize('com_ui_project_meta_ads_actions')}
                value={String(rule.actionCount)}
              />
              <MetricTile
                label={localize('com_ui_project_meta_ads_paused_creatives')}
                value={String(rule.pausedAdCount)}
              />
              <MetricTile
                label={localize('com_ui_project_meta_ads_spend')}
                value={formatMoney(rule.totalSpend, currency)}
              />
              <MetricTile
                label={localize('com_ui_project_meta_ads_status')}
                value={localize(`com_ui_project_meta_ads_rule_performance_${rule.status}`)}
              />
            </div>
            <PerformanceComparisonPanel item={rule} currency={currency} localize={localize} />
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10">
              <div className="border-b border-slate-200/70 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
                {localize('com_ui_project_meta_ads_affected_entities')}
              </div>
              {(rule.entities ?? []).length > 0 ? (
                <div className="max-h-[50vh] divide-y divide-slate-200/70 overflow-y-auto dark:divide-white/10">
                  {(rule.entities ?? []).map((entity) => {
                    const entityName = entity.entityName ?? entity.entityId;
                    const parentNames = `${entity.campaignName ?? '-'}${
                      entity.adsetName ? ` · ${entity.adsetName}` : ''
                    }`;
                    return (
                      <div
                        key={`${entity.entityLevel}:${entity.entityId}`}
                        className="grid gap-3 p-4 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(0,0.7fr))]"
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
                          label={localize('com_ui_project_meta_ads_actions')}
                          value={String(entity.actionCount)}
                        />
                        <DetailMetric
                          label={localize('com_ui_project_meta_ads_paused_creatives')}
                          value={String(entity.pausedAdCount)}
                        />
                        <DetailMetric
                          label={localize('com_ui_project_meta_ads_spend')}
                          value={formatMoney(entity.totalSpend, currency)}
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
            </div>
          </div>
        </OGDialogContent>
      )}
    </OGDialog>
  );
}

function PerformanceComparisonPanel({
  item,
  currency,
  localize,
}: {
  item: RulePerformanceComparison;
  currency: string;
  localize: Localize;
}) {
  const reasons = getComparisonReasons(item);
  const missingItems = getComparisonMissingItems(item);
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
        {item.status && (
          <span className={`text-xs font-semibold ${getStatusTone(item.status)}`}>
            {localize(`com_ui_project_meta_ads_rule_performance_${item.status}`)}
          </span>
        )}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <MetricComparisonBlock
          metric="cpa"
          label={localize('com_ui_project_meta_ads_cpa')}
          before={item.firstCpa}
          after={item.lastCpa}
          delta={item.cpaDelta}
          average={item.averageCpa}
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
  currency,
  localize,
}: {
  metric: 'cpa' | 'roas';
  label: string;
  before?: number | null;
  after?: number | null;
  delta?: number | null;
  average?: number | null;
  currency: string;
  localize: Localize;
}) {
  const hasData = before != null && after != null;
  const formatValue = (value?: number | null) =>
    metric === 'cpa' ? formatMoney(value, currency) : formatMetric(value);
  const formattedDelta =
    metric === 'cpa' ? formatSignedMoneyValue(delta, currency) : formatSignedMetricValue(delta);
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
      {hasData ? (
        <div className="mt-2 font-mono text-base font-semibold text-slate-950 dark:text-white">
          {formatValue(before)} → {formatValue(after)}
        </div>
      ) : (
        <div className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          {localize('com_ui_project_meta_ads_insufficient_comparison_data')}
        </div>
      )}
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
            {formatValue(after)}
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

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className={metaAdsModalTile}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{value}</div>
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
