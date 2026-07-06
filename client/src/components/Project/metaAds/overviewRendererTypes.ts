import type { ReactNode, MouseEvent } from 'react';
import type {
  ProjectMetaAdsAdSummary,
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsRecommendation,
} from 'librechat-data-provider';

import type {
  Localize,
  TableColumn,
  BudgetEditor,
  DuplicateDraft,
  ManualBudgetDraft,
} from './types';
import type { EntityStatusConfirmationPayload } from './overviewCells';

export type OverviewRenderers = {
  renderCampaignCell: (
    column: TableColumn,
    campaign: ProjectMetaAdsCampaignSummary,
    recommendation: ProjectMetaAdsRecommendation | undefined,
  ) => ReactNode;
  renderAdSetCell: (
    column: TableColumn,
    campaign: ProjectMetaAdsCampaignSummary,
    adset: ProjectMetaAdsCampaignSummary['adSets'][number],
    recommendation: ProjectMetaAdsRecommendation | undefined,
  ) => ReactNode;
  renderAdRow: (
    campaign: ProjectMetaAdsCampaignSummary,
    ad: ProjectMetaAdsAdSummary,
    rowIndex: number,
  ) => ReactNode;
};

export type OverviewRendererContext = {
  columns: TableColumn[];
  currency: string;
  actionMenuKey: string | null;
  stickyCellClassName: string;
  canUseMetaAdsActions: boolean;
  applyingRecommendation: boolean;
  updatingEntityStatus: boolean;
  localize: Localize;
  getTableRowClass: (
    rowIndex: number,
    level: 'campaign' | 'adset' | 'ad',
    isClickable?: boolean,
  ) => string;
  getEntityRuleLabel: (entityLevel: 'campaign' | 'adset', entityId: string) => string;
  getManualBudgetDraft: (
    entityLevel: ManualBudgetDraft['entityLevel'],
    entityId: string,
  ) => ManualBudgetDraft | undefined;
  getDuplicateName: (name: string) => string;
  onApply: (recommendation: ProjectMetaAdsRecommendation) => void;
  onToggleActionMenu: (menuKey: string) => void;
  onOpenDuplicateDraft: (duplicate: DuplicateDraft) => void;
  onOpenBudgetEditor: (editor: BudgetEditor) => void;
  onOpenEntityStatusConfirmation: (
    event: MouseEvent<HTMLElement>,
    confirmation: EntityStatusConfirmationPayload,
  ) => void;
  onPreviewAd: (ad: ProjectMetaAdsAdSummary) => void;
};
