import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  TProject,
  TStartupConfig,
  ProjectMetaAdsSnapshot,
  ProjectMetaAdsBudgetChange,
  ProjectMetaAdsRecommendation,
  ProjectMetaAdsCampaignSummary,
  ProjectTrafficDiaryEntry,
} from 'librechat-data-provider';

import { createMetaAdsBriefStorageKey } from '../helpers';
import { buildMetaAdsChatBrief, MAX_META_ADS_CHAT_BRIEF_ENTITIES } from '../../metaAdsChatBrief';
import { buildTrafficDiaryAnalysisBrief } from '../trafficDiaryBrief';

type StartupConfigQuery = {
  data?: TStartupConfig;
};

type MetaAdsStatusData = {
  recommendations: ProjectMetaAdsRecommendation[];
  changes: ProjectMetaAdsBudgetChange[];
};

type UseMetaAdsTrafficAgentInput = {
  project: TProject;
  startupConfigQuery: StartupConfigQuery;
  statusData?: MetaAdsStatusData;
  latestSnapshots: ProjectMetaAdsSnapshot[];
  campaigns: ProjectMetaAdsCampaignSummary[];
  selectedEntityIds: string[];
  selectedCount: number;
};

export function useMetaAdsTrafficAgent({
  project,
  startupConfigQuery,
  statusData,
  latestSnapshots,
  campaigns,
  selectedEntityIds,
  selectedCount,
}: UseMetaAdsTrafficAgentInput) {
  const navigate = useNavigate();
  const canOpenTrafficAgentChat =
    selectedCount > 0 && selectedCount <= MAX_META_ADS_CHAT_BRIEF_ENTITIES;

  const onOpenTrafficAgentChat = useCallback(() => {
    if (!canOpenTrafficAgentChat || !statusData) {
      return;
    }

    const brief = buildMetaAdsChatBrief({
      project,
      snapshots: latestSnapshots,
      campaigns,
      recommendations: statusData.recommendations,
      changes: statusData.changes,
      selectedEntityIds,
    });
    const storageKey = createMetaAdsBriefStorageKey();
    sessionStorage.setItem(storageKey, JSON.stringify(brief));

    const params = new URLSearchParams({
      project_id: project.projectId,
      meta_ads_brief: storageKey,
    });
    const trafficAgentId = startupConfigQuery.data?.interface?.metaAdsTrafficAgentId;
    if (trafficAgentId) {
      params.set('agent_id', trafficAgentId);
    }
    navigate(`/c/new?${params.toString()}`);
  }, [
    project,
    campaigns,
    navigate,
    statusData,
    latestSnapshots,
    selectedEntityIds,
    startupConfigQuery.data?.interface?.metaAdsTrafficAgentId,
    canOpenTrafficAgentChat,
  ]);

  const onOpenTrafficDiaryAnalysis = useCallback(
    (entry: ProjectTrafficDiaryEntry) => {
      const markdown = buildTrafficDiaryAnalysisBrief({ entry, projectName: project.name });
      const storageKey = createMetaAdsBriefStorageKey();
      sessionStorage.setItem(storageKey, JSON.stringify({ markdown }));
      const params = new URLSearchParams({
        project_id: project.projectId,
        meta_ads_brief: storageKey,
        new_conversation: 'true',
      });
      const trafficAgentId = startupConfigQuery.data?.interface?.metaAdsTrafficAgentId;
      if (trafficAgentId) {
        params.set('agent_id', trafficAgentId);
      }
      navigate(`/c/new?${params.toString()}`);
    },
    [
      navigate,
      project.name,
      project.projectId,
      startupConfigQuery.data?.interface?.metaAdsTrafficAgentId,
    ],
  );

  return { canOpenTrafficAgentChat, onOpenTrafficAgentChat, onOpenTrafficDiaryAnalysis };
}
