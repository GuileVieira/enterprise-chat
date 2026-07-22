import type { ProjectMetaAdsRuleChange } from 'librechat-data-provider';

import type { Localize, MetaAdsRuleAudit } from './types';

function formatRuleAuditDate(value?: string) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatRuleAuditUser(user?: { id?: string; name?: string; email?: string }) {
  return user?.name || user?.email || user?.id || '-';
}

export function formatRuleAuditLine(
  audit: MetaAdsRuleAudit | undefined,
  type: 'created' | 'updated',
  localize: Localize,
) {
  const date = type === 'created' ? audit?.createdAt : audit?.updatedAt;
  const user = type === 'created' ? audit?.createdBy : audit?.updatedBy;
  if (!date) {
    return null;
  }
  const labelKey =
    type === 'created'
      ? 'com_ui_project_meta_ads_rule_created_by'
      : 'com_ui_project_meta_ads_rule_updated_by';
  const formattedDate = formatRuleAuditDate(date);
  const formattedUser = formatRuleAuditUser(user);
  const label = localize(labelKey, {
    0: formattedDate,
    1: formattedUser,
  });
  return label === labelKey ? `${label}: ${formattedDate} · ${formattedUser}` : label;
}

export function formatRuleHistoryActor(change: ProjectMetaAdsRuleChange) {
  return change.actorUserName || change.actorUserEmail || change.actorUserId || change.actor || '-';
}

export function formatRuleChangeAction(change: ProjectMetaAdsRuleChange, localize: Localize) {
  if (!change.ruleChanges?.length) {
    return '';
  }
  return change.ruleChanges
    .map((ruleChange) => {
      const labelKey =
        ruleChange.ruleType === 'global'
          ? 'com_ui_project_meta_ads_global_rules_updated'
          : (`com_ui_project_meta_ads_rule_action_${ruleChange.action}` as Parameters<
              typeof localize
            >[0]);
      const ruleName =
        ruleChange.ruleType === 'global'
          ? localize('com_ui_project_meta_ads_global_rules')
          : ruleChange.ruleName || ruleChange.ruleKey;
      const label = localize(labelKey, { 0: ruleName });
      return label === labelKey ? `${ruleName} ${label}` : label;
    })
    .join(', ');
}
