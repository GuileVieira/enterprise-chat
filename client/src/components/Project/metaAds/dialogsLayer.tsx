import type { ComponentProps } from 'react';

import { MetaAdsAdPreviewDialog, MetaAdsBiRankDetailsDialog } from './dialogs';
import {
  MetaAdsDiscardDraftDialog,
  MetaAdsPublishDraftDialog,
  MetaAdsDuplicateEntityDialog,
  MetaAdsEntityStatusConfirmationBanner,
} from './confirmations';
import { MetaAdsRankMedia } from './rankMedia';
import { MetaAdsSettingsDrawer } from './settingsDrawer';
import { MetaAdsRuleGroupDialog } from './ruleGroupDialog';
import { MetaAdsCredentialsDialog } from './credentialsDialog';
import { MetaAdsBudgetEditorDialog } from './budgetEditor';
import type { Localize, MetaAdsBiRankItem } from './types';
import type { useMetaAdsRules } from './hooks/useMetaAdsRules';
import type { useMetaAdsSettings } from './hooks/useMetaAdsSettings';
import type { useMetaAdsEntityActions } from './hooks/useMetaAdsEntityActions';

type MetaAdsDialogsLayerProps = {
  settingsState: ReturnType<typeof useMetaAdsSettings>;
  entityActions: ReturnType<typeof useMetaAdsEntityActions>;
  rulesState: ReturnType<typeof useMetaAdsRules>;
  token: {
    configured: boolean;
    tenantConfigured: boolean;
    statusLabel: string;
    effectiveGraphVersion: string;
    graphVersionOptions: string[];
    canManageTenantToken: boolean;
    canUseMetaAdsActions: boolean;
    hasProjectToken: boolean;
  };
  mutations: {
    savingSettings: boolean;
    savingTenantToken: boolean;
    savingBudget: boolean;
    savingDuplicate: boolean;
    updatingEntityStatus: boolean;
  };
  currency: string;
  localize: Localize;
  metricsFullscreen: boolean;
  selectedBiRankItem: MetaAdsBiRankItem | null;
  onCloseBiRank: () => void;
  cleanName: ComponentProps<typeof MetaAdsBiRankDetailsDialog>['cleanName'];
  chrome: {
    overviewActive: boolean;
    modalOverlayClassName: string;
    modalShellClassName: string;
    drawerShellClassName: string;
    modalHeaderClassName: string;
    modalTileClassName: string;
    labelClassName: string;
  };
  controls: {
    inputClassName: string;
    buttonClassName: string;
    primaryButtonClassName: string;
    ghostButtonClassName: string;
  };
};

