import { useEffect, useRef, useState } from 'react';
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react';

import type {
  Localize,
  SettingsDrawer,
  MetaAdsSettings,
  MetaAdsSettingsState,
  ScheduleIntervalMinutes,
} from './types';
import { scheduleOptions } from './constants';
import { getAdAccountDigits, resolveMonthlyBudgetForMonth, toAdAccountId } from './settings';
import { resultTypeOptions } from './rules';

type SettingsDrawerChrome = {
  modalOverlayClassName: string;
  drawerShellClassName: string;
  modalHeaderClassName: string;
  modalTileClassName: string;
};

type SettingsDrawerControls = {
  inputClassName: string;
  buttonClassName: string;
  primaryButtonClassName: string;
  ghostButtonClassName: string;
};

type ParsedMonth = {
  year: number;
  monthIndex: number;
};

const monthLabels = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
];

function getCurrentMonthValue(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthValue(value?: string): ParsedMonth {
  const match = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})$/) : null;
  if (!match) {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }
  return { year, monthIndex };
}

function formatMonthValue(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function formatMonthLabel(value?: string): string {
  const { year, monthIndex } = parseMonthValue(value);
  const date = new Date(year, monthIndex, 1);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function MetaAdsSettingsDrawer({
  drawer,
  draft,
  tokenConfigured,
  tokenStatusLabel,
  effectiveGraphVersion,
  graphVersionOptions,
  canUseMetaAdsActions,
  saving,
  localize,
  onDraftChange,
  onOpenCredentials,
  onClose,
  onSave,
  chrome,
  controls,
}: {
  drawer: SettingsDrawer;
  draft: MetaAdsSettingsState | null;
  tokenConfigured: boolean;
  tokenStatusLabel: string;
  effectiveGraphVersion: string;
  graphVersionOptions: string[];
  canUseMetaAdsActions: boolean;
  saving: boolean;
  localize: Localize;
  onDraftChange: (draft: MetaAdsSettingsState) => void;
  onOpenCredentials: () => void;
  onClose: () => void;
  onSave: () => void;
  chrome: SettingsDrawerChrome;
  controls: SettingsDrawerControls;
}) {
  const monthPickerRef = useRef<HTMLDivElement | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    if (!monthPickerOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!monthPickerRef.current?.contains(event.target as Node)) {
        setMonthPickerOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMonthPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [monthPickerOpen]);

  if (!drawer || !draft) {
    return null;
  }

  const updateDraft = (patch: Partial<MetaAdsSettingsState>) =>
    onDraftChange({ ...draft, ...patch });
  const updateMonthlyBudget = (
    key: 'month' | 'baseAmount' | 'additionalAmount' | 'allowedOverspendPct',
    value: string,
  ) => {
    if (key === 'month') {
      const resolvedBudget = resolveMonthlyBudgetForMonth(
        value,
        draft.monthlyBudgets,
        draft.monthlyBudget,
      );
      updateDraft({
        monthlyBudget: {
          month: value,
          ...resolvedBudget.values,
        },
      });
      return;
    }
    const nextValue = value === '' ? undefined : Number(value);
    const month = draft.monthlyBudget?.month ?? getCurrentMonthValue();
    const monthlyBudget = {
      ...(draft.monthlyBudget ?? {}),
      month,
      [key]: nextValue,
    };
    updateDraft({
      monthlyBudgets: {
        ...(draft.monthlyBudgets ?? {}),
        [month]: {
          baseAmount: monthlyBudget.baseAmount,
          additionalAmount: monthlyBudget.additionalAmount,
          allowedOverspendPct: monthlyBudget.allowedOverspendPct,
        },
      },
      monthlyBudget: {
        month,
        baseAmount: monthlyBudget.baseAmount,
        additionalAmount: monthlyBudget.additionalAmount,
        allowedOverspendPct: monthlyBudget.allowedOverspendPct,
      },
    });
  };
  const selectedMonthKey = draft.monthlyBudget?.month ?? getCurrentMonthValue();
  const selectedMonth = parseMonthValue(selectedMonthKey);
  const monthlyBudgetResolution = resolveMonthlyBudgetForMonth(
    selectedMonthKey,
    draft.monthlyBudgets,
    draft.monthlyBudget,
  );
  const copyPreviousMonthlyBudget = () => {
    if (!monthlyBudgetResolution.inheritedFrom) {
      return;
    }
    const inheritedBudget = draft.monthlyBudgets?.[monthlyBudgetResolution.inheritedFrom];
    const values = resolveMonthlyBudgetForMonth(
      monthlyBudgetResolution.inheritedFrom,
      draft.monthlyBudgets,
      inheritedBudget,
    ).values;
    updateDraft({
      monthlyBudgets: {
        ...(draft.monthlyBudgets ?? {}),
        [selectedMonthKey]: values,
      },
      monthlyBudget: {
        month: selectedMonthKey,
        ...values,
      },
    });
  };
  const openMonthPicker = () => {
    setMonthPickerYear(selectedMonth.year);
    setMonthPickerOpen((current) => !current);
  };
  const selectMonth = (monthIndex: number) => {
    updateMonthlyBudget('month', formatMonthValue(monthPickerYear, monthIndex));
    setMonthPickerOpen(false);
  };
  const selectCurrentMonth = () => {
    updateMonthlyBudget('month', getCurrentMonthValue());
    setMonthPickerYear(new Date().getFullYear());
    setMonthPickerOpen(false);
  };
  const clearMonth = () => {
    const { [selectedMonthKey]: _removed, ...monthlyBudgets } = draft.monthlyBudgets ?? {};
    const resolvedBudget = resolveMonthlyBudgetForMonth(selectedMonthKey, monthlyBudgets);
    updateDraft({
      monthlyBudgets,
      monthlyBudget: {
        month: selectedMonthKey,
        ...resolvedBudget.values,
      },
    });
    setMonthPickerOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meta-ads-settings-drawer-title"
      className={`${chrome.modalOverlayClassName} flex justify-end p-0`}
    >
      <div className={`${chrome.drawerShellClassName} max-w-lg`}>
        <div className={chrome.modalHeaderClassName}>
          <h4
            id="meta-ads-settings-drawer-title"
            className="text-base font-semibold text-slate-950 dark:text-white"
          >
            {localize(
              drawer === 'account'
                ? 'com_ui_project_meta_ads_account_credentials'
                : 'com_ui_project_meta_ads_automation',
            )}
          </h4>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {drawer === 'account'
              ? tokenStatusLabel
              : localize('com_ui_project_meta_ads_schedule_minutes', {
                  0: String(draft.scheduleIntervalMinutes),
                })}
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {drawer === 'account' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                  {localize('com_ui_project_meta_ads_enabled')}
                  <select
                    disabled={!canUseMetaAdsActions}
                    value={draft.enabled ? 'true' : 'false'}
                    onChange={(event) => updateDraft({ enabled: event.target.value === 'true' })}
                    className={controls.inputClassName}
                  >
                    <option value="false">{localize('com_ui_project_meta_ads_disabled')}</option>
                    <option value="true">
                      {localize('com_ui_project_meta_ads_enabled_state')}
                    </option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                  {localize('com_ui_project_meta_ads_account')}
                  <input
                    disabled={!canUseMetaAdsActions}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={getAdAccountDigits(draft.adAccountId)}
                    onChange={(event) =>
                      updateDraft({ adAccountId: toAdAccountId(event.target.value) })
                    }
                    placeholder="123456789"
                    className={controls.inputClassName}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                {localize('com_ui_project_meta_ads_graph_version')}
                <select
                  disabled={!canUseMetaAdsActions}
                  value={draft.graphVersion ?? ''}
                  onChange={(event) => updateDraft({ graphVersion: event.target.value })}
                  autoComplete="off"
                  className={controls.inputClassName}
                >
                  <option value="">
                    {localize('com_ui_project_meta_ads_graph_version_global', {
                      0: effectiveGraphVersion,
                    })}
                  </option>
                  {graphVersionOptions.map((version) => (
                    <option key={version} value={version}>
                      {version}
                    </option>
                  ))}
                </select>
              </label>
              <div className={chrome.modalTileClassName}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-950 dark:text-white">
                      {localize('com_ui_project_meta_ads_credentials')}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {localize('com_ui_project_meta_ads_credentials_hint')}
                    </div>
                    {tokenConfigured && (
                      <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
                        {tokenStatusLabel}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!canUseMetaAdsActions}
                    onClick={onOpenCredentials}
                    className={controls.buttonClassName}
                  >
                    {localize('com_ui_project_meta_ads_manage_tokens')}
                  </button>
                </div>
              </div>
              <div
                className={`${chrome.modalTileClassName} text-sm text-slate-600 dark:text-slate-300`}
              >
                <div className="font-medium text-slate-950 dark:text-white">{tokenStatusLabel}</div>
                <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {localize('com_ui_project_meta_ads_graph_version_hint')}
                </div>
              </div>
            </>
          ) : (
            <div className="grid gap-3">
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                {localize('com_ui_project_meta_ads_mode')}
                <select
                  disabled={!canUseMetaAdsActions}
                  value={draft.automationMode}
                  onChange={(event) =>
                    updateDraft({
                      automationMode: event.target.value as MetaAdsSettings['automationMode'],
                    })
                  }
                  className={controls.inputClassName}
                >
                  <option value="recommend">
                    {localize('com_ui_project_meta_ads_mode_recommend')}
                  </option>
                  <option value="auto_limited">
                    {localize('com_ui_project_meta_ads_mode_auto_limited')}
                  </option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                {localize('com_ui_project_meta_ads_schedule')}
                <select
                  disabled={!canUseMetaAdsActions}
                  value={draft.scheduleIntervalMinutes}
                  onChange={(event) =>
                    updateDraft({
                      scheduleIntervalMinutes: Number(
                        event.target.value,
                      ) as ScheduleIntervalMinutes,
                    })
                  }
                  className={controls.inputClassName}
                >
                  {scheduleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {localize(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                {localize('com_ui_project_meta_ads_analysis_window')}
                <select
                  disabled={!canUseMetaAdsActions}
                  value={draft.automationAnalysisPreset ?? 'last_2d'}
                  onChange={(event) =>
                    updateDraft({
                      automationAnalysisPreset: event.target
                        .value as MetaAdsSettings['automationAnalysisPreset'],
                    })
                  }
                  className={controls.inputClassName}
                >
                  {[
                    ['today', 'com_ui_project_meta_ads_analysis_today'],
                    ['yesterday', 'com_ui_project_meta_ads_analysis_yesterday'],
                    ['last_6h', 'com_ui_project_meta_ads_analysis_last_6h'],
                    ['last_24h', 'com_ui_project_meta_ads_analysis_last_24h'],
                    ['last_2d', 'com_ui_project_meta_ads_analysis_last_2d'],
                    ['last_3d', 'com_ui_project_meta_ads_analysis_last_3d'],
                    ['last_7d', 'com_ui_project_meta_ads_analysis_last_7d'],
                    ['last_14d', 'com_ui_project_meta_ads_analysis_last_14d'],
                    ['last_30d', 'com_ui_project_meta_ads_analysis_last_30d'],
                  ].map(([value, labelKey]) => (
                    <option key={value} value={value}>
                      {localize(labelKey as Parameters<typeof localize>[0])}
                    </option>
                  ))}
                </select>
              </label>
              <div className={chrome.modalTileClassName}>
                <div className="text-sm font-medium text-slate-950 dark:text-white">
                  {localize('com_ui_project_meta_ads_client_goal')}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {localize('com_ui_project_meta_ads_client_goal_hint')}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                    {localize('com_ui_project_meta_ads_target_result_type')}
                    <select
                      disabled={!canUseMetaAdsActions}
                      value={draft.clientGoal?.resultType ?? 'purchase'}
                      onChange={(event) =>
                        updateDraft({
                          clientGoal: {
                            ...(draft.clientGoal ?? {}),
                            resultType: event.target.value,
                          },
                        })
                      }
                      className={controls.inputClassName}
                    >
                      {resultTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {localize(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                    {localize('com_ui_project_meta_ads_monthly_result_goal')}
                    <input
                      disabled={!canUseMetaAdsActions}
                      type="number"
                      min="0"
                      step="1"
                      value={draft.clientGoal?.monthlyTarget ?? ''}
                      onChange={(event) =>
                        updateDraft({
                          clientGoal: {
                            ...(draft.clientGoal ?? {}),
                            monthlyTarget:
                              event.target.value === '' ? undefined : Number(event.target.value),
                          },
                        })
                      }
                      className={controls.inputClassName}
                    />
                  </label>
                </div>
              </div>
              <div className={chrome.modalTileClassName}>
                <div className="text-sm font-medium text-slate-950 dark:text-white">
                  {localize('com_ui_project_meta_ads_rule_sections')}
                </div>
                <div className="mt-3 grid gap-3">
                  {[
                    ['performance', 'com_ui_project_meta_ads_rule_section_performance_toggle'],
                    ['creatives', 'com_ui_project_meta_ads_rule_section_creatives_toggle'],
                  ].map(([key, labelKey]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300"
                    >
                      <span>{localize(labelKey as Parameters<typeof localize>[0])}</span>
                      <input
                        type="checkbox"
                        disabled={!canUseMetaAdsActions}
                        checked={
                          draft.rules.enabledSections?.[key as 'performance' | 'creatives'] !==
                          false
                        }
                        onChange={(event) =>
                          updateDraft({
                            rules: {
                              ...draft.rules,
                              enabledSections: {
                                ...(draft.rules.enabledSections ?? {}),
                                [key]: event.target.checked,
                              },
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                  <label className="flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
                    <span>{localize('com_ui_project_meta_ads_no_result_spend_cap')}</span>
                    <input
                      type="checkbox"
                      disabled={!canUseMetaAdsActions}
                      checked={draft.rules.noResultSpendCap?.enabled === true}
                      onChange={(event) =>
                        updateDraft({
                          rules: {
                            ...draft.rules,
                            noResultSpendCap: {
                              ...(draft.rules.noResultSpendCap ?? {}),
                              enabled: event.target.checked,
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                    {localize('com_ui_project_meta_ads_no_result_spend_cap_min')}
                    <input
                      disabled={
                        !canUseMetaAdsActions || draft.rules.noResultSpendCap?.enabled !== true
                      }
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.rules.noResultSpendCap?.minSpend ?? ''}
                      onChange={(event) =>
                        updateDraft({
                          rules: {
                            ...draft.rules,
                            noResultSpendCap: {
                              ...(draft.rules.noResultSpendCap ?? {}),
                              minSpend:
                                event.target.value === '' ? undefined : Number(event.target.value),
                            },
                          },
                        })
                      }
                      className={controls.inputClassName}
                    />
                  </label>
                </div>
              </div>
              <div className={chrome.modalTileClassName}>
                <div className="text-sm font-medium text-slate-950 dark:text-white">
                  {localize('com_ui_project_meta_ads_monthly_budget')}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {localize('com_ui_project_meta_ads_monthly_budget_hint')}
                </div>
                {monthlyBudgetResolution.inheritedFrom && (
                  <div className="mt-2 rounded-xl border border-teal-300/20 bg-teal-400/10 px-3 py-2 text-xs font-medium text-teal-700 dark:text-teal-100">
                    <div>
                      {localize('com_ui_project_meta_ads_monthly_budget_inherited', {
                        0: formatMonthLabel(monthlyBudgetResolution.inheritedFrom),
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={copyPreviousMonthlyBudget}
                      className="mt-2 rounded-lg border border-teal-300/30 px-2 py-1 text-xs font-semibold text-teal-800 transition hover:bg-teal-400/10 dark:text-teal-100"
                    >
                      {localize('com_ui_project_meta_ads_month_copy_previous')}
                    </button>
                  </div>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                    {localize('com_ui_project_meta_ads_month')}
                    <div ref={monthPickerRef} className="relative">
                      <button
                        type="button"
                        disabled={!canUseMetaAdsActions}
                        aria-label={localize('com_ui_project_meta_ads_month')}
                        aria-expanded={monthPickerOpen}
                        onClick={openMonthPicker}
                        className={`${controls.inputClassName} flex items-center justify-between text-left`}
                      >
                        <span>{formatMonthLabel(selectedMonthKey)}</span>
                        <CalendarBlank
                          className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-300"
                          weight="bold"
                        />
                      </button>
                      {monthPickerOpen && (
                        <div className="absolute left-0 top-full z-30 mt-2 w-full min-w-[280px] rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.55)] dark:border-white/10 dark:bg-[#172033] dark:shadow-[0_24px_80px_-46px_rgba(0,0,0,0.9)]">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setMonthPickerYear((year) => year - 1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 text-slate-600 transition hover:border-teal-300/60 hover:bg-white dark:border-white/10 dark:text-slate-300 dark:hover:border-teal-300/45 dark:hover:bg-white/[0.06]"
                            >
                              <CaretLeft className="h-4 w-4" weight="bold" />
                            </button>
                            <div className="font-mono text-sm font-semibold text-slate-950 dark:text-white">
                              {monthPickerYear}
                            </div>
                            <button
                              type="button"
                              onClick={() => setMonthPickerYear((year) => year + 1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 text-slate-600 transition hover:border-teal-300/60 hover:bg-white dark:border-white/10 dark:text-slate-300 dark:hover:border-teal-300/45 dark:hover:bg-white/[0.06]"
                            >
                              <CaretRight className="h-4 w-4" weight="bold" />
                            </button>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {monthLabels.map((label, monthIndex) => {
                              const selected =
                                selectedMonth.year === monthPickerYear &&
                                selectedMonth.monthIndex === monthIndex;
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  data-testid={`meta-ads-month-option-${formatMonthValue(monthPickerYear, monthIndex)}`}
                                  onClick={() => selectMonth(monthIndex)}
                                  className={`h-10 rounded-xl border px-2 text-sm font-semibold transition ${
                                    selected
                                      ? 'border-teal-300/60 bg-teal-400/15 text-teal-700 dark:text-teal-100'
                                      : 'border-transparent text-slate-700 hover:border-teal-300/50 hover:bg-slate-50 dark:text-slate-200 dark:hover:border-teal-300/35 dark:hover:bg-white/[0.06]'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={clearMonth}
                              className="h-9 rounded-xl px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
                            >
                              {localize('com_ui_project_meta_ads_month_picker_clear')}
                            </button>
                            <button
                              type="button"
                              onClick={selectCurrentMonth}
                              className="h-9 rounded-xl px-3 text-xs font-semibold text-teal-700 transition hover:bg-teal-50 dark:text-teal-100 dark:hover:bg-teal-400/10"
                            >
                              {localize('com_ui_project_meta_ads_month_picker_today')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                    {localize('com_ui_project_meta_ads_monthly_base_amount')}
                    <input
                      disabled={!canUseMetaAdsActions}
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.monthlyBudget?.baseAmount ?? ''}
                      onChange={(event) => updateMonthlyBudget('baseAmount', event.target.value)}
                      className={controls.inputClassName}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                    {localize('com_ui_project_meta_ads_monthly_additional_amount')}
                    <input
                      disabled={!canUseMetaAdsActions}
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.monthlyBudget?.additionalAmount ?? ''}
                      onChange={(event) =>
                        updateMonthlyBudget('additionalAmount', event.target.value)
                      }
                      className={controls.inputClassName}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                    {localize('com_ui_project_meta_ads_monthly_allowed_overspend')}
                    <input
                      disabled={!canUseMetaAdsActions}
                      type="number"
                      min="0"
                      step="1"
                      value={draft.monthlyBudget?.allowedOverspendPct ?? ''}
                      onChange={(event) =>
                        updateMonthlyBudget('allowedOverspendPct', event.target.value)
                      }
                      className={controls.inputClassName}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200/75 p-4 dark:border-white/10">
          <button type="button" onClick={onClose} className={controls.ghostButtonClassName}>
            {localize('com_ui_cancel')}
          </button>
          <button
            type="button"
            disabled={!canUseMetaAdsActions || saving}
            onClick={onSave}
            className={controls.primaryButtonClassName}
          >
            {localize('com_ui_save')}
          </button>
        </div>
      </div>
    </div>
  );
}
