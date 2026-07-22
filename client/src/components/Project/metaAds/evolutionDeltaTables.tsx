import type { ReactNode } from 'react';
import type { ProjectMetaAdsEvolutionDelta } from 'librechat-data-provider';

import { getDeltaEntityId, getDeltaEntityName } from './evolution';
import { formatSignedMetric, formatSignedMoney } from './formatters';
import { MetaAdsEvolutionNameCell } from './overviewCells';
import type { Localize } from './types';

function getEvolutionDeltaClass(value: number | null | undefined, improvesWhenNegative = false) {
  if (value == null || Number.isNaN(value) || Math.abs(value) <= 0.005) {
    return 'text-[#d8d0c2]';
  }
  return value < 0 === improvesWhenNegative ? 'text-emerald-200' : 'text-rose-200';
}

function EvolutionTableShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#172033]">
      <div className="border-b border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#121a2b]">
        <h5 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h5>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function MetaAdsEvolutionDeltaTables({
  bestEvolution,
  evolutionAlerts,
  currency,
  localize,
  cleanName,
}: {
  bestEvolution: ProjectMetaAdsEvolutionDelta[];
  evolutionAlerts: ProjectMetaAdsEvolutionDelta[];
  currency: string;
  localize: Localize;
  cleanName: (value: string | undefined, fallback: string) => string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <EvolutionTableShell title={localize('com_ui_project_meta_ads_best_evolution')}>
        <table className="w-full min-w-[34rem] text-left text-xs">
          <thead className="border-b border-slate-200/70 bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:bg-[#121a2b] dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">{localize('com_ui_project_meta_ads_campaign')}</th>
              <th className="px-3 py-2 text-right">
                {localize('com_ui_project_meta_ads_spend_delta')}
              </th>
              <th className="px-3 py-2 text-right">
                {localize('com_ui_project_meta_ads_results_delta')}
              </th>
              <th className="px-3 py-2 text-right">
                {localize('com_ui_project_meta_ads_cpa_delta')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
            {bestEvolution.length > 0 ? (
              bestEvolution.map((delta) => {
                const entityId = getDeltaEntityId(delta);
                const name = cleanName(getDeltaEntityName(delta), entityId);
                return (
                  <tr key={entityId} className="odd:bg-slate-50/80 dark:odd:bg-[#1b263b]">
                    <MetaAdsEvolutionNameCell name={name} />
                    <td
                      className={`px-3 py-2.5 text-right font-mono ${getEvolutionDeltaClass(
                        delta.spendDelta,
                      )}`}
                    >
                      {formatSignedMoney(delta.spendDelta, currency)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono ${getEvolutionDeltaClass(
                        delta.resultDelta,
                      )}`}
                    >
                      {formatSignedMetric(delta.resultDelta)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono ${getEvolutionDeltaClass(
                        delta.cpaDelta,
                        true,
                      )}`}
                    >
                      {formatSignedMoney(delta.cpaDelta, currency)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-5 text-sm text-slate-500 dark:text-slate-400">
                  {localize('com_ui_project_meta_ads_no_evolution')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </EvolutionTableShell>

      <EvolutionTableShell title={localize('com_ui_project_meta_ads_budget_changes')}>
        <table className="w-full min-w-[34rem] text-left text-xs">
          <thead className="border-b border-slate-200/70 bg-slate-50/70 text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">{localize('com_ui_project_meta_ads_name')}</th>
              <th className="px-3 py-2 text-right">
                {localize('com_ui_project_meta_ads_budget_delta')}
              </th>
              <th className="px-3 py-2 text-right">
                {localize('com_ui_project_meta_ads_frequency_delta')}
              </th>
              <th className="px-3 py-2">{localize('com_ui_project_meta_ads_actor')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {evolutionAlerts.length > 0 ? (
              evolutionAlerts.map((delta) => {
                const entityId = getDeltaEntityId(delta);
                const name = cleanName(
                  delta.latestChange?.entityName ?? getDeltaEntityName(delta),
                  entityId,
                );
                const budgetDelta = delta.latestChange?.deltaDailyBudget ?? delta.budgetDelta;
                return (
                  <tr key={entityId} className="odd:bg-white/[0.025]">
                    <MetaAdsEvolutionNameCell name={name} />
                    <td
                      className={`px-3 py-2.5 text-right font-mono ${getEvolutionDeltaClass(
                        budgetDelta,
                      )}`}
                    >
                      {formatSignedMoney(budgetDelta, currency)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono ${getEvolutionDeltaClass(
                        delta.frequencyDelta,
                        true,
                      )}`}
                    >
                      {formatSignedMetric(delta.frequencyDelta)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">
                      {delta.latestChange?.actor ?? '-'}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-5 text-sm text-slate-500 dark:text-slate-400">
                  {localize('com_ui_project_meta_ads_no_history')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </EvolutionTableShell>
    </div>
  );
}
