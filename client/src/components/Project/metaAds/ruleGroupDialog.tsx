import { useMemo, useState } from 'react';

import {
  numberFields,
  resultTypeOptions,
  primaryMetricOptions,
  accountProfileOptions,
  optionalNumberFields,
  getRuleDraftTitleKey,
} from './rules';
import { RuleFieldLabel } from './ruleFields';
import type {
  Localize,
  RuleGroupDraft,
  MetaAdsRulesState,
  MetaAdsSettingsState,
  RuleGroupEntityOption,
} from './types';

type RuleGroupDialogChrome = {
  modalOverlayClassName: string;
  drawerShellClassName: string;
  modalHeaderClassName: string;
  modalTileClassName: string;
  labelClassName: string;
};

type RuleGroupDialogControls = {
  inputClassName: string;
  primaryButtonClassName: string;
  ghostButtonClassName: string;
};

function getRuleNumberMin(key: keyof MetaAdsRulesState) {
  if (key === 'minRoas' || key === 'minSpend') {
    return '0';
  }
  if (key === 'cooldownHours') {
    return '1';
  }
  return '0.01';
}

function getRuleNumberMax(key: keyof MetaAdsRulesState) {
  if (key === 'maxIncreasePct' || key === 'maxDecreasePct') {
    return '100';
  }
  if (key === 'cooldownHours') {
    return '168';
  }
  return undefined;
}

function getCreativeRuleNumberMin(key: string) {
  if (key === 'pauseHighCost.minCreativesInScope') {
    return '3';
  }
  if (key === 'pauseHighCost.cooldownHours') {
    return '1';
  }
  if (key === 'pauseHighCost.maxCostPerResult') {
    return '0.01';
  }
  return '0';
}

function getCreativeRuleNumberMax(key: string) {
  return key === 'pauseHighCost.cooldownHours' ? '168' : undefined;
}

function getInvalidInputClassName(inputClassName: string, hasError: boolean) {
  return hasError
    ? `${inputClassName} border-red-500 ring-1 ring-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-400 dark:ring-red-400`
    : inputClassName;
}

function getNumberErrorKey(value: unknown, min: number, max?: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < min) {
    return max == null
      ? 'com_ui_project_meta_ads_field_error_min'
      : 'com_ui_project_meta_ads_field_error_range';
  }
  if (max != null && numericValue > max) {
    return 'com_ui_project_meta_ads_field_error_range';
  }
  return undefined;
}

