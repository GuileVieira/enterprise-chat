import { Fragment } from 'react';
import type { ReactNode } from 'react';

import type {
  ProjectMetaAdsAdSummary,
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsRecommendation,
} from 'librechat-data-provider';
import type { Localize, TableColumn } from './types';

type OverviewRowsProps = {
  columns: TableColumn[];
  campaigns: ProjectMetaAdsCampaignSummary[];
  selectedEntityIds: string[];
  expandedCampaignIds: string[];
  collapsedAboCampaignIds: string[];
  collapsedAdSetAdsIds: string[];
  stickyCellClassName: string;
  localize: Localize;
  onToggleCampaign: (campaign: ProjectMetaAdsCampaignSummary) => void;
  onToggleCampaignExpanded: (campaign: ProjectMetaAdsCampaignSummary) => void;
  onToggleAdSet: (entityId: string) => void;
  onToggleAdSetAds: (entityId: string) => void;
  getTableRowClass: (
    rowIndex: number,
    rowType: 'campaign' | 'adset' | 'ad',
    clickable?: boolean,
  ) => string;
  getEntityRecommendation: (entityId: string) => ProjectMetaAdsRecommendation | undefined;
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

function getCampaignExpanded({
  campaign,
  expandedCampaignIds,
  collapsedAboCampaignIds,
}: {
  campaign: ProjectMetaAdsCampaignSummary;
  expandedCampaignIds: string[];
  collapsedAboCampaignIds: string[];
}) {
  if (campaign.budgetMode === 'ABO') {
    return !collapsedAboCampaignIds.includes(campaign.campaignId);
  }
  return expandedCampaignIds.includes(campaign.campaignId);
}

export function renderOverviewRows({
  columns,
  campaigns,
  selectedEntityIds,
  expandedCampaignIds,
  collapsedAboCampaignIds,
  collapsedAdSetAdsIds,
  stickyCellClassName,
  localize,
  onToggleCampaign,
  onToggleCampaignExpanded,
  onToggleAdSet,
  onToggleAdSetAds,
  getTableRowClass,
  getEntityRecommendation,
  renderCampaignCell,
  renderAdSetCell,
  renderAdRow,
}: OverviewRowsProps) {
  let rowIndex = 0;
  return campaigns.map((campaign) => {
    const expanded = getCampaignExpanded({
      campaign,
      expandedCampaignIds,
      collapsedAboCampaignIds,
    });
    const selected = selectedEntityIds.includes(`campaign:${campaign.campaignId}`);
    const recommendation = getEntityRecommendation(campaign.campaignId);
    const campaignRowIndex = rowIndex;
    rowIndex += 1;

    return (
      <Fragment key={campaign.campaignId}>
        <tr
          data-testid="meta-ads-campaign-row"
          className={getTableRowClass(campaignRowIndex, 'campaign')}
        >
          <td className={`sticky left-0 z-30 px-2 py-2 align-middle ${stickyCellClassName}`}>
            <input
              type="checkbox"
              checked={selected}
              aria-label={localize('com_ui_project_meta_ads_select_campaign')}
              onChange={() => onToggleCampaign(campaign)}
              className="h-4 w-4 border-border-light bg-surface-primary text-text-primary"
            />
          </td>
          <td className={`sticky left-10 z-30 px-2 py-2 align-middle ${stickyCellClassName}`}>
            {campaign.adSets.length > 0 && (
              <button
                type="button"
                aria-label={localize('com_ui_project_meta_ads_expand_campaign')}
                aria-expanded={expanded}
                onClick={() => onToggleCampaignExpanded(campaign)}
                className="h-6 w-6 border border-border-light bg-surface-primary font-mono text-xs leading-none text-text-secondary"
              >
                {expanded ? '-' : '+'}
              </button>
            )}
          </td>
          {columns.map((column) => renderCampaignCell(column, campaign, recommendation))}
        </tr>
        {expanded &&
          campaign.adSets.map((adset) => {
            const adsetSelected = selectedEntityIds.includes(`adset:${adset.entityId}`);
            const adsetRecommendation = getEntityRecommendation(adset.entityId);
            const adsetAds = adset.ads ?? [];
            const adsCollapsed = collapsedAdSetAdsIds.includes(adset.entityId);
            const adsetRowIndex = rowIndex;
            rowIndex += 1;

            return (
              <Fragment key={adset.entityId}>
                <tr
                  data-testid="meta-ads-adset-row"
                  className={getTableRowClass(adsetRowIndex, 'adset')}
                >
                  <td
                    className={`sticky left-0 z-30 px-2 py-2 pl-6 align-middle ${stickyCellClassName}`}
                  >
                    <input
                      type="checkbox"
                      checked={adsetSelected}
                      aria-label={localize('com_ui_project_meta_ads_select_ad_set')}
                      onChange={() => onToggleAdSet(adset.entityId)}
                      className="h-4 w-4 border-border-light bg-surface-primary text-text-primary"
                    />
                  </td>
                  <td
                    className={`sticky left-10 z-30 px-2 py-2 align-middle ${stickyCellClassName}`}
                  >
                    {adsetAds.length > 0 ? (
                      <button
                        type="button"
                        aria-expanded={!adsCollapsed}
                        aria-label={localize(
                          adsCollapsed
                            ? 'com_ui_project_meta_ads_show_ads'
                            : 'com_ui_project_meta_ads_hide_ads',
                        )}
                        onClick={() => onToggleAdSetAds(adset.entityId)}
                        className="h-6 w-6 border border-border-light bg-surface-primary font-mono text-xs leading-none text-text-secondary"
                      >
                        {adsCollapsed ? '+' : '-'}
                      </button>
                    ) : (
                      <span aria-hidden="true" className="block h-7 w-7" />
                    )}
                  </td>
                  {columns.map((column) =>
                    renderAdSetCell(column, campaign, adset, adsetRecommendation),
                  )}
                </tr>
                {!adsCollapsed &&
                  adsetAds.map((ad) => {
                    const adRowIndex = rowIndex;
                    rowIndex += 1;
                    return renderAdRow(campaign, ad, adRowIndex);
                  })}
              </Fragment>
            );
          })}
      </Fragment>
    );
  });
}
