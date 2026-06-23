import { periodFilterOptions } from './constants';
import { getObjectiveLabel, getResultTypeLabel } from './formatters';
import type {
  Localize,
  PeriodFilter,
  EvolutionMetric,
  MetaAdsBiControls,
  MetaAdsBiRankLevel,
} from './types';

export function MetaAdsBiControlsPanel({
  controls,
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
  onCustomSinceChange,
  onCustomUntilChange,
  onApplyCustomPeriod,
  onLevelChange,
  onObjectiveChange,
  onResultTypeChange,
  onMetricChange,
}: {
  controls: MetaAdsBiControls;
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
      <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <label className="flex min-w-40 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_period')}
          <select
            data-testid="meta-ads-bi-period-filter"
            value={periodFilter}
            onChange={(event) => onPeriodFilterChange(event.target.value as PeriodFilter)}
            className={inputClassName}
          >
            {periodFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {localize(option.labelKey)}
              </option>
            ))}
          </select>
        </label>
        {periodFilter === 'custom' && (
          <>
            <label className="flex min-w-40 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_period_since')}
              <input
                type="date"
                value={customSince}
                max={customUntil || undefined}
                onChange={(event) => onCustomSinceChange(event.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="flex min-w-40 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_period_until')}
              <input
                type="date"
                value={customUntil}
                min={customSince || undefined}
                onChange={(event) => onCustomUntilChange(event.target.value)}
                className={inputClassName}
              />
            </label>
            <div className="flex min-w-32 flex-col justify-end">
              <button
                type="button"
                disabled={customSince === appliedCustomSince && customUntil === appliedCustomUntil}
                onClick={onApplyCustomPeriod}
                className="h-10 rounded-xl border border-teal-300/50 bg-teal-50 px-3 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-teal-300/30 dark:bg-teal-300/10 dark:text-teal-100 dark:hover:bg-teal-300/15 dark:disabled:border-white/10 dark:disabled:bg-white/[0.03] dark:disabled:text-slate-600"
              >
                {localize('com_ui_project_meta_ads_period_update')}
              </button>
            </div>
          </>
        )}
        <label className="flex min-w-40 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_level')}
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
        </label>
        <label className="flex min-w-48 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_objective')}
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
        </label>
        <label className="flex min-w-48 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_target_result_type')}
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
        </label>
        <label className="flex min-w-40 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_metric')}
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
        </label>
      </div>
    </div>
  );
}
