import type {
  ProjectMetaAdsBudgetChange,
  ProjectMetaAdsRecommendation,
  ProjectMetaAdsSnapshot,
  TProject,
} from 'librechat-data-provider';
import { buildMetaAdsChatBrief, MAX_META_ADS_CHAT_BRIEF_ENTITIES } from './metaAdsChatBrief';

const project = {
  projectId: 'p1',
  name: 'Growth Project',
  metaAds: {
    rules: {
      targetCpa: 45,
      minRoas: 2,
    },
  },
} as TProject;

const snapshots: ProjectMetaAdsSnapshot[] = [
  {
    _id: 's1',
    entityId: 'adset-1',
    entityName: 'Prospecting',
    dailyBudget: 100,
    spend: 230,
    cpa: 38,
    roas: 3.1,
    resultCount: 6,
    resultType: 'purchase',
    createdAt: '2026-06-03T12:00:00.000Z',
  },
  {
    _id: 's2',
    entityId: 'adset-2',
    entityName: 'Retargeting',
    dailyBudget: 50,
    spend: 80,
    cpa: null,
    roas: null,
    createdAt: '2026-06-03T12:05:00.000Z',
  },
];

const recommendations: ProjectMetaAdsRecommendation[] = [
  {
    _id: 'r1',
    entityId: 'adset-1',
    entityName: 'Prospecting',
    action: 'increase',
    status: 'pending',
    currentDailyBudget: 100,
    proposedDailyBudget: 115,
    reason: 'CPA below target and ROAS above minimum.',
    createdAt: '2026-06-03T12:10:00.000Z',
  },
];

const changes: ProjectMetaAdsBudgetChange[] = [
  {
    _id: 'c1',
    entityId: 'adset-1',
    entityName: 'Prospecting',
    previousDailyBudget: 90,
    newDailyBudget: 100,
    actor: 'user',
    reason: 'Manual increase',
    createdAt: '2026-06-03T10:00:00.000Z',
  },
];

describe('buildMetaAdsChatBrief', () => {
  it('builds a bounded brief with selected metrics, recommendations, changes, and rules', () => {
    const brief = buildMetaAdsChatBrief({
      project,
      snapshots,
      recommendations,
      changes,
      selectedEntityIds: ['adset-1', 'adset-2'],
      generatedAt: '2026-06-03T12:30:00.000Z',
    });

    expect(brief.projectId).toBe('p1');
    expect(brief.projectName).toBe('Growth Project');
    expect(brief.entities).toHaveLength(2);
    expect(brief.entities[0]).toEqual(
      expect.objectContaining({
        entityId: 'adset-1',
        entityName: 'Prospecting',
        spend: 230,
        cpa: 38,
        roas: 3.1,
        latestRecommendation: expect.objectContaining({
          action: 'increase',
          proposedDailyBudget: 115,
        }),
        latestBudgetChange: expect.objectContaining({
          previousDailyBudget: 90,
          newDailyBudget: 100,
        }),
      }),
    );
    expect(brief.rules).toEqual(expect.objectContaining({ targetCpa: 45, minRoas: 2 }));
    expect(brief.markdown).toContain('Growth Project');
    expect(brief.markdown).toContain('Prospecting');
    expect(brief.markdown).toContain('"entityId": "adset-1"');
    expect(brief.markdown).not.toContain('"raw"');
  });

  it('caps selected entities to avoid oversized chat drafts', () => {
    const manySnapshots = Array.from({ length: MAX_META_ADS_CHAT_BRIEF_ENTITIES + 2 }, (_, i) => ({
      entityId: `adset-${i}`,
      entityName: `Ad set ${i}`,
    }));

    const brief = buildMetaAdsChatBrief({
      project,
      snapshots: manySnapshots,
      recommendations: [],
      changes: [],
      selectedEntityIds: manySnapshots.map((item) => item.entityId),
      generatedAt: '2026-06-03T12:30:00.000Z',
    });

    expect(brief.entities).toHaveLength(MAX_META_ADS_CHAT_BRIEF_ENTITIES);
    expect(brief.omittedEntityCount).toBe(2);
    expect(brief.markdown).toContain('2 selected ad sets were omitted');
  });

  it('builds a campaign-aware brief when grouped campaigns are available', () => {
    const brief = buildMetaAdsChatBrief({
      project,
      snapshots,
      campaigns: [
        {
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          objective: 'OUTCOME_ENGAGEMENT',
          spend: 230,
          cpa: 38,
          resultCount: 6,
          resultType: 'onsite_conversion.messaging_conversation_started_7d',
          adSets: [
            {
              entityId: 'adset-1',
              entityName: 'Topo',
              campaignId: 'campaign-1',
              campaignName: 'Messages Floripa',
              dailyBudget: 100,
              spend: 230,
              cpa: 38,
              roas: 3.1,
              resultCount: 6,
              resultType: 'onsite_conversion.messaging_conversation_started_7d',
              snapshotAt: '2026-06-03T12:00:00.000Z',
            },
          ],
        },
      ],
      recommendations,
      changes,
      selectedEntityIds: ['campaign:campaign-1', 'adset:adset-1'],
      generatedAt: '2026-06-03T12:30:00.000Z',
    });

    expect(brief.campaigns).toEqual([
      expect.objectContaining({
        campaignId: 'campaign-1',
        campaignName: 'Messages Floripa',
        adSets: [expect.objectContaining({ entityId: 'adset-1' })],
      }),
    ]);
    expect(brief.markdown).toContain('campanhas/conjuntos selecionados');
    expect(brief.markdown).toContain('"campaignId": "campaign-1"');
  });
});