export function MetaAdsDialogsLayer({
  settingsState,
  entityActions,
  rulesState,
  token,
  mutations,
  currency,
  localize,
  metricsFullscreen,
  selectedBiRankItem,
  onCloseBiRank,
  cleanName,
  chrome,
  controls,
}: MetaAdsDialogsLayerProps) {
  const modalChrome = {
    modalShellClassName: chrome.modalShellClassName,
    modalHeaderClassName: chrome.modalHeaderClassName,
    modalTileClassName: chrome.modalTileClassName,
  };
  const drawerChrome = {
    modalOverlayClassName: chrome.modalOverlayClassName,
    drawerShellClassName: chrome.drawerShellClassName,
    modalHeaderClassName: chrome.modalHeaderClassName,
    modalTileClassName: chrome.modalTileClassName,
  };
  const drawerChromeWithLabel = {
    ...drawerChrome,
    labelClassName: chrome.labelClassName,
  };
  const buttonClasses = {
    primaryClassName: controls.primaryButtonClassName,
    ghostClassName: controls.ghostButtonClassName,
  };
  const {
    settings,
    settingsDraft,
    settingsDraftSummary,
    settingsDraftToken,
    discardDraftDialogOpen,
    publishDraftDialogOpen,
    showSettingsDraftToken,
    credentialsDialogOpen,
    tenantAccessToken,
    showTenantAccessToken,
    settingsDrawer,
    setSettingsDraft,
    setSettingsDraftToken,
    setShowSettingsDraftToken,
    setCredentialsDialogOpen,
    setTenantAccessToken,
    setShowTenantAccessToken,
    onClearProjectToken,
    closeSettingsDrawer,
    openCredentialsDialog,
    closeCredentialsDialog,
    onCancelDiscardSettingsDraft,
    onCancelPublishSettingsDraft,
    onConfirmDiscardSettingsDraft,
    onConfirmPublishSettingsDraft,
    onSaveSettingsDrawer,
    onSaveProjectToken,
    onSaveTenantToken,
  } = settingsState;
  const {
    budgetEditor,
    manualDailyBudget,
    entityStatusConfirmation,
    duplicateDraft,
    duplicateTargetName,
    selectedAdPreview,
    setBudgetEditor,
    setManualDailyBudget,
    setEntityStatusConfirmation,
    setDuplicateTargetName,
    setSelectedAdPreview,
    onSaveManualBudget,
    onCloseDuplicateDraft,
    onConfirmDuplicate,
    onConfirmEntityStatus,
  } = entityActions;
  const {
    ruleGroupDraft,
    ruleDraftEntityLabels,
    ruleDraftEntityOptions,
    setRuleGroupDraft,
    onRuleGroupRuleChange,
    onRuleGroupRuleTextChange,
    onRuleGroupAnalysisPresetChange,
    onRuleGroupNoResultSpendCapChange,
    onRuleGroupEntityToggle,
    onAccountProfileChange,
    onRuleGroupCreativeRuleChange,
    onSaveRuleGroup,
  } = rulesState;

  return (
    <>
      <MetaAdsSettingsDrawer
        drawer={settingsDrawer}
        draft={settingsDraft}
        tokenConfigured={token.configured}
        tokenStatusLabel={token.statusLabel}
        effectiveGraphVersion={token.effectiveGraphVersion}
        graphVersionOptions={token.graphVersionOptions}
        canUseMetaAdsActions={token.canUseMetaAdsActions}
        saving={mutations.savingSettings}
        localize={localize}
        onDraftChange={setSettingsDraft}
        onOpenCredentials={openCredentialsDialog}
        onClose={closeSettingsDrawer}
        onSave={onSaveSettingsDrawer}
        chrome={drawerChrome}
        controls={{
          inputClassName: controls.inputClassName,
          buttonClassName: controls.buttonClassName,
          primaryButtonClassName: controls.primaryButtonClassName,
          ghostButtonClassName: controls.ghostButtonClassName,
        }}
      />
      <MetaAdsCredentialsDialog
        open={credentialsDialogOpen}
        tenantConfigured={token.tenantConfigured}
        canManageTenantToken={token.canManageTenantToken}
        canUseMetaAdsActions={token.canUseMetaAdsActions}
        hasProjectToken={token.hasProjectToken}
        tenantAccessToken={tenantAccessToken}
        showTenantAccessToken={showTenantAccessToken}
        settingsDraftToken={settingsDraftToken}
        showSettingsDraftToken={showSettingsDraftToken}
        savingTenantToken={mutations.savingTenantToken}
        savingProjectToken={mutations.savingSettings}
        localize={localize}
        onOpen={() => setCredentialsDialogOpen(true)}
        onClose={closeCredentialsDialog}
        onTenantAccessTokenChange={setTenantAccessToken}
        onToggleTenantAccessToken={() => setShowTenantAccessToken((current) => !current)}
        onSaveTenantToken={onSaveTenantToken}
        onSettingsDraftTokenChange={setSettingsDraftToken}
        onToggleSettingsDraftToken={() => setShowSettingsDraftToken((current) => !current)}
        onClearProjectToken={onClearProjectToken}
        onSaveProjectToken={onSaveProjectToken}
        chrome={modalChrome}
        buttons={buttonClasses}
      />
      <MetaAdsDiscardDraftDialog
        open={discardDraftDialogOpen}
        summary={settingsDraftSummary}
        localize={localize}
        onCancel={onCancelDiscardSettingsDraft}
        onConfirm={onConfirmDiscardSettingsDraft}
        chrome={drawerChrome}
        buttons={buttonClasses}
      />
      <MetaAdsPublishDraftDialog
        open={publishDraftDialogOpen}
        summary={settingsDraftSummary}
        localize={localize}
        onCancel={onCancelPublishSettingsDraft}
        onConfirm={onConfirmPublishSettingsDraft}
        chrome={drawerChrome}
        buttons={buttonClasses}
      />
      {chrome.overviewActive && (
        <>
          <MetaAdsBudgetEditorDialog
            editor={budgetEditor}
            dailyBudget={manualDailyBudget}
            currency={currency}
            saving={mutations.savingBudget}
            localize={localize}
            onDailyBudgetChange={setManualDailyBudget}
            onClose={() => {
              setBudgetEditor(null);
            }}
            onSave={onSaveManualBudget}
            chrome={{
              modalOverlayClassName: chrome.modalOverlayClassName,
              modalShellClassName: chrome.modalShellClassName,
              modalTileClassName: chrome.modalTileClassName,
            }}
            controls={{
              inputClassName: controls.inputClassName,
              primaryButtonClassName: controls.primaryButtonClassName,
              ghostButtonClassName: controls.ghostButtonClassName,
            }}
          />
          <MetaAdsEntityStatusConfirmationBanner
            confirmation={entityStatusConfirmation}
            saving={mutations.updatingEntityStatus}
            localize={localize}
            onCancel={() => setEntityStatusConfirmation(null)}
            onConfirm={onConfirmEntityStatus}
          />
          <MetaAdsDuplicateEntityDialog
            draft={duplicateDraft}
            targetName={duplicateTargetName}
            currency={currency}
            saving={mutations.savingDuplicate}
            localize={localize}
            onTargetNameChange={setDuplicateTargetName}
            onClose={onCloseDuplicateDraft}
            onConfirm={onConfirmDuplicate}
            chrome={drawerChrome}
            buttons={{
              ...buttonClasses,
              inputClassName: controls.inputClassName,
            }}
          />
        </>
      )}
      <MetaAdsRuleGroupDialog
        draft={ruleGroupDraft}
        settings={settings}
        entityLabels={ruleDraftEntityLabels}
        entityOptions={ruleDraftEntityOptions}
        saving={mutations.savingSettings}
        localize={localize}
        onNameChange={(name) =>
          setRuleGroupDraft((current) => (current ? { ...current, name } : current))
        }
        onAccountProfileChange={onAccountProfileChange}
        onRuleChange={onRuleGroupRuleChange}
        onRuleTextChange={onRuleGroupRuleTextChange}
        onAnalysisPresetChange={onRuleGroupAnalysisPresetChange}
        onNoResultSpendCapChange={onRuleGroupNoResultSpendCapChange}
        onEntityToggle={onRuleGroupEntityToggle}
        onCreativeRuleChange={onRuleGroupCreativeRuleChange}
        onClose={() => setRuleGroupDraft(null)}
        onSave={onSaveRuleGroup}
        chrome={drawerChromeWithLabel}
        controls={{
          inputClassName: controls.inputClassName,
          primaryButtonClassName: controls.primaryButtonClassName,
          ghostButtonClassName: controls.ghostButtonClassName,
        }}
      />
      <MetaAdsAdPreviewDialog
        ad={selectedAdPreview}
        currency={currency}
        localize={localize}
        metricsFullscreen={metricsFullscreen}
        onClose={() => setSelectedAdPreview(null)}
        chrome={modalChrome}
      />
      <MetaAdsBiRankDetailsDialog
        item={selectedBiRankItem}
        currency={currency}
        localize={localize}
        cleanName={cleanName}
        onClose={onCloseBiRank}
        chrome={modalChrome}
        renderRankMedia={(item, size) => (
          <MetaAdsRankMedia item={item} size={size} localize={localize} />
        )}
      />
    </>
  );
}
