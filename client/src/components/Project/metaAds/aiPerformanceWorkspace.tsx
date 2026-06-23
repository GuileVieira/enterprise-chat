import type { ProjectMetaAdsPerformanceResponse } from 'librechat-data-provider';

import { formatMoney, formatMetric } from './formatters';
import { MetaAdsMetricCard, MetaAdsPanel } from './ui';
import { MetaAdsPeriodControls } from './periodControls';
import type { Localize } from './types';
import type { MetaAdsPeriodControlProps } from './periodControls';

export function MetaAdsAiPerformanceWorkspace({
  data,
  fetching,
  period,
  currency,
  localize,
}: {
  data?: ProjectMetaAdsPerformanceResponse;
  fetching: boolean;
  period: Omit<MetaAdsPeriodControlProps, 'localize' | 'testIdPrefix'>;
  currency: string;
  localize: Localize;
}) {
  const summary = data?.summary;
  const actions = data?.actions ?? [];

  return (
    <div
      id="meta-ads-aiPerformance-tab-panel"
      role="tabpanel"
      aria-labelledby="meta-ads-tab-aiPerformance"
      data-testid="meta-ads-ai-performance-tab-panel"
      className="space-y-4 p-4"
    >
      <MetaAdsPanel className="p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetaAdsPeriodControls {...period} localize={localize} testIdPrefix="meta-ads-ai" />
        </div>
      </MetaAdsPanel>
      {fetching && (
        <div className="rounded-2xl border border-amber-300/35 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
          {localize('com_ui_project_meta_ads_loading')}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetaAdsMetricCard
          label={localize('com_ui_project_meta_ads_ai_actions')}
          value={String(summary?.aiActionCount ?? 0)}
        />
        <MetaAdsMetricCard
          label={localize('com_ui_project_meta_ads_paused_creatives')}
          value={String(summary?.pausedAdCount ?? 0)}
        />
        <MetaAdsMetricCard
          label={localize('com_ui_project_meta_ads_budget_delta')}
          value={formatMoney(summary?.totalDeltaDailyBudget, currency)}
        />
        <MetaAdsMetricCard
          label={localize('com_ui_project_meta_ads_average_cpa')}
          value={formatMoney(summary?.averageCpa, currency)}
          context={formatMetric(summary?.averageRoas)}
        />
      </div>
      <MetaAdsPanel className="overflow-x-auto p-0">
        <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0 text-left text-xs">
          <thead className="bg-slate-50/90 text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:bg-white/[0.035] dark:text-slate-400">
            <tr>
              {[
                'com_ui_date',
                'com_ui_project_meta_ads_actions',
                'com_ui_project_meta_ads_campaign',
                'com_ui_project_meta_ads_rule',
                'com_ui_project_meta_ads_cost_result',
                'com_ui_project_meta_ads_reason',
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
            {actions.map((action) => (
              <tr
                key={action._id ?? `${action.entityId}-${action.createdAt}`}
                className="odd:bg-slate-50/60 dark:odd:bg-white/[0.045]"
              >
                <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                  {action.createdAt?.slice(0, 10) ?? '-'}
                </td>
                <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                  {action.actionType}
                </td>
                <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                  {action.entityName ?? action.entityId}
                </td>
                <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                  {action.ruleName ?? localize('com_ui_project_meta_ads_unattributed_rule')}
                </td>
                <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                  {formatMoney(action.cpa, currency)}
                </td>
                <td className="border-b border-slate-200/60 px-3 py-2 dark:border-white/[0.06]">
                  {action.reason ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </MetaAdsPanel>
    </div>
  );
}
