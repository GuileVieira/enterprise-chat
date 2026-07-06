import { Play, Pause, Trash, PencilSimple } from '@phosphor-icons/react';

import { getRuleRowTypeLabelKey } from './rules';
import { formatMoney, getResultTypeLabel, getRuleTargetMetricValue } from './formatters';
import type { Localize, RuleRow, MetaAdsRuleGroup, MetaAdsRuleOverride } from './types';

export function MetaAdsRulesWorkspace({
  rows,
  currency,
  canCreateRuleGroup,
  canUseMetaAdsActions,
  saving,
  localize,
  primaryButtonClassName,
  onCreateRuleGroup,
  onToggleRuleRow,
  onEditGlobalRule,
  onEditRuleGroup,
  onEditRuleOverride,
  onDeleteRuleGroup,
  onDeleteRuleOverride,
  onOpenRulePerformance,
}: {
  rows: RuleRow[];
  currency: string;
  canCreateRuleGroup: boolean;
  canUseMetaAdsActions: boolean;
  saving: boolean;
  localize: Localize;
  primaryButtonClassName: string;
  onCreateRuleGroup: () => void;
  onToggleRuleRow: (row: RuleRow) => void;
  onEditGlobalRule: () => void;
  onEditRuleGroup: (group: MetaAdsRuleGroup) => void;
  onEditRuleOverride: (override: MetaAdsRuleOverride) => void;
  onDeleteRuleGroup: (groupId: string) => void;
  onDeleteRuleOverride: (override: MetaAdsRuleOverride) => void;
  onOpenRulePerformance: (row: RuleRow) => void;
}) {
  return (
    <div className="border-t border-slate-200/70 bg-white/35 p-4 dark:border-white/10 dark:bg-slate-950/10">
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            {localize('com_ui_project_meta_ads_rules_workspace')}
          </h4>
          <p className="mt-1 max-w-[64ch] text-xs leading-5 text-slate-500 dark:text-slate-400">
            {localize('com_ui_project_meta_ads_rules_workspace_hint')}
          </p>
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
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/[0.045]">
        <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0 text-left text-xs">
          <thead className="bg-slate-50/90 text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:bg-white/[0.035] dark:text-slate-400">
            <tr>
              <th className="w-20 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
                {localize('com_ui_project_meta_ads_status')}
              </th>
              <th className="w-36 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
                {localize('com_ui_project_meta_ads_rule_type')}
              </th>
              <th className="w-64 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
                {localize('com_ui_project_meta_ads_rule_scope')}
              </th>
              <th className="w-36 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
                {localize('com_ui_project_meta_ads_target_result_type')}
              </th>
              <th className="w-28 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
                {localize('com_ui_project_meta_ads_primary_metric')}
              </th>
              <th className="w-32 border-b border-slate-200/70 px-3 py-2 text-right dark:border-white/10">
                {localize('com_ui_project_meta_ads_rule_goal')}
              </th>
              <th className="w-36 border-b border-slate-200/70 px-3 py-2 text-right dark:border-white/10">
                {localize('com_ui_project_meta_ads_budget_range')}
              </th>
              <th className="w-24 border-b border-slate-200/70 px-3 py-2 text-right dark:border-white/10">
                {localize('com_ui_project_meta_ads_cooldown')}
              </th>
              <th className="w-32 border-b border-slate-200/70 px-3 py-2 text-right dark:border-white/10">
                {localize('com_ui_project_meta_ads_actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                data-testid="meta-ads-rule-row"
                title={localize('com_ui_project_meta_ads_open_rule_performance', {
                  0: row.name,
                })}
                onClick={() => onOpenRulePerformance(row)}
                className="group cursor-pointer bg-white/60 transition duration-200 odd:bg-slate-50/60 hover:bg-teal-50/70 dark:bg-white/[0.035] dark:odd:bg-white/[0.055] dark:hover:bg-teal-300/[0.08]"
              >
                <td className="border-b border-white/[0.06] px-3 py-2">
                  <button
                    type="button"
                    disabled={!canUseMetaAdsActions || saving}
                    aria-label={
                      row.enabled
                        ? localize('com_ui_project_meta_ads_disable_rule')
                        : localize('com_ui_project_meta_ads_enable_rule')
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleRuleRow(row);
                    }}
                    className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 font-semibold transition ${
                      row.enabled
                        ? 'border-emerald-300/45 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-100 dark:hover:bg-emerald-300/15'
                        : 'border-amber-300/45 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100 dark:hover:bg-amber-300/15'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {row.enabled ? <Pause size={14} /> : <Play size={14} />}
                    {localize(
                      row.enabled
                        ? 'com_ui_project_meta_ads_rule_enabled'
                        : 'com_ui_project_meta_ads_rule_disabled',
                    )}
                  </button>
                </td>
                <td className="border-b border-white/[0.06] px-3 py-2">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {localize(getRuleRowTypeLabelKey(row.type))}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {row.precedenceLabel}
                  </div>
                </td>
                <td className="border-b border-white/[0.06] px-3 py-2">
                  <div className="truncate font-semibold text-slate-900 dark:text-white">
                    {row.name}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {row.scopeLabel}
                  </div>
                </td>
                <td className="border-b border-slate-200/60 px-3 py-2 text-slate-600 dark:border-white/[0.06] dark:text-slate-300">
                  {getResultTypeLabel(row.rules.targetResultType, localize)}
                </td>
                <td className="border-b border-slate-200/60 px-3 py-2 font-mono uppercase text-slate-900 dark:border-white/[0.06] dark:text-white">
                  {row.rules.primaryMetric ?? 'cpa'}
                </td>
                <td className="border-b border-slate-200/60 px-3 py-2 text-right font-mono text-slate-900 dark:border-white/[0.06] dark:text-white">
                  {getRuleTargetMetricValue(row.rules, currency)}
                </td>
                <td className="border-b border-slate-200/60 px-3 py-2 text-right font-mono text-slate-900 dark:border-white/[0.06] dark:text-white">
                  {formatMoney(row.rules.minDailyBudget, currency)} -{' '}
                  {formatMoney(row.rules.maxDailyBudget, currency)}
                </td>
                <td className="border-b border-slate-200/60 px-3 py-2 text-right font-mono text-slate-900 dark:border-white/[0.06] dark:text-white">
                  {localize('com_ui_project_meta_ads_cooldown_hours_value', {
                    0: String(row.rules.cooldownHours),
                  })}
                </td>
                <td className="border-b border-white/[0.06] px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      disabled={!canUseMetaAdsActions}
                      aria-label={localize('com_ui_project_meta_ads_edit_rule')}
                      onClick={(event) => {
                        event.stopPropagation();
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
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-teal-300/60 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:border-teal-300/40 dark:hover:text-white"
                    >
                      <PencilSimple size={15} />
                    </button>
                    {row.type !== 'global' && (
                      <button
                        type="button"
                        disabled={!canUseMetaAdsActions}
                        aria-label={localize('com_ui_project_meta_ads_delete_rule')}
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
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-red-300/60 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:border-red-300/40 dark:hover:text-red-100"
                      >
                        <Trash size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 1 && (
        <div className="rounded-b-2xl border-x border-b border-dashed border-slate-200/80 px-3 py-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_rules_empty')}
        </div>
      )}
    </div>
  );
}
