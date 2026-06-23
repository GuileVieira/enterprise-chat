import { useCallback, useState } from 'react';
import type { ProjectMetaAdsCampaignSummary } from 'librechat-data-provider';

type UseMetaAdsSelectionInput = {
  maxSelectedEntities: number;
};

export function useMetaAdsSelection({ maxSelectedEntities }: UseMetaAdsSelectionInput) {
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<string[]>([]);
  const [collapsedAboCampaignIds, setCollapsedAboCampaignIds] = useState<string[]>([]);
  const [collapsedAdSetAdsIds, setCollapsedAdSetAdsIds] = useState<string[]>([]);

  const selectedCampaignIds = selectedEntityIds
    .filter((id) => id.startsWith('campaign:'))
    .map((id) => id.replace('campaign:', ''));
  const selectedAdSetIds = selectedEntityIds
    .filter((id) => id.startsWith('adset:'))
    .map((id) => id.replace('adset:', ''));

  const clearSelection = useCallback(() => {
    setSelectedEntityIds([]);
  }, []);

  const onToggleCampaign = useCallback(
    (campaign: ProjectMetaAdsCampaignSummary) => {
      setSelectedEntityIds((current) => {
        const campaignId = `campaign:${campaign.campaignId}`;
        const adSetIds = campaign.adSets.map((adset) => `adset:${adset.entityId}`);
        const campaignIds = [campaignId, ...adSetIds];
        if (current.includes(campaignId)) {
          return current.filter((selectedId) => !campaignIds.includes(selectedId));
        }
        const next = new Set(current);
        campaignIds.forEach((selectedId) => next.add(selectedId));
        return Array.from(next).slice(0, maxSelectedEntities);
      });
    },
    [maxSelectedEntities],
  );

  const onToggleAdSet = useCallback(
    (entityId: string) => {
      setSelectedEntityIds((current) => {
        const id = `adset:${entityId}`;
        return current.includes(id)
          ? current.filter((selectedId) => selectedId !== id)
          : [...current, id].slice(0, maxSelectedEntities);
      });
    },
    [maxSelectedEntities],
  );

  const onToggleCampaignExpanded = useCallback((campaign: ProjectMetaAdsCampaignSummary) => {
    if (campaign.budgetMode === 'ABO') {
      setCollapsedAboCampaignIds((current) =>
        current.includes(campaign.campaignId)
          ? current.filter((id) => id !== campaign.campaignId)
          : [...current, campaign.campaignId],
      );
      return;
    }

    setExpandedCampaignIds((current) =>
      current.includes(campaign.campaignId)
        ? current.filter((id) => id !== campaign.campaignId)
        : [...current, campaign.campaignId],
    );
  }, []);

  const onToggleAdSetAds = useCallback((adSetId: string) => {
    setCollapsedAdSetAdsIds((current) =>
      current.includes(adSetId) ? current.filter((id) => id !== adSetId) : [...current, adSetId],
    );
  }, []);

  const expandAllRows = useCallback((campaigns: ProjectMetaAdsCampaignSummary[]) => {
    setCollapsedAboCampaignIds([]);
    setExpandedCampaignIds(
      campaigns
        .filter((campaign) => campaign.budgetMode !== 'ABO')
        .map((campaign) => campaign.campaignId),
    );
    setCollapsedAdSetAdsIds([]);
  }, []);

  const collapseAllRows = useCallback((campaigns: ProjectMetaAdsCampaignSummary[]) => {
    setCollapsedAboCampaignIds(
      campaigns
        .filter((campaign) => campaign.budgetMode === 'ABO')
        .map((campaign) => campaign.campaignId),
    );
    setExpandedCampaignIds([]);
    setCollapsedAdSetAdsIds(
      campaigns.flatMap((campaign) => campaign.adSets.map((adset) => adset.entityId)),
    );
  }, []);

  return {
    selectedEntityIds,
    expandedCampaignIds,
    collapsedAboCampaignIds,
    collapsedAdSetAdsIds,
    selectedCampaignIds,
    selectedAdSetIds,
    selectedCount: selectedEntityIds.length,
    clearSelection,
    onToggleCampaign,
    onToggleAdSet,
    onToggleCampaignExpanded,
    onToggleAdSetAds,
    expandAllRows,
    collapseAllRows,
  };
}
