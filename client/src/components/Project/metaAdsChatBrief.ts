import type {
  ProjectMetaAdsBudgetChange,
  ProjectMetaAdsRecommendation,
  ProjectMetaAdsSnapshot,
  TProject,
} from 'librechat-data-provider';

export const MAX_META_ADS_CHAT_BRIEF_ENTITIES = 10;

type MetaAdsRules = NonNullable<NonNullable<TProject['metaAds']>['rules']>;

export type MetaAdsChatBriefEntity = {
  entityId: string;
  entityName?: string;
  dailyBudget?: number;
  spend?: number;
  cpa?: number | null;
  roas?: number | null;
  resultCount?: number;
  resultType?: string;
  snapshotAt?: string;
  latestRecommendation?: Pick<
    ProjectMetaAdsRecommendation,
    | 'action'
    | 'status'
    | 'currentDailyBudget'
    | 'proposedDailyBudget'
    | 'spend'
    | 'cpa'
    | 'roas'
    | 'reason'
    | 'createdAt'
  >;
  latestBudgetChange?: Pick<
    ProjectMetaAdsBudgetChange,
    'previousDailyBudget' | 'newDailyBudget' | 'actor' | 'reason' | 'createdAt'
  >;
  missingData: string[];
};

export type MetaAdsChatBrief = {
  source: 'meta_ads';
  projectId: string;
  projectName: string;
  generatedAt: string;
  selectedEntityCount: number;
  omittedEntityCount: number;
  rules: MetaAdsRules;
  entities: MetaAdsChatBriefEntity[];
  markdown: string;
};

type BuildMetaAdsChatBriefParams = {
  project: TProject;
  snapshots: ProjectMetaAdsSnapshot[];
  recommendations: ProjectMetaAdsRecommendation[];
  changes: ProjectMetaAdsBudgetChange[];
  selectedEntityIds: string[];
  generatedAt?: string;
};

function latestByEntity<T extends { entityId: string; createdAt?: string }>(items: T[]) {
  const latest = new Map<string, T>();
  for (const item of items) {
    const current = latest.get(item.entityId);
    if (!current || (item.createdAt ?? '') > (current.createdAt ?? '')) {
      latest.set(item.entityId, item);
    }
  }
  return latest;
}

function getMissingData(snapshot: ProjectMetaAdsSnapshot) {
  const missing: string[] = [];
  if (snapshot.spend == null) {
    missing.push('spend');
  }
  if (snapshot.cpa == null) {
    missing.push('cpa');
  }
  if (snapshot.roas == null) {
    missing.push('roas');
  }
  if (snapshot.resultCount == null) {
    missing.push('resultCount');
  }
  return missing;
}

function toBriefEntity({
  snapshot,
  recommendation,
  change,
}: {
  snapshot: ProjectMetaAdsSnapshot;
  recommendation?: ProjectMetaAdsRecommendation;
  change?: ProjectMetaAdsBudgetChange;
}): MetaAdsChatBriefEntity {
  return {
    entityId: snapshot.entityId,
    entityName: snapshot.entityName,
    dailyBudget: snapshot.dailyBudget,
    spend: snapshot.spend,
    cpa: snapshot.cpa,
    roas: snapshot.roas,
    resultCount: snapshot.resultCount,
    resultType: snapshot.resultType,
    snapshotAt: snapshot.createdAt,
    latestRecommendation: recommendation
      ? {
          action: recommendation.action,
          status: recommendation.status,
          currentDailyBudget: recommendation.currentDailyBudget,
          proposedDailyBudget: recommendation.proposedDailyBudget,
          spend: recommendation.spend,
          cpa: recommendation.cpa,
          roas: recommendation.roas,
          reason: recommendation.reason,
          createdAt: recommendation.createdAt,
        }
      : undefined,
    latestBudgetChange: change
      ? {
          previousDailyBudget: change.previousDailyBudget,
          newDailyBudget: change.newDailyBudget,
          actor: change.actor,
          reason: change.reason,
          createdAt: change.createdAt,
        }
      : undefined,
    missingData: getMissingData(snapshot),
  };
}

function buildMarkdown(brief: Omit<MetaAdsChatBrief, 'markdown'>) {
  const lines = [
    `Quero analisar os conjuntos selecionados de Meta Ads do projeto "${brief.projectName}".`,
    '',
    'Responda como agente de tráfego. Use apenas os dados abaixo, cite os números principais e diga próximos passos práticos.',
    '',
    `Conjuntos selecionados: ${brief.selectedEntityCount}`,
  ];

  if (brief.omittedEntityCount > 0) {
    lines.push(
      `${brief.omittedEntityCount} selected ad sets were omitted because the limit is ${MAX_META_ADS_CHAT_BRIEF_ENTITIES}.`,
    );
  }

  lines.push('', '```json', JSON.stringify(brief, null, 2), '```');
  return lines.join('\n');
}

export function buildMetaAdsChatBrief({
  project,
  snapshots,
  recommendations,
  changes,
  selectedEntityIds,
  generatedAt = new Date().toISOString(),
}: BuildMetaAdsChatBriefParams): MetaAdsChatBrief {
  const selectedSet = new Set(selectedEntityIds.slice(0, MAX_META_ADS_CHAT_BRIEF_ENTITIES));
  const recommendationByEntity = latestByEntity(recommendations);
  const changeByEntity = latestByEntity(changes);
  const entities = snapshots
    .filter((snapshot) => selectedSet.has(snapshot.entityId))
    .map((snapshot) =>
      toBriefEntity({
        snapshot,
        recommendation: recommendationByEntity.get(snapshot.entityId),
        change: changeByEntity.get(snapshot.entityId),
      }),
    );
  const briefWithoutMarkdown = {
    source: 'meta_ads' as const,
    projectId: project.projectId,
    projectName: project.name,
    generatedAt,
    selectedEntityCount: entities.length,
    omittedEntityCount: Math.max(0, selectedEntityIds.length - MAX_META_ADS_CHAT_BRIEF_ENTITIES),
    rules: project.metaAds?.rules ?? {},
    entities,
  };

  return {
    ...briefWithoutMarkdown,
    markdown: buildMarkdown(briefWithoutMarkdown),
  };
}
