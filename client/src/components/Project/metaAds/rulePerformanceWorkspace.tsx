import { useState } from 'react';
import { OGDialog, OGDialogTitle, OGDialogHeader, OGDialogContent } from '@librechat/client';
import type {
  ProjectMetaAdsRulePerformanceItem,
  ProjectMetaAdsRulePerformanceResponse,
} from 'librechat-data-provider';

import { formatMoney, formatMetric } from './formatters';
import { MetaAdsMetricCard, MetaAdsPanel } from './ui';
import { MetaAdsPeriodControls } from './periodControls';
import { metaAdsModalHeader, metaAdsModalShell, metaAdsModalTile } from './chrome';
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
                    {rule.ruleName ?? localize('com_ui_project_meta_ads_unattributed_rule')}
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
                    {formatMoney(rule.averageCpa, currency)} / {formatMetric(rule.averageRoas)}
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
              {rule.ruleName ?? localize('com_ui_project_meta_ads_unattributed_rule')}
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
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10">
              <div className="border-b border-slate-200/70 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
                {localize('com_ui_project_meta_ads_affected_entities')}
              </div>
              {(rule.entities ?? []).length > 0 ? (
                <div className="max-h-[50vh] divide-y divide-slate-200/70 overflow-y-auto dark:divide-white/10">
                  {(rule.entities ?? []).map((entity) => (
                    <div
                      key={`${entity.entityLevel}:${entity.entityId}`}
                      className="grid gap-3 p-4 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,0.7fr))]"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-950 dark:text-white">
                          {entity.entityName ?? entity.entityId}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {entity.entityLevel} · {entity.campaignName ?? '-'}
                          {entity.adsetName ? ` · ${entity.adsetName}` : ''}
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
                        label={localize('com_ui_project_meta_ads_cost_result')}
                        value={`${formatMoney(entity.averageCpa, currency)} / ${formatMetric(
                          entity.averageRoas,
                        )}`}
                      />
                    </div>
                  ))}
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
