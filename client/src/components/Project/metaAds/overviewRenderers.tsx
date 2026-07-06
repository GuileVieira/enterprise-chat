import type { ReactNode } from 'react';
import type {
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsRecommendation,
} from 'librechat-data-provider';

import {
  MetaAdsLevelCell,
  MetaAdsBudgetBadge,
  MetaAdsAdSetNameCell,
  MetaAdsFrequencyValue,
  MetaAdsCampaignNameCell,
  MetaAdsEntityStatusToggleCell,
} from './overviewCells';
import { formatMetric, formatMoney, getObjectiveLabel } from './formatters';
import { createMetaAdsAdRenderers } from './overviewAdRenderers';
import { getRecommendationLabel } from './recommendations';
import { MetaAdsOverviewActionCell } from './overviewActionCell';
import type { DuplicateDraft, Localize, TableColumn } from './types';
import type { EntityStatusConfirmationPayload } from './overviewCells';
import type { OverviewRenderers, OverviewRendererContext } from './overviewRendererTypes';

function metricCell(column: TableColumn, content: ReactNode) {
  return (
    <td
      key={column.key}
      className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
    >
      {content}
    </td>
  );
}

function textCell(column: TableColumn, content: ReactNode) {
  return (
    <td key={column.key} className="truncate px-2 py-2 text-text-secondary">
      {content}
    </td>
  );
}

function recommendationCell({
  column,
  recommendation,
  currency,
}: {
  column: TableColumn;
  recommendation: ProjectMetaAdsRecommendation | undefined;
  currency: string;
}) {
  return (
    <td key={column.key} className="px-2 py-2 text-text-secondary">
      <div className="truncate">{getRecommendationLabel(recommendation, currency)}</div>
      {recommendation?.reason && (
        <div className="truncate text-text-tertiary">{recommendation.reason}</div>
      )}
    </td>
  );
}

function actionCell({
  column,
  recommendation,
  duplicate,
  context,
}: {
  column: TableColumn;
  recommendation: ProjectMetaAdsRecommendation | undefined;
  duplicate: DuplicateDraft;
  context: OverviewRendererContext;
}) {
  return (
    <MetaAdsOverviewActionCell
      key={column.key}
      columnKey={column.key}
      recommendation={recommendation}
      duplicate={duplicate}
      actionMenuKey={context.actionMenuKey}
      canUseMetaAdsActions={context.canUseMetaAdsActions}
      applyingRecommendation={context.applyingRecommendation}
      localize={context.localize}
      onApply={context.onApply}
      onToggleActionMenu={context.onToggleActionMenu}
      onOpenDuplicateDraft={context.onOpenDuplicateDraft}
    />
  );
}

function sharedCampaignMetricCell({
  column,
  campaign,
  valueSource,
  currency,
  localize,
}: {
  column: TableColumn;
  campaign: ProjectMetaAdsCampaignSummary;
  valueSource: ProjectMetaAdsCampaignSummary | ProjectMetaAdsCampaignSummary['adSets'][number];
  currency: string;
  localize: Localize;
}) {
  if (column.key === 'objective') {
    return textCell(column, getObjectiveLabel(campaign.objective, localize));
  }
  if (column.key === 'budgetMode') {
    return textCell(column, campaign.budgetMode ?? '-');
  }
  if (column.key === 'frequency') {
    return metricCell(column, <MetaAdsFrequencyValue source={valueSource} localize={localize} />);
  }
  if (column.key === 'result') {
    return metricCell(column, formatMetric(valueSource.resultCount));
  }
  if (column.key === 'cpa') {
    return metricCell(column, formatMoney(valueSource.cpa, currency));
  }
  if (column.key === 'roas') {
    return metricCell(column, formatMetric(valueSource.roas));
  }
  if (column.key === 'spend') {
    return metricCell(column, formatMoney(valueSource.spend, currency));
  }
  if (column.key === 'ctr') {
    return metricCell(column, formatMetric(valueSource.ctr));
  }
  if (column.key === 'clicks') {
    return metricCell(column, formatMetric(valueSource.clicks));
  }
  if (column.key === 'video') {
    return metricCell(column, formatMetric(valueSource.videoP75Watched));
  }
  return null;
}

