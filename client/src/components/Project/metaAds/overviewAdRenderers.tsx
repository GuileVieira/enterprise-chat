import type { ReactNode } from 'react';
import type {
  ProjectMetaAdsAdSummary,
  ProjectMetaAdsCampaignSummary,
} from 'librechat-data-provider';

import {
  MetaAdsAdNameCell,
  MetaAdsEmptyCell,
  MetaAdsLevelCell,
  MetaAdsFrequencyValue,
  MetaAdsEntityStatusToggleCell,
} from './overviewCells';
import { formatMetric, formatMoney, getObjectiveLabel, getResultTypeLabel } from './formatters';
import type { TableColumn } from './types';
import type { OverviewRendererContext } from './overviewRendererTypes';

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

function renderAdCell({
  column,
  campaign,
  ad,
  context,
}: {
  column: TableColumn;
  campaign: ProjectMetaAdsCampaignSummary;
  ad: ProjectMetaAdsAdSummary;
  context: OverviewRendererContext;
}) {
  if (column.key === 'level') {
    return (
      <MetaAdsLevelCell
        key={column.key}
        column={column}
        labelKey="com_ui_project_meta_ads_level_ad"
        localize={context.localize}
      />
    );
  }
  if (column.key === 'adStatus') {
    return (
      <MetaAdsEntityStatusToggleCell
        key={column.key}
        entityLevel="ad"
        entityId={ad.adId}
        entityName={ad.adName ?? ad.title}
        status={ad.status}
        stickyCellClassName={context.stickyCellClassName}
        canUseMetaAdsActions={context.canUseMetaAdsActions}
        updating={context.updatingEntityStatus}
        localize={context.localize}
        onOpenConfirmation={context.onOpenEntityStatusConfirmation}
      />
    );
  }
  if (column.key === 'name') {
    return (
      <MetaAdsAdNameCell
        key={column.key}
        ad={ad}
        stickyCellClassName={context.stickyCellClassName}
        localize={context.localize}
        onPreview={context.onPreviewAd}
      />
    );
  }
  if (column.key === 'objective') {
    return textCell(column, getObjectiveLabel(campaign.objective, context.localize));
  }
  if (column.key === 'budgetMode') {
    return textCell(column, campaign.budgetMode ?? '-');
  }
  if (column.key === 'frequency') {
    return metricCell(column, <MetaAdsFrequencyValue source={ad} localize={context.localize} />);
  }
  if (column.key === 'result') {
    return metricCell(column, formatMetric(ad.resultCount));
  }
  if (column.key === 'resultType') {
    return textCell(column, getResultTypeLabel(ad.resultType, context.localize));
  }
  if (column.key === 'cpa') {
    return metricCell(column, formatMoney(ad.cpa, ad.currency ?? context.currency));
  }
  if (column.key === 'roas') {
    return metricCell(column, formatMetric(ad.roas));
  }
  if (column.key === 'spend') {
    return metricCell(column, formatMoney(ad.spend, ad.currency ?? context.currency));
  }
  if (column.key === 'ctr') {
    return metricCell(column, formatMetric(ad.ctr));
  }
  if (column.key === 'clicks') {
    return metricCell(column, formatMetric(ad.clicks));
  }
  return <MetaAdsEmptyCell key={column.key} column={column} />;
}

export function createMetaAdsAdRenderers(context: OverviewRendererContext) {
  return {
    renderAdRow: (
      campaign: ProjectMetaAdsCampaignSummary,
      ad: ProjectMetaAdsAdSummary,
      rowIndex: number,
    ) => (
      <tr
        key={ad.adId}
        data-testid={`meta-ads-ad-card-${ad.adId}`}
        onClick={() => context.onPreviewAd(ad)}
        className={`group ${context.getTableRowClass(rowIndex, 'ad', true)}`}
      >
        <td
          className={`sticky left-0 z-30 px-2 py-2 pl-10 align-middle ${context.stickyCellClassName}`}
        />
        <td className={`sticky left-10 z-30 px-2 py-2 align-middle ${context.stickyCellClassName}`}>
          <span aria-hidden="true" className="block h-7 w-7" />
        </td>
        {context.columns.map((column) => renderAdCell({ column, campaign, ad, context }))}
      </tr>
    ),
  };
}
