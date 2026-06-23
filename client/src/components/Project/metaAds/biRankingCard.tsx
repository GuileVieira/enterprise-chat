import type { ProjectMetaAdsRankingItem } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';

import { getRankEfficiency } from './bi';
import { MetaAdsRankMedia } from './rankMedia';
import {
  formatMoney,
  formatMetric,
  formatPercent,
  formatRankingCost,
  getResultTypeLabel,
} from './formatters';
import type { Localize, BiRankingSort, MetaAdsBiRankItem, BiRankingSortKey } from './types';

const sortColumns: Array<[BiRankingSortKey, TranslationKeys]> = [
  ['spend', 'com_ui_project_meta_ads_spend'],
  ['resultCount', 'com_ui_project_meta_ads_results'],
  ['cpa', 'com_ui_project_meta_ads_cpa'],
  ['ctr', 'com_ui_project_meta_ads_ctr'],
  ['frequency', 'com_ui_project_meta_ads_frequency'],
];

function cleanRankName(value: string | undefined, fallback: string) {
  const cleanedValue = (value ?? '').replace(/^[^\w[]+\s*/u, '').trim();
  return cleanedValue || value || fallback;
}

function getSortIndicator(sort: BiRankingSort, key: BiRankingSortKey) {
  if (sort.key !== key) {
    return '';
  }

  return sort.direction === 'asc' ? ' ↑' : ' ↓';
}

export function MetaAdsBiRankingCard({
  titleKey,
  items,
  testId,
  emptyMessageKey = 'com_ui_project_meta_ads_bi_no_rankings',
  sort,
  fetching,
  currency,
  localize,
  onSort,
  onSelect,
}: {
  titleKey: TranslationKeys;
  items: Array<MetaAdsBiRankItem | ProjectMetaAdsRankingItem>;
  testId: string;
  emptyMessageKey?: TranslationKeys;
  sort: BiRankingSort;
  fetching: boolean;
  currency: string;
  localize: Localize;
  onSort: (key: BiRankingSortKey) => void;
  onSelect: (item: MetaAdsBiRankItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-[0_18px_58px_-46px_rgba(15,23,42,0.42)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
        <h5 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
          {localize(titleKey)}
        </h5>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
          {fetching
            ? localize('com_ui_project_meta_ads_loading')
            : localize('com_ui_project_meta_ads_bi_rank_by')}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table data-testid={testId} className="w-full min-w-[58rem] text-left text-xs">
          <thead className="border-b border-slate-200/70 bg-slate-50/70 text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
            <tr>
              <th className="w-12 px-3 py-2">#</th>
              <th className="px-3 py-2">{localize('com_ui_project_meta_ads_name')}</th>
              <th className="px-3 py-2">
                {localize('com_ui_project_meta_ads_target_result_type')}
              </th>
              {sortColumns.map(([key, labelKey]) => (
                <th key={key} className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onSort(key)}
                    className="font-semibold uppercase tracking-[0.12em] text-slate-500 transition hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-200"
                  >
                    {localize(labelKey)}
                    {getSortIndicator(sort, key)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
            {items.length > 0 ? (
              items.map((item, index) => {
                const rankItem = item as MetaAdsBiRankItem;
                const displayName = cleanRankName(item.name, item.id);
                return (
                  <tr
                    key={`${item.level}:${item.id}`}
                    onClick={() => onSelect(rankItem)}
                    className="cursor-pointer transition duration-200 odd:bg-slate-50/70 hover:bg-teal-50/70 dark:odd:bg-white/[0.025] dark:hover:bg-teal-300/[0.08]"
                  >
                    <td className="px-3 py-3 font-mono text-slate-400 dark:text-slate-500">
                      #{index + 1}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <MetaAdsRankMedia item={rankItem} localize={localize} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {displayName}
                          </div>
                          {'parentName' in item && item.parentName && (
                            <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                              {item.parentName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                      {getResultTypeLabel(item.resultType, localize)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-white">
                      {formatMoney(item.spend, currency)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-white">
                      {formatMetric(item.resultCount)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-white">
                      {formatRankingCost(getRankEfficiency(rankItem), currency)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-white">
                      {formatPercent(item.ctr)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-white">
                      {formatMetric(item.frequency)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-3 py-5 text-sm text-slate-500 dark:text-slate-400">
                  {localize(emptyMessageKey)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
