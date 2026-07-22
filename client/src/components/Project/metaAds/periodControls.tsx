import { periodFilterOptions } from './constants';
import { MetaAdsField } from './ui';
import type { Localize, PeriodFilter } from './types';

export type MetaAdsPeriodControlProps = {
  periodFilter: PeriodFilter;
  customSince: string;
  customUntil: string;
  appliedCustomSince: string;
  appliedCustomUntil: string;
  inputClassName: string;
  localize: Localize;
  testIdPrefix: string;
  onPeriodFilterChange: (value: PeriodFilter) => void;
  onCustomSinceChange: (value: string) => void;
  onCustomUntilChange: (value: string) => void;
  onApplyCustomPeriod: () => void;
};

export function MetaAdsPeriodControls({
  periodFilter,
  customSince,
  customUntil,
  appliedCustomSince,
  appliedCustomUntil,
  inputClassName,
  localize,
  testIdPrefix,
  onPeriodFilterChange,
  onCustomSinceChange,
  onCustomUntilChange,
  onApplyCustomPeriod,
}: MetaAdsPeriodControlProps) {
  return (
    <>
      <MetaAdsField label={localize('com_ui_project_meta_ads_period')}>
        <select
          data-testid={`${testIdPrefix}-period-filter`}
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
      </MetaAdsField>
      {periodFilter === 'custom' && (
        <>
          <MetaAdsField label={localize('com_ui_project_meta_ads_period_since')}>
            <input
              type="date"
              value={customSince}
              max={customUntil || undefined}
              onChange={(event) => onCustomSinceChange(event.target.value)}
              className={inputClassName}
            />
          </MetaAdsField>
          <MetaAdsField label={localize('com_ui_project_meta_ads_period_until')}>
            <input
              type="date"
              value={customUntil}
              min={customSince || undefined}
              onChange={(event) => onCustomUntilChange(event.target.value)}
              className={inputClassName}
            />
          </MetaAdsField>
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
    </>
  );
}
