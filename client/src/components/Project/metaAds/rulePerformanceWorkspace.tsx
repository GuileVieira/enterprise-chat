import type { ProjectMetaAdsRulePerformanceResponse } from 'librechat-data-provider';

import { formatMoney, formatMetric } from './formatters';
import { MetaAdsMetricCard, MetaAdsPanel } from './ui';
import { MetaAdsPeriodControls } from './periodControls';
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
                <tr key={rule.ruleKey} className="odd:bg-slate-50/60 dark:odd:bg-white/[0.045]">
                  <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                    {rule.ruleName ?? localize('com_ui_project_meta_ads_unattributed_rule')}
                  </td>
                  <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                    {rule.ruleScope ?? '-'}
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
                    {localize(`com_ui_project_meta_ads_rule_performance_${rule.status}`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </MetaAdsPanel>
    </div>
  );
}
