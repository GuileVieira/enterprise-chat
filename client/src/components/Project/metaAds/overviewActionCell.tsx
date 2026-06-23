import { Copy, DotsThreeVertical } from '@phosphor-icons/react';

import { canApplyRecommendation } from './recommendations';
import type { Localize, DuplicateDraft, TableColumn } from './types';
import type { ProjectMetaAdsRecommendation } from 'librechat-data-provider';

export function MetaAdsOverviewActionCell({
  columnKey,
  recommendation,
  duplicate,
  actionMenuKey,
  canUseMetaAdsActions,
  applyingRecommendation,
  localize,
  onApply,
  onToggleActionMenu,
  onOpenDuplicateDraft,
}: {
  columnKey: TableColumn['key'];
  recommendation: ProjectMetaAdsRecommendation | undefined;
  duplicate?: DuplicateDraft;
  actionMenuKey: string | null;
  canUseMetaAdsActions: boolean;
  applyingRecommendation: boolean;
  localize: Localize;
  onApply: (recommendation: ProjectMetaAdsRecommendation) => void;
  onToggleActionMenu: (menuKey: string) => void;
  onOpenDuplicateDraft: (duplicate: DuplicateDraft) => void;
}) {
  const menuKey = duplicate ? `${duplicate.entityLevel}:${duplicate.entityId}` : '';
  const duplicateLabelKey =
    duplicate?.entityLevel === 'campaign'
      ? 'com_ui_project_meta_ads_duplicate_campaign'
      : 'com_ui_project_meta_ads_duplicate_adset';

  return (
    <td
      key={columnKey}
      className={`px-2 py-2 ${actionMenuKey === menuKey ? 'relative z-[1000]' : ''}`}
    >
      <div className="relative flex items-center gap-1">
        {canApplyRecommendation(recommendation) && (
          <button
            type="button"
            disabled={!canUseMetaAdsActions || applyingRecommendation}
            onClick={() => {
              if (recommendation) {
                onApply(recommendation);
              }
            }}
            className="h-7 rounded-lg border border-emerald-300/35 bg-emerald-300/10 px-2 text-[11px] font-semibold text-emerald-700 transition duration-200 hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-100"
          >
            {localize('com_ui_project_meta_ads_apply')}
          </button>
        )}
        {duplicate && (
          <>
            <button
              type="button"
              aria-label={localize('com_ui_project_meta_ads_actions')}
              aria-expanded={actionMenuKey === menuKey}
              disabled={!canUseMetaAdsActions}
              onClick={(event) => {
                event.stopPropagation();
                onToggleActionMenu(menuKey);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.55)] transition duration-200 hover:border-teal-300/60 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-300/35 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-[#172033] dark:text-slate-300 dark:hover:bg-[#183247] dark:hover:text-teal-100"
            >
              <DotsThreeVertical className="h-4 w-4" aria-hidden="true" />
            </button>
            {actionMenuKey === menuKey && (
              <div className="absolute right-0 top-9 z-[1200] min-w-56 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.75)] dark:border-white/10 dark:bg-[#121a2b] dark:shadow-[0_22px_60px_-34px_rgba(0,0,0,0.95)]">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenDuplicateDraft(duplicate);
                  }}
                  className="flex w-full items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-800 transition hover:bg-teal-50 hover:text-teal-800 dark:text-slate-100 dark:hover:bg-[#183247] dark:hover:text-teal-100"
                >
                  <Copy
                    className="h-3.5 w-3.5 text-teal-600 dark:text-teal-200"
                    aria-hidden="true"
                  />
                  {localize(duplicateLabelKey)}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </td>
  );
}
