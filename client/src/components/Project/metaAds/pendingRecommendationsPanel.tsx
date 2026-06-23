import type { ProjectMetaAdsRecommendation } from 'librechat-data-provider';
import type { useLocalize } from '~/hooks';
import { canApplyRecommendation, getRecommendationLabel } from './recommendations';

type MetaAdsPendingRecommendationsPanelProps = {
  recommendations: ProjectMetaAdsRecommendation[];
  currency: string;
  canUseMetaAdsActions: boolean;
  applyingRecommendation: boolean;
  localize: ReturnType<typeof useLocalize>;
  onApply: (recommendation: ProjectMetaAdsRecommendation) => void;
};

export function MetaAdsPendingRecommendationsPanel({
  recommendations,
  currency,
  canUseMetaAdsActions,
  applyingRecommendation,
  localize,
  onApply,
}: MetaAdsPendingRecommendationsPanelProps) {
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border-light bg-surface-secondary p-3">
      <div className="space-y-2">
        {recommendations.map((recommendation) => (
          <div
            key={recommendation._id ?? recommendation.entityId}
            className="flex items-center justify-between gap-3 border border-border-light bg-surface-primary p-2 text-xs"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-text-primary">
                {recommendation.entityName ?? recommendation.entityId}
              </div>
              <div className="text-text-secondary">
                {getRecommendationLabel(recommendation, currency)}
              </div>
            </div>
            {canApplyRecommendation(recommendation) && (
              <button
                type="button"
                disabled={!canUseMetaAdsActions || applyingRecommendation}
                onClick={() => onApply(recommendation)}
                className="h-7 shrink-0 border border-border-light px-2 font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {localize('com_ui_project_meta_ads_apply')}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
