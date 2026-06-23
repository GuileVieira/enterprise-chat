import {
  numberFields,
  resultTypeOptions,
  primaryMetricOptions,
  accountProfileOptions,
  optionalNumberFields,
  getRuleDraftTitleKey,
} from './rules';
import { RuleFieldLabel } from './ruleFields';
import type { Localize, RuleGroupDraft, MetaAdsRulesState, MetaAdsSettingsState } from './types';

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

export function MetaAdsRuleGroupDialog({
  draft,
  settings,
  entityLabels,
  saving,
  localize,
  onNameChange,
  onAccountProfileChange,
  onRuleChange,
  onRuleTextChange,
  onCreativeRuleChange,
  onClose,
  onSave,
  chrome,
  controls,
}: {
  draft: RuleGroupDraft | null;
  settings: MetaAdsSettingsState;
  entityLabels: string[];
  saving: boolean;
  localize: Localize;
  onNameChange: (value: string) => void;
  onAccountProfileChange: (value: MetaAdsSettingsState['accountProfile']) => void;
  onRuleChange: (key: keyof MetaAdsRulesState, value: string) => void;
  onRuleTextChange: (key: keyof MetaAdsRulesState, value: string) => void;
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
  if (!draft) {
    return null;
  }

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
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.creativeRules.maxFrequency}
                  onChange={(event) => onCreativeRuleChange('maxFrequency', event.target.value)}
                  className={controls.inputClassName}
                />
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
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={draft.creativeRules.pauseHighCost?.maxCostPerResult ?? ''}
                  onChange={(event) =>
                    onCreativeRuleChange('pauseHighCost.maxCostPerResult', event.target.value)
                  }
                  className={controls.inputClassName}
                />
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
              ].map(([key, labelKey, hintKey]) => (
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
                    type="number"
                    min="0"
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
                    className={controls.inputClassName}
                  />
                </label>
              ))}
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