export function createMetaAdsOverviewRenderers(
  context: OverviewRendererContext,
): OverviewRenderers {
  const renderEntityStatus = ({
    entityLevel,
    entityId,
    entityName,
    status,
  }: EntityStatusConfirmationPayload) => (
    <MetaAdsEntityStatusToggleCell
      key="adStatus"
      entityLevel={entityLevel}
      entityId={entityId}
      entityName={entityName}
      status={status}
      stickyCellClassName={context.stickyCellClassName}
      canUseMetaAdsActions={context.canUseMetaAdsActions}
      updating={context.updatingEntityStatus}
      localize={context.localize}
      onOpenConfirmation={context.onOpenEntityStatusConfirmation}
    />
  );

  const renderCampaignCell = (
    column: TableColumn,
    campaign: ProjectMetaAdsCampaignSummary,
    recommendation: ProjectMetaAdsRecommendation | undefined,
  ) => {
    if (column.key === 'level') {
      return (
        <MetaAdsLevelCell
          key={column.key}
          column={column}
          labelKey="com_ui_project_meta_ads_level_campaign"
          localize={context.localize}
        />
      );
    }
    if (column.key === 'adStatus') {
      return renderEntityStatus({
        entityLevel: 'campaign',
        entityId: campaign.campaignId,
        entityName: campaign.campaignName,
        status: campaign.status,
      });
    }
    if (column.key === 'name') {
      return (
        <MetaAdsCampaignNameCell
          key={column.key}
          campaign={campaign}
          stickyCellClassName={context.stickyCellClassName}
        />
      );
    }
    if (column.key === 'budget') {
      const editBudget = () =>
        context.onOpenBudgetEditor({
          entityLevel: 'campaign',
          entityId: campaign.campaignId,
          entityName: campaign.campaignName,
          currentBudget:
            context.getManualBudgetDraft('campaign', campaign.campaignId)?.dailyBudget ??
            campaign.dailyBudget,
        });
      const onClick = campaign.editableBudgetLevel === 'campaign' ? editBudget : undefined;
      const pendingBudget = context.getManualBudgetDraft('campaign', campaign.campaignId);
      return metricCell(
        column,
        <MetaAdsBudgetBadge
          value={campaign.dailyBudget}
          pendingValue={pendingBudget?.dailyBudget}
          currency={context.currency}
          canUseMetaAdsActions={context.canUseMetaAdsActions}
          localize={context.localize}
          onClick={onClick}
        />,
      );
    }

    const metric = sharedCampaignMetricCell({
      column,
      campaign,
      valueSource: campaign,
      currency: context.currency,
      localize: context.localize,
    });
    if (metric) {
      return metric;
    }
    if (column.key === 'rule') {
      return textCell(column, context.getEntityRuleLabel('campaign', campaign.campaignId));
    }
    if (column.key === 'recommendation') {
      return recommendationCell({ column, recommendation, currency: context.currency });
    }
    return actionCell({
      column,
      recommendation,
      context,
      duplicate: {
        entityLevel: 'campaign',
        entityId: campaign.campaignId,
        entityName: campaign.campaignName,
        targetName: context.getDuplicateName(campaign.campaignName ?? campaign.campaignId),
        status: campaign.status,
        budget: campaign.dailyBudget,
      },
    });
  };

  const renderAdSetCell = (
    column: TableColumn,
    campaign: ProjectMetaAdsCampaignSummary,
    adset: ProjectMetaAdsCampaignSummary['adSets'][number],
    recommendation: ProjectMetaAdsRecommendation | undefined,
  ) => {
    if (column.key === 'level') {
      return (
        <MetaAdsLevelCell
          key={column.key}
          column={column}
          labelKey="com_ui_project_meta_ads_level_ad_set"
          localize={context.localize}
        />
      );
    }
    if (column.key === 'adStatus') {
      return renderEntityStatus({
        entityLevel: 'adset',
        entityId: adset.entityId,
        entityName: adset.entityName,
        status: adset.status,
      });
    }
    if (column.key === 'name') {
      return (
        <MetaAdsAdSetNameCell
          key={column.key}
          adset={adset}
          stickyCellClassName={context.stickyCellClassName}
        />
      );
    }
    if (column.key === 'budget') {
      const editBudget = () =>
        context.onOpenBudgetEditor({
          entityLevel: 'adset',
          entityId: adset.entityId,
          entityName: adset.entityName,
          currentBudget:
            context.getManualBudgetDraft('adset', adset.entityId)?.dailyBudget ??
            adset.dailyBudget,
        });
      const onClick = campaign.editableBudgetLevel === 'adset' ? editBudget : undefined;
      const pendingBudget = context.getManualBudgetDraft('adset', adset.entityId);
      return metricCell(
        column,
        <MetaAdsBudgetBadge
          value={adset.dailyBudget}
          pendingValue={pendingBudget?.dailyBudget}
          currency={context.currency}
          canUseMetaAdsActions={context.canUseMetaAdsActions}
          localize={context.localize}
          onClick={onClick}
        />,
      );
    }

    const metric = sharedCampaignMetricCell({
      column,
      campaign,
      valueSource: adset,
      currency: context.currency,
      localize: context.localize,
    });
    if (metric) {
      return metric;
    }
    if (column.key === 'rule') {
      return textCell(column, context.getEntityRuleLabel('adset', adset.entityId));
    }
    if (column.key === 'recommendation') {
      return recommendationCell({ column, recommendation, currency: context.currency });
    }
    return actionCell({
      column,
      recommendation,
      context,
      duplicate: {
        entityLevel: 'adset',
        entityId: adset.entityId,
        entityName: adset.entityName,
        targetName: context.getDuplicateName(adset.entityName ?? adset.entityId),
        status: adset.status,
        budget: adset.dailyBudget,
      },
    });
  };

  const { renderAdRow } = createMetaAdsAdRenderers(context);

  return { renderCampaignCell, renderAdSetCell, renderAdRow };
}
