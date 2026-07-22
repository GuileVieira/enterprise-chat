import { getObjectiveLabel, getResultTypeLabel } from './formatters';
import { MetaAdsPeriodControls } from './periodControls';
import { MetaAdsField } from './ui';
import type {
  Localize,
  PeriodFilter,
  EvolutionMetric,
  MetaAdsBiControls,
  MetaAdsBiRankLevel,
} from './types';

export function MetaAdsBiControlsPanel({
  controls,
  searchQuery,
  periodFilter,
  customSince,
  customUntil,
  appliedCustomSince,
  appliedCustomUntil,
  objectiveOptions,
  resultTypeOptions,
  inputClassName,
  localize,
  onPeriodFilterChange,
  onSearchQueryChange,
  onCustomSinceChange,
  onCustomUntilChange,
  onApplyCustomPeriod,
  onLevelChange,
  onObjectiveChange,
  onResultTypeChange,
  onMetricChange,
}: {
  controls: MetaAdsBiControls;
  searchQuery: string;
  periodFilter: PeriodFilter;
  customSince: string;
  customUntil: string;
  appliedCustomSince: string;
  appliedCustomUntil: string;
  objectiveOptions: string[];
  resultTypeOptions: string[];
  inputClassName: string;
  localize: Localize;
  onPeriodFilterChange: (value: PeriodFilter) => void;
  onSearchQueryChange: (value: string) => void;
  onCustomSinceChange: (value: string) => void;
  onCustomUntilChange: (value: string) => void;
  onApplyCustomPeriod: () => void;
  onLevelChange: (value: MetaAdsBiRankLevel) => void;
  onObjectiveChange: (value: string) => void;
  onResultTypeChange: (value: string) => void;
  onMetricChange: (value: EvolutionMetric) => void;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-[0_16px_48px_-42px_rgba(15,23,42,0.42)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045]">
      <div>
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          {localize('com_ui_project_meta_ads_bi_rankings')}
        </h4>
        <p className="mt-1 max-w-[64ch] text-xs leading-5 text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_bi_rankings_hint')}
        </p>
      </div>
      <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <MetaAdsPeriodControls
          periodFilter={periodFilter}
          customSince={customSince}
          customUntil={customUntil}
          appliedCustomSince={appliedCustomSince}
          appliedCustomUntil={appliedCustomUntil}
          inputClassName={inputClassName}
          localize={localize}
          testIdPrefix="meta-ads-bi"
          onPeriodFilterChange={onPeriodFilterChange}
          onCustomSinceChange={onCustomSinceChange}
          onCustomUntilChange={onCustomUntilChange}
          onApplyCustomPeriod={onApplyCustomPeriod}
        />
        <MetaAdsField label={localize('com_ui_project_meta_ads_search')}>
          <input
            type="search"
            value={searchQuery}
            data-testid="meta-ads-bi-search"
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className={inputClassName}
          />
        </MetaAdsField>
        <MetaAdsField label={localize('com_ui_project_meta_ads_level')}>
          <select
            data-testid="meta-ads-bi-level-filter"
            value={controls.level}
            onChange={(event) => onLevelChange(event.target.value as MetaAdsBiRankLevel)}
            className={inputClassName}
          >
            <option value="campaign">{localize('com_ui_project_meta_ads_level_campaign')}</option>
            <option value="adset">{localize('com_ui_project_meta_ads_level_ad_set')}</option>
            <option value="ad">{localize('com_ui_project_meta_ads_level_ad')}</option>
          </select>
        </MetaAdsField>
        <MetaAdsField label={localize('com_ui_project_meta_ads_objective')}>
          <select
            data-testid="meta-ads-bi-objective-filter"
            value={controls.objective}
            onChange={(event) => onObjectiveChange(event.target.value)}
            className={inputClassName}
          >
            <option value="all">{localize('com_ui_project_meta_ads_filter_all')}</option>
            {objectiveOptions.map((objective) => (
              <option key={objective} value={objective}>
                {getObjectiveLabel(objective, localize)}
              </option>
            ))}
          </select>
        </MetaAdsField>
        <MetaAdsField label={localize('com_ui_project_meta_ads_target_result_type')}>
          <select
            data-testid="meta-ads-bi-result-type-filter"
            value={controls.resultType}
            onChange={(event) => onResultTypeChange(event.target.value)}
            className={inputClassName}
          >
            <option value="all">{localize('com_ui_project_meta_ads_filter_all')}</option>
            {resultTypeOptions.map((resultType) => (
              <option key={resultType} value={resultType}>
                {getResultTypeLabel(resultType, localize)}
              </option>
            ))}
          </select>
        </MetaAdsField>
        <MetaAdsField label={localize('com_ui_project_meta_ads_metric')}>
          <select
            data-testid="meta-ads-bi-metric-filter"
            value={controls.metric}
            onChange={(event) => onMetricChange(event.target.value as EvolutionMetric)}
            className={inputClassName}
          >
            <option value="spend">{localize('com_ui_project_meta_ads_spend')}</option>
            <option value="resultCount">{localize('com_ui_project_meta_ads_results')}</option>
            <option value="cpa">{localize('com_ui_project_meta_ads_cpa')}</option>
            <option value="ctr">{localize('com_ui_project_meta_ads_ctr')}</option>
            <option value="frequency">{localize('com_ui_project_meta_ads_frequency')}</option>
            <option value="clicks">{localize('com_ui_project_meta_ads_clicks')}</option>
          </select>
        </MetaAdsField>
      </div>
    </div>
  );
}