export function MetaAdsRuleGroupDialog({
  draft,
  settings,
  entityLabels,
  entityOptions,
  saving,
  localize,
  onNameChange,
  onAccountProfileChange,
  onRuleChange,
  onRuleTextChange,
  onNoResultSpendCapChange,
  onEntityToggle,
  onCreativeRuleChange,
  onClose,
  onSave,
  chrome,
  controls,
}: {
  draft: RuleGroupDraft | null;
  settings: MetaAdsSettingsState;
  entityLabels: string[];
  entityOptions: RuleGroupEntityOption[];
  saving: boolean;
  localize: Localize;
  onNameChange: (value: string) => void;
  onAccountProfileChange: (value: MetaAdsSettingsState['accountProfile']) => void;
  onRuleChange: (key: keyof MetaAdsRulesState, value: string) => void;
  onRuleTextChange: (key: keyof MetaAdsRulesState, value: string) => void;
  onNoResultSpendCapChange: (key: 'enabled' | 'minSpend', value: boolean | string) => void;
  onEntityToggle: (entityId: string) => void;
  onCreativeRuleChange: (
    key:
      | 'maxFrequency'
      | 'pauseHighCost.enabled'
      | 'pauseHighCost.maxCostPerResult'
      | 'pauseHighCost.lookbackDays'
      | 'pauseHighCost.minCreativesInScope'
      | 'pauseHighCost.minSpend'
      | 'pauseHighCost.cooldownHours'
      | 'pauseHighCost.targetResultType',
    value: string,
  ) => void;
  onClose: () => void;
  onSave: () => void;
  chrome: RuleGroupDialogChrome;
  controls: RuleGroupDialogControls;
}) {
  const [entitySearch, setEntitySearch] = useState('');
  const entitySearchQuery = entitySearch.trim().toLowerCase();
  const filteredEntityOptions = useMemo(
    () =>
      entitySearchQuery
        ? entityOptions.filter(
            (option) =>
              option.label.toLowerCase().includes(entitySearchQuery) ||
              option.id.toLowerCase().includes(entitySearchQuery),
          )
        : entityOptions,
    [entityOptions, entitySearchQuery],
  );
  if (!draft) {
    return null;
  }
  const pauseHighCost = draft.creativeRules.pauseHighCost;
  const maxFrequencyErrorKey = getNumberErrorKey(draft.creativeRules.maxFrequency, 0);
  const maxCostErrorKey = getNumberErrorKey(pauseHighCost?.maxCostPerResult, 0.01);
  const fieldErrors = {
    'pauseHighCost.minCreativesInScope': getNumberErrorKey(pauseHighCost?.minCreativesInScope, 3),
    'pauseHighCost.minSpend': getNumberErrorKey(pauseHighCost?.minSpend, 0),
    'pauseHighCost.cooldownHours': getNumberErrorKey(pauseHighCost?.cooldownHours, 1, 168),
  };
  const entitySectionTitleKey =
    draft.entityLevel === 'campaign'
      ? 'com_ui_project_meta_ads_rule_group_campaigns'
      : 'com_ui_project_meta_ads_rule_group_adsets';
  const entitySearchLabelKey =
    draft.entityLevel === 'campaign'
      ? 'com_ui_project_meta_ads_search_campaigns'
      : 'com_ui_project_meta_ads_search_adsets';
  const entityEmptyKey =
    draft.entityLevel === 'campaign'
      ? 'com_ui_project_meta_ads_no_campaigns_found'
      : 'com_ui_project_meta_ads_no_adsets_found';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meta-ads-rule-group-dialog-title"
      className={`${chrome.modalOverlayClassName} flex justify-end p-0`}
    >
      <div className={`${chrome.drawerShellClassName} max-w-xl`}>
        <div className={chrome.modalHeaderClassName}>
          <h4
            id="meta-ads-rule-group-dialog-title"
            className="text-base font-semibold text-slate-950 dark:text-white"
          >
            {localize(getRuleDraftTitleKey(draft))}
          </h4>
          {draft.scope === 'global' ? (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_global_rules_hint')}
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                {draft.entityLevel === 'campaign'
                  ? localize('com_ui_project_meta_ads_campaign')
                  : localize('com_ui_project_meta_ads_select_ad_set')}
                {' · '}
                {draft.entityIds.length} {localize('com_ui_project_meta_ads_rule_group_selected')}
              </div>
              <div className="flex flex-wrap gap-2">
                {entityLabels.slice(0, 8).map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {(draft.scope === 'group' || draft.scope === 'override') && (
            <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
              <RuleFieldLabel
                localize={localize}
                labelKey="com_ui_project_meta_ads_rule_group_name"
                hintKey="com_ui_project_meta_ads_rule_group_name_hint"
              />
              <input
                aria-label={localize('com_ui_project_meta_ads_rule_group_name')}
                value={draft.name}
                onChange={(event) => onNameChange(event.target.value)}
                className={controls.inputClassName}
              />
            </label>
          )}
          {draft.scope === 'group' && (
            <div className={chrome.modalTileClassName}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h5 className={chrome.labelClassName}>{localize(entitySectionTitleKey)}</h5>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {draft.entityIds.length}{' '}
                    {localize('com_ui_project_meta_ads_rule_group_selected')}
                  </div>
                </div>
              </div>
              <label className="mt-3 flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-medium">{localize(entitySearchLabelKey)}</span>
                <input
                  aria-label={localize(entitySearchLabelKey)}
                  value={entitySearch}
                  onChange={(event) => setEntitySearch(event.target.value)}
                  className={controls.inputClassName}
                />
              </label>
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {filteredEntityOptions.length > 0 ? (
                  filteredEntityOptions.map((option) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-sm text-slate-700 transition hover:border-teal-300/60 dark:border-white/10 dark:bg-slate-950/20 dark:text-slate-200 dark:hover:border-teal-300/45"
                    >
                      <input
                        type="checkbox"
                        checked={option.selected}
                        onChange={() => onEntityToggle(option.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    </label>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200/80 px-3 py-4 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                    {localize(entityEmptyKey)}
                  </div>
                )}
              </div>
            </div>
          )}
          {draft.scope === 'global' && (
            <div className={chrome.modalTileClassName}>
              <h5 className={chrome.labelClassName}>
                {localize('com_ui_project_meta_ads_rule_section_target')}
              </h5>
              <label className="mt-2 flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                <RuleFieldLabel
                  localize={localize}
                  labelKey="com_ui_project_meta_ads_account_profile"
                  hintKey="com_ui_project_meta_ads_account_profile_hint"
                />
                <select
                  aria-label={localize('com_ui_project_meta_ads_account_profile')}
                  value={settings.accountProfile ?? 'custom'}
                  onChange={(event) =>
                    onAccountProfileChange(
                      event.target.value as MetaAdsSettingsState['accountProfile'],
                    )
                  }
                  className={controls.inputClassName}
                >
                  {accountProfileOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {localize(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className={chrome.modalTileClassName}>
            <h5 className={chrome.labelClassName}>
              {localize('com_ui_project_meta_ads_rule_section_performance')}
            </h5>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                <RuleFieldLabel
                  localize={localize}
                  labelKey="com_ui_project_meta_ads_target_result_type"
                  hintKey="com_ui_project_meta_ads_target_result_type_hint"
                />
                <select
                  aria-label={localize('com_ui_project_meta_ads_target_result_type')}
                  value={draft.rules.targetResultType ?? ''}
                  onChange={(event) => onRuleTextChange('targetResultType', event.target.value)}
                  className={controls.inputClassName}
                >
                  <option value="">{localize('com_ui_project_meta_ads_result_type_legacy')}</option>
                  {resultTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {localize(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                <RuleFieldLabel
                  localize={localize}
                  labelKey="com_ui_project_meta_ads_primary_metric"
                  hintKey="com_ui_project_meta_ads_primary_metric_hint"
                />
                <select
                  aria-label={localize('com_ui_project_meta_ads_primary_metric')}
                  value={draft.rules.primaryMetric ?? 'cpa'}
                  onChange={(event) => onRuleTextChange('primaryMetric', event.target.value)}
                  className={controls.inputClassName}
                >
                  {primaryMetricOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {localize(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className={chrome.modalTileClassName}>
            <h5 className={chrome.labelClassName}>
              {localize('com_ui_project_meta_ads_rule_section_budget')}
            </h5>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {numberFields.map((field) => (
                <label
                  key={field.key}
                  className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300"
                >
                  <RuleFieldLabel
                    localize={localize}
                    labelKey={field.labelKey}
                    hintKey={field.hintKey}
                  />
                  <input
                    aria-label={localize(field.labelKey)}
                    type="number"
                    step={field.step}
                    min={getRuleNumberMin(field.key)}
                    max={getRuleNumberMax(field.key)}
                    value={draft.rules[field.key] ?? ''}
                    onChange={(event) => onRuleChange(field.key, event.target.value)}
                    className={controls.inputClassName}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className={chrome.modalTileClassName}>
            <h5 className={chrome.labelClassName}>
              {localize('com_ui_project_meta_ads_no_result_rule')}
            </h5>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  aria-label={localize('com_ui_project_meta_ads_no_result_spend_cap')}
                  type="checkbox"
                  checked={draft.rules.noResultSpendCap?.enabled === true}
                  onChange={(event) => onNoResultSpendCapChange('enabled', event.target.checked)}
                />
                <span>{localize('com_ui_project_meta_ads_no_result_spend_cap')}</span>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                <RuleFieldLabel
                  localize={localize}
                  labelKey="com_ui_project_meta_ads_no_result_spend_cap_min"
                  hintKey="com_ui_project_meta_ads_no_result_spend_cap_min_hint"
                />
                <input
                  aria-label={localize('com_ui_project_meta_ads_no_result_spend_cap_min')}
                  disabled={draft.rules.noResultSpendCap?.enabled !== true}
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.rules.noResultSpendCap?.minSpend ?? ''}
                  onChange={(event) => onNoResultSpendCapChange('minSpend', event.target.value)}
                  className={controls.inputClassName}
                />
              </label>
            </div>
          </div>
          <div className={chrome.modalTileClassName}>
            <h5 className={chrome.labelClassName}>
              {localize('com_ui_project_meta_ads_rule_section_guardrails')}
            </h5>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {optionalNumberFields.map((field) => (
                <label
                  key={field.key}
                  className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300"
                >
                  <RuleFieldLabel
                    localize={localize}
                    labelKey={field.labelKey}
                    hintKey={field.hintKey}
                  />
                  <input
                    aria-label={localize(field.labelKey)}
                    type="number"
                    step={field.step}
                    min="0"
                    value={draft.rules[field.key] ?? ''}
                    placeholder={localize('com_ui_project_meta_ads_optional_rule')}
                    onChange={(event) => onRuleChange(field.key, event.target.value)}
                    className={controls.inputClassName}
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                <RuleFieldLabel
                  localize={localize}
                  labelKey="com_ui_project_meta_ads_max_frequency_alert"
                  hintKey="com_ui_project_meta_ads_max_frequency_alert_hint"
                />
                <input
                  aria-label={localize('com_ui_project_meta_ads_max_frequency_alert')}
                  aria-invalid={maxFrequencyErrorKey ? true : undefined}
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.creativeRules.maxFrequency}
                  onChange={(event) => onCreativeRuleChange('maxFrequency', event.target.value)}
                  className={getInvalidInputClassName(
                    controls.inputClassName,
                    !!maxFrequencyErrorKey,
                  )}
                />
                {maxFrequencyErrorKey && (
                  <span className="text-xs font-medium text-red-600 dark:text-red-300">
                    {localize(maxFrequencyErrorKey, { 0: '0' })}
                  </span>
                )}
              </label>
            </div>
          </div>
          <div className={chrome.modalTileClassName}>
            <h5 className={chrome.labelClassName}>
              {localize('com_ui_project_meta_ads_rule_section_creatives')}
            </h5>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  aria-label={localize('com_ui_project_meta_ads_pause_high_cost_creatives')}
                  type="checkbox"
                  checked={draft.creativeRules.pauseHighCost?.enabled === true}
                  onChange={(event) =>
                    onCreativeRuleChange(
                      'pauseHighCost.enabled',
                      event.target.checked ? 'true' : 'false',
                    )
                  }
                />
                <span>{localize('com_ui_project_meta_ads_pause_high_cost_creatives')}</span>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                <RuleFieldLabel
                  localize={localize}
                  labelKey="com_ui_project_meta_ads_pause_cost_limit"
                  hintKey="com_ui_project_meta_ads_pause_cost_limit_hint"
                />
                <input
                  aria-label={localize('com_ui_project_meta_ads_pause_cost_limit')}
                  aria-invalid={maxCostErrorKey ? true : undefined}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={draft.creativeRules.pauseHighCost?.maxCostPerResult ?? ''}
                  onChange={(event) =>
                    onCreativeRuleChange('pauseHighCost.maxCostPerResult', event.target.value)
                  }
                  className={getInvalidInputClassName(controls.inputClassName, !!maxCostErrorKey)}
                />
                {maxCostErrorKey && (
                  <span className="text-xs font-medium text-red-600 dark:text-red-300">
                    {localize(maxCostErrorKey, { 0: '0.01' })}
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                <RuleFieldLabel
                  localize={localize}
                  labelKey="com_ui_project_meta_ads_pause_lookback_days"
                  hintKey="com_ui_project_meta_ads_pause_lookback_days_hint"
                />
                <select
                  aria-label={localize('com_ui_project_meta_ads_pause_lookback_days')}
                  value={draft.creativeRules.pauseHighCost?.lookbackDays ?? 3}
                  onChange={(event) =>
                    onCreativeRuleChange('pauseHighCost.lookbackDays', event.target.value)
                  }
                  className={controls.inputClassName}
                >
                  {[1, 2, 3, 7].map((days) => (
                    <option key={days} value={days}>
                      {days}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                <RuleFieldLabel
                  localize={localize}
                  labelKey="com_ui_project_meta_ads_pause_target_result_type"
                  hintKey="com_ui_project_meta_ads_target_result_type_hint"
                />
                <select
                  aria-label={localize('com_ui_project_meta_ads_pause_target_result_type')}
                  value={draft.creativeRules.pauseHighCost?.targetResultType ?? ''}
                  onChange={(event) =>
                    onCreativeRuleChange('pauseHighCost.targetResultType', event.target.value)
                  }
                  className={controls.inputClassName}
                >
                  <option value="">{localize('com_ui_project_meta_ads_result_type_legacy')}</option>
                  {resultTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {localize(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              {[
                [
                  'pauseHighCost.minCreativesInScope',
                  'com_ui_project_meta_ads_pause_min_creatives',
                  'com_ui_project_meta_ads_pause_min_creatives_hint',
                ],
                [
                  'pauseHighCost.minSpend',
                  'com_ui_project_meta_ads_min_spend',
                  'com_ui_project_meta_ads_pause_min_spend_hint',
                ],
                [
                  'pauseHighCost.cooldownHours',
                  'com_ui_project_meta_ads_cooldown',
                  'com_ui_project_meta_ads_pause_cooldown_hint',
                ],
              ].map(([key, labelKey, hintKey]) => {
                const errorKey = fieldErrors[key as keyof typeof fieldErrors];
                const min = getCreativeRuleNumberMin(key);
                const max = getCreativeRuleNumberMax(key);
                return (
                  <label
                    key={key}
                    className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300"
                  >
                    <RuleFieldLabel
                      localize={localize}
                      labelKey={labelKey as Parameters<typeof localize>[0]}
                      hintKey={hintKey as Parameters<typeof localize>[0]}
                    />
                    <input
                      aria-label={localize(labelKey as Parameters<typeof localize>[0])}
                      aria-invalid={errorKey ? true : undefined}
                      type="number"
                      min={min}
                      max={max}
                      step="1"
                      value={
                        draft.creativeRules.pauseHighCost?.[
                          key.replace('pauseHighCost.', '') as keyof NonNullable<
                            typeof draft.creativeRules.pauseHighCost
                          >
                        ] ?? ''
                      }
                      onChange={(event) =>
                        onCreativeRuleChange(
                          key as Parameters<typeof onCreativeRuleChange>[0],
                          event.target.value,
                        )
                      }
                      className={getInvalidInputClassName(controls.inputClassName, !!errorKey)}
                    />
                    {errorKey && (
                      <span className="text-xs font-medium text-red-600 dark:text-red-300">
                        {localize(errorKey, max ? { 0: min, 1: max } : { 0: min })}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200/75 p-4 dark:border-white/10">
          <button type="button" onClick={onClose} className={controls.ghostButtonClassName}>
            {localize('com_ui_cancel')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className={controls.primaryButtonClassName}
          >
            {localize('com_ui_project_meta_ads_save_rule_group')}
          </button>
        </div>
      </div>
    </div>
  );
}
