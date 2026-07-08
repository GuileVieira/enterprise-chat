import { useCallback, useState } from 'react';
import type { ProjectMetaAdsCampaignSummary } from 'librechat-data-provider';

export function getMetaAdsSelectableEntityIds(campaigns: ProjectMetaAdsCampaignSummary[]) {
  return campaigns.flatMap((campaign) => [
    `campaign:${campaign.campaignId}`,
    ...campaign.adSets.map((adset) => `adset:${adset.entityId}`),
  ]);
}

export function useMetaAdsSelection() {
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

  const onToggleCampaign = useCallback((campaign: ProjectMetaAdsCampaignSummary) => {
    setSelectedEntityIds((current) => {
      const campaignIds = getMetaAdsSelectableEntityIds([campaign]);
      if (current.includes(`campaign:${campaign.campaignId}`)) {
        return current.filter((selectedId) => !campaignIds.includes(selectedId));
      }
      const next = new Set(current);
      campaignIds.forEach((selectedId) => next.add(selectedId));
      return Array.from(next);
    });
  }, []);

  const onToggleAdSet = useCallback((entityId: string) => {
    setSelectedEntityIds((current) => {
      const id = `adset:${entityId}`;
      return current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id];
    });
  }, []);

  const onToggleVisibleSelection = useCallback((campaigns: ProjectMetaAdsCampaignSummary[]) => {
    setSelectedEntityIds((current) => {
      const visibleIds = getMetaAdsSelectableEntityIds(campaigns);
      const currentIds = new Set(current);
      const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((selectedId) => currentIds.has(selectedId));
      if (allVisibleSelected) {
        const visibleIdSet = new Set(visibleIds);
        return current.filter((selectedId) => !visibleIdSet.has(selectedId));
      }
      const next = new Set(currentIds);
      visibleIds.forEach((selectedId) => next.add(selectedId));
      return Array.from(next);
    });
  }, []);

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
    onToggleVisibleSelection,
    onToggleCampaignExpanded,
    onToggleAdSetAds,
    expandAllRows,
    collapseAllRows,
  };
}
