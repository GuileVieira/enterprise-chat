import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  ProjectMetaAdsRankingResponse,
  ProjectMetaAdsStatus,
  TProject,
} from 'librechat-data-provider';
import English from '~/locales/en/translation.json';
import PortugueseBrazil from '~/locales/pt-BR/translation.json';
import ProjectMetaAdsPanel from '../ProjectMetaAdsPanel';

const mockMutateSettings = jest.fn((_payload: unknown, options?: { onSuccess?: () => void }) =>
  options?.onSuccess?.(),
);
const mockMutateTenantToken = jest.fn((_payload: unknown, options?: { onSuccess?: () => void }) =>
  options?.onSuccess?.(),
);
const mockMutateRun = jest.fn();
const mockMutateApply = jest.fn();
const mockMutateBudget = jest.fn();
const mockMutateDuplicate = jest.fn();
const mockMutateEntityStatus = jest.fn();
const mockNavigate = jest.fn();
const mockRefetchStatus = jest.fn();
const mockShowToast = jest.fn();
let mockStatusQueryState = {};
let mockRankingQueryState = {};
let mockUserRole = 'USER';
const mockUseProjectMetaAdsQuery = jest.fn((_projectId?: string, _params?: unknown) => ({
  data: mockStatusData,
  refetch: mockRefetchStatus,
  ...mockStatusQueryState,
}));
const mockUseProjectMetaAdsRankingsQuery = jest.fn((_projectId?: string, _params?: unknown) => ({
  data: mockRankingData,
  isFetching: false,
  ...mockRankingQueryState,
}));
const mockStatusData: ProjectMetaAdsStatus = {
  latestSnapshots: [],
  recommendations: [],
  changes: [],
  graphVersion: {
    effective: 'v25.0',
    source: 'global',
  },
};
const mockRankingData: ProjectMetaAdsRankingResponse = {
  level: 'campaign',
  period: {
    datePreset: 'last_7d',
  },
  currency: 'BRL',
  items: [],
};
const mockStartupConfig = {
  interface: {
    metaAdsTrafficAgentId: 'traffic-agent-1',
  },
};

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('@librechat/client', () => ({
  OGDialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open === false ? null : <>{children}</>,
  OGDialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div role="dialog" className={className}>
      {children}
    </div>
  ),
  OGDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OGDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  useToastContext: () => ({
    showToast: mockShowToast,
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useAuthContext: () => ({ user: { role: mockUserRole } }),
}));

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({
    data: mockStartupConfig,
  }),
  useProjectMetaAdsQuery: (projectId: string, params?: unknown) =>
    mockUseProjectMetaAdsQuery(projectId, params),
  useProjectMetaAdsRankingsQuery: (projectId: string, params?: unknown) =>
    mockUseProjectMetaAdsRankingsQuery(projectId, params),
  useUpdateProjectMetaAdsMutation: () => ({
    mutate: mockMutateSettings,
    isLoading: false,
  }),
  useUpdateProjectMetaAdsTenantTokenMutation: () => ({
    mutate: mockMutateTenantToken,
    isLoading: false,
  }),
  useRunProjectMetaAdsMutation: () => ({
    mutate: mockMutateRun,
    isLoading: false,
  }),
  useApplyProjectMetaAdsRecommendationMutation: () => ({
    mutate: mockMutateApply,
    isLoading: false,
  }),
  useUpdateProjectMetaAdsBudgetMutation: () => ({
    mutate: mockMutateBudget,
    isLoading: false,
  }),
  useDuplicateProjectMetaAdsEntityMutation: () => ({
    mutate: mockMutateDuplicate,
    isLoading: false,
  }),
  useUpdateProjectMetaAdsEntityStatusMutation: () => ({
    mutate: mockMutateEntityStatus,
    isLoading: false,
  }),
}));

const project = {
  projectId: 'p1',
  name: 'Project',
  user: 'u1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as TProject;

describe('ProjectMetaAdsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockStatusData.latestSnapshots = [];
    mockStatusData.recommendations = [];
    mockStatusData.changes = [];
    mockStatusData.summary = undefined;
    mockStatusQueryState = {};
    mockRankingQueryState = {};
    mockUserRole = 'USER';
    mockUseProjectMetaAdsQuery.mockClear();
    mockUseProjectMetaAdsRankingsQuery.mockClear();
    mockRankingData.level = 'campaign';
    mockRankingData.period = {
      datePreset: 'last_7d',
    };
    mockRankingData.currency = 'BRL';
    mockRankingData.items = [];
    delete mockStatusData.campaigns;
    delete mockStatusData.adDiagnostics;
    delete mockStatusData.credentials;
    delete mockStatusData.trend;
    mockStatusData.graphVersion = {
      effective: 'v25.0',
      source: 'global',
    };
    mockStartupConfig.interface.metaAdsTrafficAgentId = 'traffic-agent-1';
  });

  it('shows a loading indicator while Meta Ads status is being fetched', () => {
    mockStatusQueryState = {
      data: undefined,
      isLoading: true,
      isFetching: true,
    };

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(screen.getByText('com_ui_project_meta_ads_loading')).toBeInTheDocument();
    expect(screen.getAllByTestId('meta-ads-summary-skeleton')).toHaveLength(4);
    expect(screen.getAllByTestId('meta-ads-row-skeleton')).toHaveLength(5);
  });

  it('lets a USER without project edit save Meta Ads project settings and token', async () => {
    mockUserRole = 'USER';
    render(<ProjectMetaAdsPanel project={project} canEdit={false} />);

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_account_credentials'));
    const accountDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_account_credentials',
    });
    const token = `EAA${'a'.repeat(48)}`;
    fireEvent.change(within(accountDialog).getByPlaceholderText('123456789'), {
      target: { value: '123-456-789' },
    });
    fireEvent.click(within(accountDialog).getByText('com_ui_project_meta_ads_manage_tokens'));
    const credentialsDialog = screen.getAllByRole('dialog')[1];
    expect(
      within(credentialsDialog).getAllByPlaceholderText(
        'com_ui_project_meta_ads_token_placeholder',
      ),
    ).toHaveLength(1);
    fireEvent.change(
      within(credentialsDialog).getAllByPlaceholderText(
        'com_ui_project_meta_ads_token_placeholder',
      )[0],
      {
        target: { value: token },
      },
    );
    fireEvent.click(
      within(credentialsDialog).getByText('com_ui_project_meta_ads_save_project_token'),
    );

    expect(mockMutateSettings).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          adAccountId: 'act_123456789',
          tokenSecretName: '',
          credentialMode: 'tenant_default',
          scheduleIntervalMinutes: 180,
        }),
        metaAccessToken: token,
      },
      expect.any(Object),
    );
    const savePayload = mockMutateSettings.mock.calls[0][0] as {
      metaAds: Record<string, unknown>;
    };
    expect(savePayload.metaAds).not.toHaveProperty('metaAccessToken');
    await waitFor(() =>
      expect(
        screen.queryByText('com_ui_project_meta_ads_manage_tokens_hint'),
      ).not.toBeInTheDocument(),
    );
    expect(mockRefetchStatus).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'com_ui_saved',
      status: 'success',
    });
  });

  it('saves a selected schedule interval', () => {
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_automation'));
    const automationDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_automation',
    });
    fireEvent.change(
      within(automationDialog).getByDisplayValue('com_ui_project_meta_ads_schedule_180'),
      {
        target: { value: '30' },
      },
    );
    fireEvent.click(within(automationDialog).getByText('com_ui_save'));

    expect(mockMutateSettings).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          scheduleIntervalMinutes: 30,
        }),
      },
      expect.any(Object),
    );
    expect(mockMutateSettings.mock.calls[0][0]).not.toHaveProperty('metaAccessToken');
  });

  it('discards account edits when closing the settings sidebar', () => {
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_account_credentials'));
    const accountDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_account_credentials',
    });
    fireEvent.change(within(accountDialog).getByPlaceholderText('123456789'), {
      target: { value: '987654321' },
    });
    fireEvent.click(within(accountDialog).getByText('com_ui_cancel'));
    fireEvent.click(screen.getByText('com_ui_save'));

    expect(mockMutateSettings).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          adAccountId: '',
        }),
      },
      expect.any(Object),
    );
  });

  it('saves creative frequency alert rules separately from budget rules', () => {
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getAllByText('com_ui_project_meta_ads_create_rule_group')[0]);
    const ruleDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_global_rules',
    });
    expect(within(ruleDialog).getByLabelText('com_ui_project_meta_ads_max_increase')).toHaveValue(
      25,
    );
    expect(within(ruleDialog).getByLabelText('com_ui_project_meta_ads_max_decrease')).toHaveValue(
      25,
    );
    fireEvent.change(
      within(ruleDialog).getByLabelText('com_ui_project_meta_ads_max_frequency_alert'),
      {
        target: { value: '5.5' },
      },
    );
    fireEvent.click(within(ruleDialog).getByText('com_ui_project_meta_ads_save_rule_group'));

    expect(mockMutateSettings).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          creativeRules: { maxFrequency: 5.5 },
          rules: expect.not.objectContaining({ maxFrequency: expect.anything() }),
        }),
      },
      expect.any(Object),
    );
  });

  it('pre-fills global rules from the ecommerce account profile', () => {
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getAllByText('com_ui_project_meta_ads_create_rule_group')[0]);
    const ruleDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_global_rules',
    });

    fireEvent.change(within(ruleDialog).getByLabelText('com_ui_project_meta_ads_account_profile'), {
      target: { value: 'ecommerce' },
    });

    const selects = within(ruleDialog).getAllByRole('combobox');
    expect(selects[1]).toHaveValue('purchase');
    expect(selects[2]).toHaveValue('roas');

    fireEvent.click(within(ruleDialog).getByText('com_ui_project_meta_ads_save_rule_group'));

    expect(mockMutateSettings).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          accountProfile: 'ecommerce',
          rules: expect.objectContaining({
            targetResultType: 'purchase',
            primaryMetric: 'roas',
          }),
        }),
      },
      expect.any(Object),
    );
  });

  it('saves a supported project Meta Graph API version override', () => {
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_account_credentials'));
    const accountDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_account_credentials',
    });
    fireEvent.change(
      within(accountDialog).getByDisplayValue('com_ui_project_meta_ads_graph_version_global'),
      {
        target: { value: 'v24.0' },
      },
    );
    fireEvent.click(within(accountDialog).getByText('com_ui_save'));

    expect(mockMutateSettings).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          graphVersion: 'v24.0',
        }),
      },
      expect.any(Object),
    );
  });

  it('does not render invalid saved Graph API values or token masks as editable values', () => {
    mockStatusData.credentials = {
      effectiveSource: 'project',
      projectConfigured: true,
      tenantConfigured: true,
      secretName: 'meta_graph_access_token_project_p1',
    };
    render(
      <ProjectMetaAdsPanel
        project={{
          ...project,
          metaAds: {
            graphVersion: 'guilherme@example.com',
            tokenSecretName: 'meta_graph_access_token_project_p1',
          },
        }}
        canEdit={true}
      />,
    );

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_account_credentials'));
    const accountDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_account_credentials',
    });
    fireEvent.click(within(accountDialog).getByText('com_ui_project_meta_ads_manage_tokens'));
    const credentialsDialog = screen.getAllByRole('dialog')[1];

    expect(screen.queryByDisplayValue('guilherme@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('com_ui_show_password')).not.toBeInTheDocument();
    expect(
      within(credentialsDialog).getByPlaceholderText('com_ui_project_meta_ads_token_keep_existing'),
    ).toHaveValue('');
  });

  it('opens a project chat with selected Meta Ads data and the configured traffic agent', () => {
    mockStatusData.latestSnapshots = [
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
    ];
    mockStatusData.recommendations = [
      {
        _id: 'r1',
        entityId: 'adset-1',
        action: 'increase' as const,
        status: 'pending' as const,
        proposedDailyBudget: 115,
        reason: 'CPA below target.',
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByLabelText('com_ui_project_meta_ads_select_campaign'));
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_chat_with_agent'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/c\/new\?project_id=p1&meta_ads_brief=meta_ads_brief%3A.+&agent_id=traffic-agent-1$/,
      ),
    );

    const url = mockNavigate.mock.calls[0][0] as string;
    const params = new URLSearchParams(url.split('?')[1]);
    const brief = JSON.parse(sessionStorage.getItem(params.get('meta_ads_brief') ?? '') ?? '{}');
    expect(brief.markdown).toContain('Prospecting');
    expect(brief.markdown).toContain('"entityId": "adset-1"');
  });

  it('renders campaigns first and expands ad sets for ABO-style review', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-1',
        campaignName: 'Messages Floripa',
        objective: 'OUTCOME_ENGAGEMENT',
        spend: 230,
        cpa: 38,
        resultCount: 6,
        resultType: 'messages',
        dailyBudget: 100,
        budgetLevel: 'campaign',
        editableBudgetLevel: 'campaign',
        adSets: [
          {
            entityId: 'adset-1',
            entityName: 'Topo',
            campaignId: 'campaign-1',
            campaignName: 'Messages Floripa',
            dailyBudget: 50,
            spend: 120,
            cpa: 40,
            resultCount: 3,
            resultType: 'messages',
          },
        ],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(screen.getAllByText('Messages Floripa').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('meta-ads-adset-row')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('com_ui_project_meta_ads_expand_campaign'));

    expect(screen.getByTestId('meta-ads-adset-row')).toHaveTextContent('Topo');
  });

  it('renders BI rankings for campaigns, ad sets, and ads by expected cost', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-a',
        campaignName: 'Campaign A',
        objective: 'OUTCOME_ENGAGEMENT',
        spend: 120,
        cpa: 12,
        resultCount: 10,
        resultType: 'lead',
        dailyBudget: 100,
        adSets: [
          {
            entityId: 'adset-a',
            entityName: 'Ad Set A',
            campaignId: 'campaign-a',
            campaignName: 'Campaign A',
            spend: 60,
            cpa: 10,
            resultCount: 6,
            resultType: 'lead',
            ads: [
              {
                adId: 'ad-a',
                adName: 'Ad A',
                adSetId: 'adset-a',
                campaignId: 'campaign-a',
                campaignName: 'Campaign A',
                spend: 30,
                cpa: 5,
                resultCount: 6,
                resultType: 'lead',
                thumbnailUrl: 'https://example.com/ad-a-thumb.jpg',
              },
            ],
          },
        ],
      },
      {
        campaignId: 'campaign-b',
        campaignName: 'Campaign B',
        objective: 'OUTCOME_ENGAGEMENT',
        spend: 40,
        cpa: 4,
        resultCount: 10,
        resultType: 'lead',
        dailyBudget: 80,
        adSets: [
          {
            entityId: 'adset-b',
            entityName: 'Ad Set B',
            campaignId: 'campaign-b',
            campaignName: 'Campaign B',
            spend: 40,
            cpa: 4,
            resultCount: 10,
            resultType: 'lead',
            ads: [
              {
                adId: 'ad-b',
                adName: 'Ad B',
                adSetId: 'adset-b',
                campaignId: 'campaign-b',
                campaignName: 'Campaign B',
                spend: 40,
                cpa: 4,
                resultCount: 10,
                resultType: 'lead',
                thumbnailUrl: 'https://example.com/ad-b-thumb.jpg',
              },
            ],
          },
        ],
      },
      {
        campaignId: 'campaign-c',
        campaignName: 'Traffic C',
        objective: 'OUTCOME_TRAFFIC',
        spend: 25,
        cpa: 2.5,
        resultCount: 10,
        resultType: 'link_click',
        dailyBudget: 50,
        adSets: [],
      },
      {
        campaignId: 'campaign-low-spend',
        campaignName: 'Low Spend Noise',
        objective: 'OUTCOME_ENGAGEMENT',
        spend: 0.75,
        cpa: 0.01,
        resultCount: 75,
        resultType: 'lead',
        dailyBudget: 50,
        adSets: [
          {
            entityId: 'adset-low-spend',
            entityName: 'Low Spend Ad Set',
            campaignId: 'campaign-low-spend',
            campaignName: 'Low Spend Noise',
            spend: 0.75,
            cpa: 0.01,
            resultCount: 75,
            resultType: 'lead',
            ads: [
              {
                adId: 'ad-low-spend',
                adName: 'Low Spend Ad',
                adSetId: 'adset-low-spend',
                campaignId: 'campaign-low-spend',
                campaignName: 'Low Spend Noise',
                spend: 0.75,
                cpa: 0.01,
                resultCount: 75,
                resultType: 'lead',
                thumbnailUrl: 'https://example.com/ad-low-spend-thumb.jpg',
              },
            ],
          },
        ],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    const campaignRankings = screen.getByTestId('meta-ads-bi-campaigns');
    const campaignRankingsText = campaignRankings.textContent ?? '';
    expect(campaignRankingsText.indexOf('Traffic C')).toBeLessThan(
      campaignRankingsText.indexOf('Campaign B'),
    );
    expect(screen.getByTestId('meta-ads-bi-campaigns')).not.toHaveTextContent('Low Spend Noise');
    expect(within(campaignRankings).getAllByTestId('meta-ads-rank-media').length).toBeGreaterThan(
      0,
    );

    fireEvent.click(within(campaignRankings).getByText('Traffic C'));

    expect(screen.getByText('com_ui_project_meta_ads_bi_rank_detail')).toBeInTheDocument();
    expect(screen.getAllByText('com_ui_project_meta_ads_level_campaign').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByTestId('meta-ads-bi-result-type-filter'), {
      target: { value: 'lead' },
    });

    expect(screen.getByTestId('meta-ads-bi-campaigns')).not.toHaveTextContent('Traffic C');
    expect(screen.getByTestId('meta-ads-bi-campaigns')).toHaveTextContent('Campaign B');

    fireEvent.change(screen.getByTestId('meta-ads-bi-level-filter'), {
      target: { value: 'adset' },
    });

    expect(screen.getByTestId('meta-ads-bi-adsets')).toHaveTextContent('Ad Set B');
    expect(screen.getByTestId('meta-ads-bi-adsets')).not.toHaveTextContent('Low Spend Ad Set');

    fireEvent.change(screen.getByTestId('meta-ads-bi-level-filter'), {
      target: { value: 'ad' },
    });

    expect(screen.getByTestId('meta-ads-bi-ads')).toHaveTextContent('Ad B');
    expect(screen.getByTestId('meta-ads-bi-ads')).not.toHaveTextContent('Low Spend Ad');
  });

  it('renders compiled BI rankings as sortable columns', () => {
    mockRankingData.items = [
      {
        id: 'campaign-low-cpa',
        name: 'Low CPA',
        level: 'campaign',
        objective: 'OUTCOME_SALES',
        resultType: 'purchase',
        resultCount: 10,
        spend: 100,
        cpa: 10,
        ctr: 1.2,
        frequency: 1.8,
      },
      {
        id: 'campaign-high-spend',
        name: 'High Spend',
        level: 'campaign',
        objective: 'OUTCOME_SALES',
        resultType: 'purchase',
        resultCount: 40,
        spend: 800,
        cpa: 20,
        ctr: 2.4,
        frequency: 2.1,
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    const rankings = screen.getByTestId('meta-ads-bi-campaigns');
    const initialRankingsText = rankings.textContent ?? '';
    expect(initialRankingsText.indexOf('Low CPA')).toBeLessThan(
      initialRankingsText.indexOf('High Spend'),
    );

    fireEvent.click(
      within(rankings).getByRole('button', { name: /com_ui_project_meta_ads_spend/ }),
    );

    const spendRankingsText = rankings.textContent ?? '';
    expect(spendRankingsText.indexOf('High Spend')).toBeLessThan(
      spendRankingsText.indexOf('Low CPA'),
    );
    expect(mockUseProjectMetaAdsRankingsQuery).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        datePreset: 'last_7d',
        level: 'campaign',
      }),
    );
  });

  it('lists only primary campaign result types in the BI result filter', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-message',
        campaignName: 'Message Campaign',
        objective: 'OUTCOME_ENGAGEMENT',
        spend: 100,
        cpa: 10,
        resultCount: 10,
        resultType: 'video_view',
        resultTypeBreakdown: [
          {
            resultType: 'purchase',
            totalSpend: 100,
            totalResults: 10,
            averageCostPerResult: 10,
          },
        ],
        adSets: [
          {
            entityId: 'adset-message',
            entityName: 'Message Ad Set',
            campaignId: 'campaign-message',
            campaignName: 'Message Campaign',
            spend: 100,
            cpa: 10,
            resultCount: 10,
            resultType: 'video_view',
            resultTypeBreakdown: [
              {
                resultType: 'purchase',
                totalSpend: 100,
                totalResults: 10,
                averageCostPerResult: 10,
              },
            ],
            ads: [
              {
                adId: 'ad-message',
                adName: 'Message Creative',
                adSetId: 'adset-message',
                campaignId: 'campaign-message',
                spend: 100,
                cpa: 10,
                resultCount: 10,
                resultType: 'video_view',
                resultTypeBreakdown: [
                  {
                    resultType: 'purchase',
                    totalSpend: 100,
                    totalResults: 10,
                    averageCostPerResult: 10,
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    const resultFilter = screen.getByTestId('meta-ads-bi-result-type-filter');
    const optionValues = Array.from(resultFilter.querySelectorAll('option')).map(
      (option) => option.value,
    );
    expect(optionValues).toContain('video_view');
    expect(optionValues).not.toContain('purchase');

    fireEvent.change(resultFilter, {
      target: { value: 'video_view' },
    });
    fireEvent.change(screen.getByTestId('meta-ads-bi-level-filter'), {
      target: { value: 'ad' },
    });

    expect(screen.getByTestId('meta-ads-bi-ads')).toHaveTextContent('Message Creative');
  });

  it('explains when Meta returns no ad-level metrics for top ads', () => {
    mockStatusData.adDiagnostics = {
      adsFetched: 3,
      adInsightsFetched: 0,
      adsWithInsights: 0,
      insightOnlyAds: 0,
      adsAttachedToAdSets: 0,
    };
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-message',
        campaignName: 'Message Campaign',
        objective: 'OUTCOME_ENGAGEMENT',
        spend: 100,
        cpa: 10,
        resultCount: 10,
        resultType: 'onsite_conversion.messaging_conversation_started_7d',
        adSets: [
          {
            entityId: 'adset-message',
            entityName: 'Message Ad Set',
            campaignId: 'campaign-message',
            campaignName: 'Message Campaign',
            spend: 100,
            cpa: 10,
            resultCount: 10,
            resultType: 'onsite_conversion.messaging_conversation_started_7d',
            ads: [],
          },
        ],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.change(screen.getByTestId('meta-ads-bi-level-filter'), {
      target: { value: 'ad' },
    });

    expect(screen.getByTestId('meta-ads-bi-ads')).toHaveTextContent(
      'com_ui_project_meta_ads_bi_no_ad_insights',
    );
  });

  it('averages fallback campaign frequency instead of summing ad set frequencies', () => {
    mockStatusData.latestSnapshots = [
      {
        entityId: 'adset-1',
        entityName: 'Topo',
        campaignId: 'campaign-1',
        campaignName: 'Messages Floripa',
        spend: 200,
        resultCount: 10,
        impressions: 100,
        reach: 50,
        frequency: 2,
      },
      {
        entityId: 'adset-2',
        entityName: 'Retarget',
        campaignId: 'campaign-1',
        campaignName: 'Messages Floripa',
        spend: 50,
        resultCount: 2,
        impressions: 300,
        reach: 75,
        frequency: 4,
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    const rows = screen.getAllByTestId('meta-ads-campaign-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Messages Floripa');
    expect(within(rows[0]).getByText('3.50')).toHaveAttribute(
      'title',
      'com_ui_project_meta_ads_impressions: 400 / com_ui_project_meta_ads_reach: 125',
    );
    expect(within(rows[0]).queryByText('6.00')).not.toBeInTheDocument();
  });

  it('filters campaigns by localized campaign objective without showing the objective summary panel', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-engagement',
        campaignName: 'Mensagens Floripa',
        objective: 'OUTCOME_ENGAGEMENT',
        spend: 250,
        cpa: 20.83,
        resultCount: 12,
        resultType: 'lead',
        dailyBudget: 100,
        impressions: 10000,
        clicks: 500,
        frequency: 3,
        budgetMode: 'CBO',
        adSets: [
          {
            entityId: 'adset-message',
            entityName: 'Conversas',
            campaignId: 'campaign-engagement',
            campaignName: 'Mensagens Floripa',
            spend: 200,
            resultCount: 10,
            resultType: 'link_click',
          },
          {
            entityId: 'adset-lead',
            entityName: 'Lead form',
            campaignId: 'campaign-engagement',
            campaignName: 'Mensagens Floripa',
            spend: 50,
            resultCount: 2,
            resultType: 'onsite_conversion.messaging_conversation_started_7d',
          },
        ],
      },
      {
        campaignId: 'campaign-sales',
        campaignName: 'Vendas SP',
        objective: 'OUTCOME_SALES',
        spend: 100,
        cpa: 50,
        resultCount: 2,
        resultType: 'purchase',
        dailyBudget: 80,
        budgetMode: 'ABO',
        adSets: [],
      },
    ];
    mockStatusData.summary = {
      totalSpend: 350,
      totalResults: null,
      averageCostPerResult: null,
      averageFrequency: 3.5,
      objectives: [
        {
          objective: 'OUTCOME_ENGAGEMENT',
          campaignCount: 1,
          totalSpend: 250,
          totalResults: 12,
          averageCostPerResult: 20.83,
          averageFrequency: 3,
          averageCtr: 5,
          resultTypes: [
            {
              resultType: 'link_click',
              totalSpend: 200,
              totalResults: 10,
              averageCostPerResult: 20,
            },
            {
              resultType: 'onsite_conversion.messaging_conversation_started_7d',
              totalSpend: 50,
              totalResults: 2,
              averageCostPerResult: 25,
            },
          ],
        },
        {
          objective: 'OUTCOME_SALES',
          campaignCount: 1,
          totalSpend: 100,
          totalResults: 2,
          averageCostPerResult: 50,
          averageFrequency: 4,
          averageCtr: null,
          resultTypes: [
            {
              resultType: 'purchase',
              totalSpend: 100,
              totalResults: 2,
              averageCostPerResult: 50,
            },
          ],
        },
      ],
    };

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(
      screen.getAllByText('com_ui_project_meta_ads_objective_engagement').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('com_ui_project_meta_ads_objective_sales').length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByTestId('meta-ads-objective-summary')).not.toBeInTheDocument();
    expect(
      screen.queryByText('com_ui_project_meta_ads_campaign_objectives'),
    ).not.toBeInTheDocument();
    expect(
      within(
        screen.getByTestId('meta-ads-summary-card-com_ui_project_meta_ads_total_results'),
      ).getByText('-'),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId('meta-ads-summary-card-com_ui_project_meta_ads_average_cost'),
      ).getByText('-'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /com_ui_project_meta_ads_total_results/ }));
    const resultMetricDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_choose_result_metric',
    });
    fireEvent.click(
      within(resultMetricDialog).getByRole('button', {
        name: /com_ui_project_meta_ads_result_type_message/,
      }),
    );

    expect(
      within(
        screen.getByTestId('meta-ads-summary-card-com_ui_project_meta_ads_total_results'),
      ).getByText('2.00'),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId('meta-ads-summary-card-com_ui_project_meta_ads_average_cost'),
      ).getByText('R$ 25,00'),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId('meta-ads-summary-card-com_ui_project_meta_ads_total_results'),
      ).getByText('com_ui_project_meta_ads_result_type_message'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /com_ui_project_meta_ads_total_results/ }));
    fireEvent.click(
      screen.getByRole('button', { name: 'com_ui_project_meta_ads_clear_result_metric' }),
    );
    expect(
      within(
        screen.getByTestId('meta-ads-summary-card-com_ui_project_meta_ads_total_results'),
      ).getByText('-'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_objective_filter'), {
      target: { value: 'OUTCOME_SALES' },
    });

    expect(
      within(
        screen.getByTestId('meta-ads-summary-card-com_ui_project_meta_ads_total_results'),
      ).getByText('2.00'),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId('meta-ads-summary-card-com_ui_project_meta_ads_average_cost'),
      ).getByText('R$ 50,00'),
    ).toBeInTheDocument();
    const rows = screen.getAllByTestId('meta-ads-campaign-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Vendas SP');
    expect(rows[0]).not.toHaveTextContent('Mensagens Floripa');
  });

  it('shows Ads Manager metrics, CBO/ABO budget modes, and sends manual budget changes', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-cbo',
        campaignName: 'CBO Messages',
        objective: 'OUTCOME_ENGAGEMENT',
        spend: 230,
        cpa: 38,
        resultCount: 6,
        resultType: 'messages',
        dailyBudget: 100,
        budgetLevel: 'campaign',
        editableBudgetLevel: 'campaign',
        budgetMode: 'CBO',
        impressions: 10000,
        reach: 7000,
        clicks: 400,
        cpc: 0.57,
        cpm: 23,
        videoP75Watched: 800,
        videoP75Rate: 8,
        adSets: [
          {
            entityId: 'adset-1',
            entityName: 'Topo CBO',
            campaignId: 'campaign-cbo',
            campaignName: 'CBO Messages',
            dailyBudget: 0,
            spend: 120,
          },
        ],
      },
      {
        campaignId: 'campaign-abo',
        campaignName: 'ABO Sales',
        spend: 180,
        dailyBudget: 70,
        editableBudgetLevel: 'adset',
        budgetMode: 'ABO',
        adSets: [
          {
            entityId: 'adset-abo',
            entityName: 'Purchase ABO',
            campaignId: 'campaign-abo',
            campaignName: 'ABO Sales',
            dailyBudget: 70,
            spend: 180,
          },
        ],
      },
    ];
    mockMutateBudget.mockImplementationOnce((_payload, options?: { onSuccess?: () => void }) =>
      options?.onSuccess?.(),
    );

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(screen.getByText('com_ui_project_meta_ads_delivery')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_campaign')).toBeInTheDocument();
    expect(screen.getAllByText('com_ui_project_meta_ads_results').length).toBeGreaterThan(0);
    expect(screen.getByText('com_ui_project_meta_ads_table_view')).toBeInTheDocument();
    expect(screen.getByDisplayValue('com_ui_project_meta_ads_view_summary')).toBeInTheDocument();
    expect(screen.getAllByText('com_ui_project_meta_ads_objective').length).toBeGreaterThan(0);
    expect(screen.getByText('com_ui_project_meta_ads_budget_mode')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_rule')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_recommendation')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_table_view'), {
      target: { value: 'rules' },
    });
    expect(screen.getByText('com_ui_project_meta_ads_rule')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_recommendation')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_table_view'), {
      target: { value: 'performance' },
    });
    expect(screen.getByText('com_ui_project_meta_ads_video_p75')).toBeInTheDocument();
    expect(screen.getByText('800.00')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_table_view'), {
      target: { value: 'creative' },
    });
    expect(screen.getAllByText('com_ui_project_meta_ads_budget_defined').length).toBeGreaterThan(0);

    const cboCampaignRow = screen
      .getAllByTestId('meta-ads-campaign-row')
      .find((row) => row.textContent?.includes('CBO Messages'));
    expect(cboCampaignRow).not.toBeNull();

    fireEvent.click(within(cboCampaignRow as HTMLElement).getByText('R$ 100,00'));
    const budgetDialog = screen.getByRole('dialog');
    expect(budgetDialog).toBeInTheDocument();
    expect(within(budgetDialog).getByText('-15%')).toBeInTheDocument();
    expect(within(budgetDialog).getByText('R$ 85,00')).toBeInTheDocument();
    expect(within(budgetDialog).getByText('+15%')).toBeInTheDocument();
    expect(within(budgetDialog).getByText('R$ 115,00')).toBeInTheDocument();
    fireEvent.click(within(budgetDialog).getByRole('button', { name: /\+15%.*115,00/ }));
    expect(screen.getByLabelText('com_ui_project_meta_ads_new_budget')).toHaveValue(115);
    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_new_budget'), {
      target: { value: '125' },
    });
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_save_budget'));
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_confirm_budget'));

    expect(mockMutateBudget).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        payload: {
          entityLevel: 'campaign',
          entityId: 'campaign-cbo',
          entityName: 'CBO Messages',
          dailyBudget: 125,
          reason: 'manual-ui',
        },
      },
      expect.any(Object),
    );
    expect(mockRefetchStatus).toHaveBeenCalled();
  });

  it('allows a USER without project edit to use Meta Ads ad actions and preview', () => {
    mockStatusData.currency = 'BRL';
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-ads',
        campaignName: 'ABO Leads',
        objective: 'OUTCOME_LEADS',
        spend: 160,
        dailyBudget: 70,
        editableBudgetLevel: 'adset',
        budgetMode: 'ABO',
        status: 'ACTIVE',
        adSets: [
          {
            entityId: 'adset-ads',
            entityName: 'Warm leads',
            campaignId: 'campaign-ads',
            campaignName: 'ABO Leads',
            dailyBudget: 70,
            spend: 160,
            status: 'PAUSED',
            ads: [
              {
                adId: 'ad-1',
                adName: 'Visit schedule creative',
                adSetId: 'adset-ads',
                campaignId: 'campaign-ads',
                creativeId: 'creative-1',
                title: 'Book a private visit',
                body: 'Pick an open time and tour the model unit.',
                description: 'Limited slots this week',
                thumbnailUrl: 'https://example.com/thumb.jpg',
                imageUrl: 'https://example.com/image.jpg',
                adsManagerUrl:
                  'https://adsmanager.facebook.com/adsmanager/manage/ads?act=123&selected_ad_ids=ad-1',
                linkUrl: 'https://example.com/visit',
                callToActionType: 'LEARN_MORE',
                spend: 48,
                cpa: 12,
                resultCount: 4,
                impressions: 1800,
                clicks: 72,
                ctr: 4,
                frequency: 2.1,
                currency: 'BRL',
                status: 'ACTIVE',
              },
              {
                adId: 'ad-2',
                adName: 'Paused creative',
                adSetId: 'adset-ads',
                campaignId: 'campaign-ads',
                spend: 24,
                cpa: 8,
                resultCount: 3,
                impressions: 900,
                clicks: 30,
                ctr: 3.33,
                frequency: 1.8,
                currency: 'BRL',
                status: 'PAUSED',
              },
            ],
          },
        ],
      },
    ];

    mockUserRole = 'USER';
    render(<ProjectMetaAdsPanel project={project} canEdit={false} />);

    expect(screen.getAllByText('com_ui_project_meta_ads_level_campaign').length).toBeGreaterThan(0);
    expect(screen.getAllByText('com_ui_project_meta_ads_level_ad_set').length).toBeGreaterThan(0);
    expect(screen.getAllByText('com_ui_project_meta_ads_level_ad').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Visit schedule creative').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Paused creative').length).toBeGreaterThan(0);
    expect(screen.getByTestId('meta-ads-adset-row')).toHaveTextContent(
      'com_ui_project_meta_ads_objective_leads',
    );
    expect(screen.getByTestId('meta-ads-adset-row')).toHaveTextContent('ABO');
    expect(screen.getByTestId('meta-ads-ad-card-ad-1')).toHaveTextContent(
      'com_ui_project_meta_ads_objective_leads',
    );
    expect(screen.getByTestId('meta-ads-ad-card-ad-1')).toHaveTextContent('ABO');
    const campaignSwitch = screen.getAllByRole('switch', {
      name: 'com_ui_project_meta_ads_deactivate_ad',
    })[0];
    const adsetSwitch = screen.getAllByRole('switch', {
      name: 'com_ui_project_meta_ads_activate_ad',
    })[0];
    const deactivateSwitch = within(screen.getByTestId('meta-ads-ad-card-ad-1')).getByRole(
      'switch',
      {
        name: 'com_ui_project_meta_ads_deactivate_ad',
      },
    );
    const activateSwitch = within(screen.getByTestId('meta-ads-ad-card-ad-2')).getByRole('switch', {
      name: 'com_ui_project_meta_ads_activate_ad',
    });
    expect(campaignSwitch).toHaveAttribute('aria-checked', 'true');
    expect(adsetSwitch).toHaveAttribute('aria-checked', 'false');
    expect(deactivateSwitch).toHaveAttribute('aria-checked', 'true');
    expect(activateSwitch).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Book a private visit')).toBeInTheDocument();
    expect(screen.getByAltText('Visit schedule creative')).toHaveAttribute(
      'src',
      'https://example.com/thumb.jpg',
    );

    mockMutateDuplicate.mockImplementationOnce((_payload, options?: { onSuccess?: () => void }) =>
      options?.onSuccess?.(),
    );
    fireEvent.click(screen.getAllByLabelText('com_ui_project_meta_ads_actions')[0]);
    expect(screen.getByText('com_ui_project_meta_ads_duplicate_campaign')).toBeInTheDocument();
    fireEvent.click(document.body);
    expect(
      screen.queryByText('com_ui_project_meta_ads_duplicate_campaign'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText('com_ui_project_meta_ads_actions')[0]);
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_duplicate_campaign'));
    expect(screen.getByRole('dialog')).toHaveTextContent('com_ui_project_meta_ads_duplicate_title');
    expect(screen.getByDisplayValue('ABO Leads - cópia')).toBeInTheDocument();
    expect(
      screen.getByText('com_ui_project_meta_ads_duplicate_active_warning'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_duplicate_confirm'));
    expect(mockMutateDuplicate).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        payload: {
          entityLevel: 'campaign',
          entityId: 'campaign-ads',
          entityName: 'ABO Leads',
          targetName: 'ABO Leads - cópia',
        },
      },
      expect.any(Object),
    );

    mockMutateDuplicate.mockImplementationOnce((_payload, options?: { onSuccess?: () => void }) =>
      options?.onSuccess?.(),
    );
    fireEvent.click(screen.getAllByLabelText('com_ui_project_meta_ads_actions')[1]);
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_duplicate_adset'));
    expect(screen.getByDisplayValue('Warm leads - cópia')).toBeInTheDocument();
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_duplicate_confirm'));
    expect(mockMutateDuplicate).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        payload: {
          entityLevel: 'adset',
          entityId: 'adset-ads',
          entityName: 'Warm leads',
          targetName: 'Warm leads - cópia',
        },
      },
      expect.any(Object),
    );

    mockMutateEntityStatus.mockImplementation((_payload, options?: { onSuccess?: () => void }) =>
      options?.onSuccess?.(),
    );
    fireEvent.click(campaignSwitch);
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_confirm_deactivate_ad'));
    expect(mockMutateEntityStatus).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        entityLevel: 'campaign',
        entityId: 'campaign-ads',
        payload: {
          entityName: 'ABO Leads',
          status: 'PAUSED',
        },
      },
      expect.any(Object),
    );

    fireEvent.click(deactivateSwitch);
    expect(screen.getByText('com_ui_project_meta_ads_confirm_ad_status_title')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_confirm_deactivate_ad'));
    expect(mockMutateEntityStatus).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        entityLevel: 'ad',
        entityId: 'ad-1',
        payload: {
          entityName: 'Visit schedule creative',
          status: 'PAUSED',
        },
      },
      expect.any(Object),
    );
    expect(mockRefetchStatus).toHaveBeenCalled();

    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    fireEvent.click(
      within(screen.getByTestId('meta-ads-ad-card-ad-1')).getByLabelText(
        'com_ui_project_meta_ads_open_meta_ads',
      ),
    );
    expect(openSpy).not.toHaveBeenCalled();
    let previewDialog = screen.getByRole('dialog');
    expect(previewDialog).toHaveTextContent('Visit schedule creative');
    expect(previewDialog).toHaveTextContent('Book a private visit');
    expect(previewDialog).toHaveTextContent('Pick an open time and tour the model unit.');
    expect(previewDialog).toHaveTextContent('Limited slots this week');
    expect(previewDialog).toHaveTextContent('R$ 48,00');
    expect(previewDialog).toHaveTextContent('R$ 12,00');

    fireEvent.click(within(previewDialog).getByLabelText('com_ui_project_meta_ads_open_meta_ads'));
    expect(openSpy).toHaveBeenCalledWith(
      'https://adsmanager.facebook.com/adsmanager/manage/ads?act=123&selected_ad_ids=ad-1',
      '_blank',
      'noopener,noreferrer',
    );

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_collapse_all'));
    expect(screen.queryByTestId('meta-ads-ad-card-ad-1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_expand_all'));
    expect(screen.getByTestId('meta-ads-ad-card-ad-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('meta-ads-ad-card-ad-1'));

    expect(openSpy).toHaveBeenCalledTimes(1);
    previewDialog = screen.getByRole('dialog');
    expect(previewDialog).toHaveTextContent('Visit schedule creative');

    fireEvent.click(screen.getByLabelText('com_ui_project_meta_ads_hide_ads'));
    expect(screen.queryByTestId('meta-ads-ad-card-ad-1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('com_ui_project_meta_ads_show_ads'));
    expect(screen.getByTestId('meta-ads-ad-card-ad-1')).toBeInTheDocument();
  });

  it('opens ad preview without redirecting when Ads Manager URL is missing', () => {
    mockStatusData.currency = 'BRL';
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-ads',
        campaignName: 'ABO Leads',
        spend: 160,
        dailyBudget: 70,
        editableBudgetLevel: 'adset',
        budgetMode: 'ABO',
        adSets: [
          {
            entityId: 'adset-ads',
            entityName: 'Warm leads',
            campaignId: 'campaign-ads',
            campaignName: 'ABO Leads',
            dailyBudget: 70,
            spend: 160,
            ads: [
              {
                adId: 'ad-1',
                adName: 'Visit schedule creative',
                adSetId: 'adset-ads',
                campaignId: 'campaign-ads',
                title: 'Book a private visit',
                body: 'Pick an open time and tour the model unit.',
                thumbnailUrl: 'https://example.com/thumb.jpg',
                spend: 48,
                cpa: 12,
                resultCount: 4,
                impressions: 1800,
                clicks: 72,
                ctr: 4,
                frequency: 2.1,
                currency: 'BRL',
              },
            ],
          },
        ],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    fireEvent.click(screen.getByTestId('meta-ads-ad-card-ad-1'));

    const previewDialog = screen.getByRole('dialog');
    expect(previewDialog).toHaveTextContent('Visit schedule creative');
    expect(previewDialog).toHaveTextContent('com_ui_project_meta_ads_manager_unavailable');

    fireEvent.click(
      within(previewDialog).getByLabelText('com_ui_project_meta_ads_manager_unavailable'),
    );
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('formats monetary metrics with the ad account currency and shows missing results as dash', () => {
    mockStatusData.currency = 'BRL';
    mockStatusData.summary = {
      totalSpend: 85.76,
      totalResults: 0,
      averageCostPerResult: null,
      averageFrequency: 0,
    };
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-abo',
        campaignName: 'FB/IG - REMARKETING',
        spend: 85.76,
        cpa: null,
        resultCount: undefined,
        dailyBudget: 15,
        editableBudgetLevel: 'adset',
        budgetMode: 'ABO',
        adSets: [
          {
            entityId: 'adset-abo',
            entityName: '25 65+ ARTES',
            campaignId: 'campaign-abo',
            campaignName: 'FB/IG - REMARKETING',
            spend: 13.69,
            cpa: null,
            resultCount: undefined,
            dailyBudget: 15,
          },
        ],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(screen.getAllByText('R$ 85,76').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 13,69').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 15,00').length).toBeGreaterThan(0);
    expect(screen.getByText('25 65+ ARTES')).toBeInTheDocument();

    const adSetRow = screen.getByText('25 65+ ARTES').closest('tr');
    expect(adSetRow).not.toBeNull();
    expect(adSetRow).toHaveTextContent('-');
  });

  it('renders ecommerce summary cards with weighted ROAS and purchase metrics', () => {
    const ecommerceProject = {
      ...project,
      metaAds: {
        accountProfile: 'ecommerce',
        rules: {
          targetResultType: 'purchase',
          primaryMetric: 'roas',
        },
      },
    } as TProject;
    mockStatusData.currency = 'BRL';
    mockStatusData.summary = {
      totalSpend: 300,
      totalResults: 43,
      averageCostPerResult: 6.98,
      averageFrequency: 4.2,
      objectives: [
        {
          objective: 'OUTCOME_SALES',
          campaignCount: 2,
          totalSpend: 300,
          totalResults: 43,
          averageCostPerResult: 6.98,
          averageFrequency: 4.2,
          averageCtr: 2,
          resultTypes: [
            {
              resultType: 'purchase',
              totalSpend: 300,
              totalResults: 3,
              averageCostPerResult: 100,
            },
            {
              resultType: 'link_click',
              totalSpend: 300,
              totalResults: 40,
              averageCostPerResult: 7.5,
            },
          ],
        },
      ],
    };
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-roas-high',
        campaignName: 'Sales High ROAS',
        objective: 'OUTCOME_SALES',
        spend: 100,
        roas: 4,
        cpa: 50,
        resultCount: 2,
        resultType: 'purchase',
        frequency: 6,
        videoP75Watched: 900,
        adSets: [],
      },
      {
        campaignId: 'campaign-roas-low',
        campaignName: 'Sales Low ROAS',
        objective: 'OUTCOME_SALES',
        spend: 200,
        roas: 1,
        cpa: 200,
        resultCount: 1,
        resultType: 'purchase',
        frequency: 8,
        videoP75Watched: 1200,
        adSets: [],
      },
    ];

    render(<ProjectMetaAdsPanel project={ecommerceProject} canEdit={true} />);

    expect(
      within(
        screen.getByTestId('meta-ads-summary-card-com_ui_project_meta_ads_average_roas'),
      ).getByText('2.00'),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId('meta-ads-summary-card-com_ui_project_meta_ads_total_spend'),
      ).getByText('R$ 300,00'),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId('meta-ads-summary-card-com_ui_project_meta_ads_total_results'),
      ).getByText('3.00'),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId('meta-ads-summary-card-com_ui_project_meta_ads_average_cost'),
      ).getByText('R$ 100,00'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'com_ui_project_meta_ads_roas' }),
    ).toBeInTheDocument();
    const table = screen.getAllByTestId('meta-ads-campaign-row')[0].closest('table');
    expect(
      within(table as HTMLElement).queryByRole('button', {
        name: 'com_ui_project_meta_ads_frequency',
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('com_ui_project_meta_ads_video_p75')).not.toBeInTheDocument();
  });

  it('sorts ecommerce campaigns by ROAS from the table header', () => {
    const ecommerceProject = {
      ...project,
      metaAds: {
        accountProfile: 'ecommerce',
        rules: { targetResultType: 'purchase', primaryMetric: 'roas' },
      },
    } as TProject;
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-low-roas',
        campaignName: 'Low ROAS',
        objective: 'OUTCOME_SALES',
        spend: 200,
        roas: 1.2,
        resultCount: 2,
        cpa: 100,
        adSets: [],
      },
      {
        campaignId: 'campaign-high-roas',
        campaignName: 'High ROAS',
        objective: 'OUTCOME_SALES',
        spend: 100,
        roas: 5.5,
        resultCount: 3,
        cpa: 33.33,
        adSets: [],
      },
    ];

    render(<ProjectMetaAdsPanel project={ecommerceProject} canEdit={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_project_meta_ads_roas' }));
    const rows = screen.getAllByTestId('meta-ads-campaign-row');
    expect(rows[0]).toHaveTextContent('High ROAS');
    expect(rows[1]).toHaveTextContent('Low ROAS');
  });

  it('prioritizes purchase and hides mixed traffic events in ecommerce result selector', () => {
    const ecommerceProject = {
      ...project,
      metaAds: {
        accountProfile: 'ecommerce',
        rules: { targetResultType: 'purchase', primaryMetric: 'roas' },
      },
    } as TProject;
    mockStatusData.summary = {
      totalSpend: 150,
      totalResults: 99,
      averageCostPerResult: 1.52,
      averageFrequency: 3,
      objectives: [
        {
          objective: 'OUTCOME_SALES',
          campaignCount: 1,
          totalSpend: 150,
          totalResults: 99,
          averageCostPerResult: 1.52,
          averageFrequency: 3,
          averageCtr: 2,
          resultTypes: [
            {
              resultType: 'purchase',
              totalSpend: 150,
              totalResults: 4,
              averageCostPerResult: 37.5,
            },
            {
              resultType: 'link_click',
              totalSpend: 150,
              totalResults: 80,
              averageCostPerResult: 1.88,
            },
            {
              resultType: 'video_view',
              totalSpend: 150,
              totalResults: 15,
              averageCostPerResult: 10,
            },
          ],
        },
      ],
    };
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-sales',
        campaignName: 'Sales',
        objective: 'OUTCOME_SALES',
        spend: 150,
        roas: 3,
        resultCount: 4,
        resultType: 'purchase',
        cpa: 37.5,
        adSets: [],
      },
    ];

    render(<ProjectMetaAdsPanel project={ecommerceProject} canEdit={true} />);

    expect(
      within(
        screen.getByTestId('meta-ads-summary-card-com_ui_project_meta_ads_total_results'),
      ).getByText('4.00'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /com_ui_project_meta_ads_total_results/ }));
    const resultMetricDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_choose_result_metric',
    });
    expect(
      within(resultMetricDialog).getByText('com_ui_project_meta_ads_result_type_purchase'),
    ).toBeInTheDocument();
    expect(
      within(resultMetricDialog).queryByText('com_ui_project_meta_ads_result_type_link_click'),
    ).not.toBeInTheDocument();
    expect(within(resultMetricDialog).queryByText(/Video View/)).not.toBeInTheDocument();
  });

  it('auto-expands ABO campaigns by campaign group and keeps CBO ad sets collapsed', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-cbo',
        campaignName: 'CBO Messages',
        spend: 230,
        dailyBudget: 100,
        editableBudgetLevel: 'campaign',
        budgetMode: 'CBO',
        adSets: [
          {
            entityId: 'adset-cbo',
            entityName: 'Hidden CBO audience',
            campaignId: 'campaign-cbo',
            campaignName: 'CBO Messages',
            dailyBudget: 0,
            spend: 120,
          },
        ],
      },
      {
        campaignId: 'campaign-abo',
        campaignName: 'ABO Sales',
        spend: 180,
        dailyBudget: 70,
        editableBudgetLevel: 'adset',
        budgetMode: 'ABO',
        adSets: [
          {
            entityId: 'adset-abo',
            entityName: 'Visible ABO audience',
            campaignId: 'campaign-abo',
            campaignName: 'ABO Sales',
            dailyBudget: 70,
            spend: 180,
          },
        ],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(screen.getByText('ABO Sales')).toBeInTheDocument();
    expect(screen.getByText('Visible ABO audience')).toBeInTheDocument();
    expect(screen.queryByText('Hidden CBO audience')).not.toBeInTheDocument();

    const aboCampaignRow = screen
      .getByText('ABO Sales')
      .closest('[data-testid="meta-ads-campaign-row"]');
    expect(aboCampaignRow).not.toHaveTextContent('com_ui_project_meta_ads_edit_budget');

    const aboAdSetRow = screen.getByText('Visible ABO audience').closest('tr');
    expect(aboAdSetRow).not.toBeNull();

    fireEvent.click(within(aboAdSetRow as HTMLElement).getByText('R$ 70,00'));
    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_new_budget'), {
      target: { value: '90' },
    });
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_save_budget'));
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_confirm_budget'));

    expect(mockMutateBudget).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        payload: expect.objectContaining({
          entityLevel: 'adset',
          entityId: 'adset-abo',
          dailyBudget: 90,
        }),
      },
      expect.any(Object),
    );
  });

  it('creates a campaign rule group from selected campaigns', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-1',
        campaignName: 'Messages Floripa',
        spend: 230,
        dailyBudget: 100,
        editableBudgetLevel: 'campaign',
        budgetMode: 'CBO',
        adSets: [],
      },
      {
        campaignId: 'campaign-2',
        campaignName: 'Messages SP',
        spend: 180,
        dailyBudget: 90,
        editableBudgetLevel: 'campaign',
        budgetMode: 'CBO',
        adSets: [],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getAllByLabelText('com_ui_project_meta_ads_select_campaign')[0]);
    fireEvent.click(screen.getAllByLabelText('com_ui_project_meta_ads_select_campaign')[1]);
    fireEvent.click(screen.getAllByText('com_ui_project_meta_ads_create_rule_group')[0]);

    const ruleGroupDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_create_rule_group',
    });
    fireEvent.change(
      within(ruleGroupDialog).getByLabelText('com_ui_project_meta_ads_rule_group_name'),
      {
        target: { value: 'Topo mensagens' },
      },
    );
    fireEvent.change(within(ruleGroupDialog).getByLabelText('com_ui_project_meta_ads_target_cpa'), {
      target: { value: '35' },
    });
    expect(ruleGroupDialog).toHaveTextContent('2 com_ui_project_meta_ads_rule_group_selected');
    expect(ruleGroupDialog).toHaveTextContent('Messages Floripa');
    expect(ruleGroupDialog).toHaveTextContent('Messages SP');
    fireEvent.click(within(ruleGroupDialog).getByText('com_ui_project_meta_ads_save_rule_group'));

    expect(mockMutateSettings).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          ruleGroups: [
            expect.objectContaining({
              name: 'Topo mensagens',
              entityLevel: 'campaign',
              entityIds: ['campaign-1', 'campaign-2'],
              rules: expect.objectContaining({ targetCpa: 35 }),
            }),
          ],
        }),
      },
      expect.any(Object),
    );
  });

  it('opens rule group creation in a drawer above the table context', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-1',
        campaignName: 'Messages Floripa',
        spend: 230,
        dailyBudget: 100,
        editableBudgetLevel: 'campaign',
        budgetMode: 'CBO',
        adSets: [],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByLabelText('com_ui_project_meta_ads_select_campaign'));
    fireEvent.click(screen.getAllByText('com_ui_project_meta_ads_create_rule_group')[0]);

    expect(
      screen.getByRole('dialog', { name: 'com_ui_project_meta_ads_create_rule_group' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('meta-ads-campaign-row')).toBeInTheDocument();
  });

  it('filters and sorts campaigns like an operator table', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-low',
        campaignName: 'Low Spend CBO',
        spend: 50,
        dailyBudget: 100,
        editableBudgetLevel: 'campaign',
        budgetMode: 'CBO',
        adSets: [],
      },
      {
        campaignId: 'campaign-high',
        campaignName: 'High Spend ABO',
        spend: 300,
        dailyBudget: 70,
        editableBudgetLevel: 'adset',
        budgetMode: 'ABO',
        adSets: [],
      },
      {
        campaignId: 'campaign-hidden',
        campaignName: 'Hidden CBO',
        spend: 200,
        dailyBudget: 120,
        editableBudgetLevel: 'campaign',
        budgetMode: 'CBO',
        adSets: [],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_search'), {
      target: { value: 'spend' },
    });
    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_budget_mode_filter'), {
      target: { value: 'CBO' },
    });
    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_sort'), {
      target: { value: 'spend_desc' },
    });

    const rows = screen.getAllByTestId('meta-ads-campaign-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Low Spend CBO');
    expect(screen.queryByText('High Spend ABO')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden CBO')).not.toBeInTheDocument();
  });

  it('sorts campaigns from the table header', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-low-frequency',
        campaignName: 'Low Frequency',
        frequency: 2,
        spend: 50,
        dailyBudget: 100,
        editableBudgetLevel: 'campaign',
        budgetMode: 'CBO',
        adSets: [],
      },
      {
        campaignId: 'campaign-high-frequency',
        campaignName: 'High Frequency',
        frequency: 6,
        spend: 300,
        dailyBudget: 70,
        editableBudgetLevel: 'campaign',
        budgetMode: 'CBO',
        adSets: [],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    const table = screen.getAllByTestId('meta-ads-campaign-row')[0].closest('table');
    fireEvent.click(
      within(table as HTMLElement).getByRole('button', {
        name: 'com_ui_project_meta_ads_frequency',
      }),
    );
    const rows = screen.getAllByTestId('meta-ads-campaign-row');
    expect(rows[0]).toHaveTextContent('High Frequency');
    expect(rows[1]).toHaveTextContent('Low Frequency');
  });

  it('shows period dashboard summary and requests the selected period', () => {
    mockStatusData.summary = {
      totalSpend: 300,
      totalResults: 12,
      averageCostPerResult: 25,
      averageFrequency: 3,
      bestCampaignByCost: undefined,
      worstCampaignByCost: undefined,
    };

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(mockUseProjectMetaAdsQuery).toHaveBeenCalledWith('p1', { datePreset: 'last_7d' });
    expect(mockUseProjectMetaAdsQuery).not.toHaveBeenCalledWith('p1', undefined);
    expect(mockUseProjectMetaAdsRankingsQuery).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ datePreset: 'last_7d' }),
    );
    expect(screen.getByText('com_ui_project_meta_ads_total_spend')).toBeInTheDocument();
    expect(screen.getByText('R$ 300,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 25,00')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_period'), {
      target: { value: 'last_30d' },
    });

    expect(mockUseProjectMetaAdsQuery).toHaveBeenLastCalledWith('p1', {
      datePreset: 'last_30d',
    });
    expect(mockUseProjectMetaAdsRankingsQuery).toHaveBeenLastCalledWith(
      'p1',
      expect.objectContaining({ datePreset: 'last_30d' }),
    );

    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_period'), {
      target: { value: 'custom' },
    });
    expect(screen.getByLabelText('com_ui_project_meta_ads_period_since')).toBeInTheDocument();
    expect(screen.getByLabelText('com_ui_project_meta_ads_period_until')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_period_since'), {
      target: { value: '2026-06-01' },
    });
    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_period_until'), {
      target: { value: '2026-06-10' },
    });

    expect(mockUseProjectMetaAdsQuery).toHaveBeenLastCalledWith('p1', {
      since: '2026-06-01',
      until: '2026-06-10',
    });
    expect(mockUseProjectMetaAdsRankingsQuery).toHaveBeenLastCalledWith(
      'p1',
      expect.objectContaining({
        since: '2026-06-01',
        until: '2026-06-10',
      }),
    );
  });

  it('renders campaign evolution dashboard from historical trend data', () => {
    mockStatusData.summary = {
      totalSpend: 370,
      totalResults: 15,
      averageCostPerResult: 24.67,
      averageFrequency: 3.8,
    };
    mockStatusData.trend = {
      points: [
        {
          date: '2026-06-01',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          spend: 100,
          resultCount: 4,
          cpa: 25,
          dailyBudget: 50,
          frequency: 2,
        },
        {
          date: '2026-06-02',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          spend: 270,
          resultCount: 11,
          cpa: 24.55,
          dailyBudget: 100,
          frequency: 4.5,
        },
      ],
      series: [
        {
          level: 'campaign',
          entityId: 'campaign-1',
          entityName: 'Messages Floripa',
          points: [
            {
              date: '2026-06-01',
              campaignId: 'campaign-1',
              campaignName: 'Messages Floripa',
              spend: 100,
              resultCount: 4,
              cpa: 25,
            },
            {
              date: '2026-06-02',
              campaignId: 'campaign-1',
              campaignName: 'Messages Floripa',
              spend: 270,
              resultCount: 11,
              cpa: 24.55,
            },
          ],
        },
        {
          level: 'ad',
          entityId: 'ad-1',
          entityName: 'Creative A',
          parentCampaignName: 'Topo',
          objective: 'OUTCOME_ENGAGEMENT',
          resultType: 'lead',
          points: [
            {
              date: '2026-06-01',
              campaignId: 'campaign-1',
              campaignName: 'Messages Floripa',
              spend: 10,
              resultCount: 1,
              cpa: 10,
            },
            {
              date: '2026-06-02',
              campaignId: 'campaign-1',
              campaignName: 'Messages Floripa',
              spend: 20,
              resultCount: 2,
              cpa: 10,
            },
          ],
        },
      ],
      entityDeltas: [
        {
          level: 'campaign',
          entityId: 'campaign-1',
          entityName: 'Messages Floripa',
          firstDate: '2026-06-01',
          lastDate: '2026-06-02',
          spendDelta: 170,
          resultDelta: 7,
          cpaDelta: -0.45,
          budgetDelta: 50,
          frequencyDelta: 2.5,
          latestChange: {
            entityId: 'adset-1',
            entityName: 'Topo',
            previousDailyBudget: 50,
            newDailyBudget: 60,
            deltaDailyBudget: 10,
            actor: 'cron',
            createdAt: '2026-06-02T09:00:00.000Z',
          },
        },
        {
          level: 'ad',
          entityId: 'ad-1',
          entityName: 'Creative A',
          parentCampaignName: 'Topo',
          firstDate: '2026-06-01',
          lastDate: '2026-06-02',
          spendDelta: 10,
          resultDelta: 1,
          cpaDelta: 0,
          budgetDelta: 0,
          frequencyDelta: 0,
        },
      ],
      campaignDeltas: [
        {
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          firstDate: '2026-06-01',
          lastDate: '2026-06-02',
          spendDelta: 170,
          resultDelta: 7,
          cpaDelta: -0.45,
          budgetDelta: 50,
          frequencyDelta: 2.5,
          latestChange: {
            entityId: 'adset-1',
            entityName: 'Topo',
            previousDailyBudget: 50,
            newDailyBudget: 60,
            deltaDailyBudget: 10,
            actor: 'cron',
            createdAt: '2026-06-02T09:00:00.000Z',
          },
        },
      ],
      changesByDay: [
        {
          date: '2026-06-02',
          totalDeltaDailyBudget: 10,
          changeCount: 1,
        },
      ],
    };

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    const table = screen.getAllByRole('table')[0];
    const dashboard = screen.getByTestId('meta-ads-evolution-dashboard');
    expect(screen.getByText('com_ui_project_meta_ads_evolution_analysis')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_evolution_comparison')).toBeInTheDocument();
    expect(
      table.compareDocumentPosition(dashboard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const evolutionChart = screen.getByTestId('meta-ads-evolution-chart');
    expect(evolutionChart).toBeInTheDocument();
    expect(evolutionChart).toHaveAttribute('preserveAspectRatio', 'none');
    expect(evolutionChart.querySelector('title')).toBeNull();
    const dailyPoint = screen
      .getAllByTestId('meta-ads-evolution-point')
      .find((point) => point.getAttribute('data-date') === '2026-06-01');
    expect(dailyPoint).toBeTruthy();
    expect(dailyPoint).toHaveClass('rounded-full');
    fireEvent.mouseEnter(dailyPoint as Element);
    const pointTooltip = screen.getByTestId('meta-ads-evolution-point-tooltip');
    expect(pointTooltip).toHaveTextContent('Messages Floripa');
    expect(pointTooltip).toHaveTextContent('01/06');
    expect(pointTooltip).toHaveTextContent('R$ 100,00');
    expect(pointTooltip).toHaveTextContent('4.00');
    expect(pointTooltip).toHaveTextContent('R$ 25,00');
    expect(pointTooltip).toHaveStyle('transform: translate(0, calc(-100% - 10px))');
    fireEvent.mouseLeave(dailyPoint as Element);
    expect(screen.queryByTestId('meta-ads-evolution-point-tooltip')).not.toBeInTheDocument();
    const rightPoint = screen
      .getAllByTestId('meta-ads-evolution-point')
      .find((point) => point.getAttribute('data-date') === '2026-06-02');
    expect(rightPoint).toBeTruthy();
    fireEvent.mouseEnter(rightPoint as Element);
    expect(screen.getByTestId('meta-ads-evolution-point-tooltip')).toHaveStyle(
      'transform: translate(-100%, calc(-100% - 10px))',
    );
    fireEvent.mouseLeave(rightPoint as Element);
    expect(screen.getByText('com_ui_project_meta_ads_best_evolution')).toBeInTheDocument();
    expect(screen.getAllByText('com_ui_project_meta_ads_budget_changes').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Messages Floripa').length).toBeGreaterThan(0);
    expect(
      Array.from(dashboard.querySelectorAll('[data-tooltip]')).map((node) =>
        node.getAttribute('data-tooltip'),
      ),
    ).toEqual(expect.arrayContaining(['Messages Floripa', 'Topo']));
    expect(dashboard.querySelectorAll('[data-tooltip="Messages Floripa"]').length).toBeGreaterThan(
      1,
    );
    expect(dashboard.querySelector('div[title="Messages Floripa"]')).not.toBeInTheDocument();
    expect(dashboard.querySelector('td[title="Messages Floripa"]')).not.toBeInTheDocument();
    expect(dashboard.querySelector('td[title="Topo"]')).not.toBeInTheDocument();
    expect(screen.getByText('+R$ 170,00')).toBeInTheDocument();
    expect(screen.getByText('+7.00')).toBeInTheDocument();
    expect(screen.getByText('-R$ 0,45')).toBeInTheDocument();
    expect(screen.getByText('+R$ 10,00')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('meta-ads-bi-level-filter'), {
      target: { value: 'ad' },
    });

    expect(dashboard).toHaveTextContent('Creative A');
    expect(
      within(dashboard).getByText('com_ui_project_meta_ads_budget_changes'),
    ).toBeInTheDocument();
  });

  it('shows a clean empty dashboard when trend has one point and zero deltas', () => {
    mockStatusData.trend = {
      points: [
        {
          date: '2026-06-01',
          campaignId: 'campaign-1',
          campaignName: '🔥 [MENSAGEM] Blumenau Remarketing',
          spend: 578.58,
          resultCount: 45,
          cpa: 12.86,
          dailyBudget: 30,
          frequency: 2.65,
        },
      ],
      campaignDeltas: [
        {
          campaignId: 'campaign-1',
          campaignName: '🔥 [MENSAGEM] Blumenau Remarketing',
          firstDate: '2026-06-01',
          lastDate: '2026-06-01',
          spendDelta: 0,
          resultDelta: 0,
          cpaDelta: 0,
          budgetDelta: 0,
          frequencyDelta: 0,
        },
      ],
      changesByDay: [],
    };

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(screen.getByTestId('meta-ads-evolution-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('meta-ads-evolution-chart')).not.toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_insufficient_evolution')).toBeInTheDocument();
    expect(screen.queryByText('🔥 [MENSAGEM] Blumenau Remarketing')).not.toBeInTheDocument();
  });

  it('keeps selection controls stable and exposes a selection toolbar', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-1',
        campaignName: 'Messages Floripa',
        spend: 230,
        dailyBudget: 100,
        editableBudgetLevel: 'campaign',
        budgetMode: 'CBO',
        adSets: [],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    const rowsBeforeSelection = screen.getAllByTestId('meta-ads-campaign-row');
    expect(screen.getByText('com_ui_project_meta_ads_selection_count')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_clear_selection')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('com_ui_project_meta_ads_select_campaign'));

    expect(screen.getAllByTestId('meta-ads-campaign-row')).toHaveLength(rowsBeforeSelection.length);
    expect(screen.getByText('com_ui_project_meta_ads_clear_selection')).toBeEnabled();
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_clear_selection'));
    expect(screen.getByText('com_ui_project_meta_ads_clear_selection')).toBeDisabled();
  });

  it('expands the metrics workspace without using sticky filters', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-1',
        campaignName: 'Messages Floripa',
        spend: 230,
        dailyBudget: 100,
        editableBudgetLevel: 'campaign',
        budgetMode: 'CBO',
        adSets: [],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    const workspace = screen.getByTestId('meta-ads-metrics-workspace');
    expect(workspace.className).not.toContain('sticky');
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_enter_fullscreen'));
    expect(screen.getByTestId('meta-ads-metrics-workspace').className).toContain('fixed');
    expect(screen.getByText('Messages Floripa')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('meta-ads-metrics-workspace').className).not.toContain('fixed');
  });

  it('selects and clears ad sets when selecting their campaign group', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-1',
        campaignName: 'Messages Floripa',
        spend: 230,
        dailyBudget: 100,
        editableBudgetLevel: 'adset',
        budgetMode: 'ABO',
        adSets: [
          {
            entityId: 'adset-1',
            entityName: 'Remarketing',
            spend: 120,
            dailyBudget: 50,
          },
          {
            entityId: 'adset-2',
            entityName: 'Lookalike',
            spend: 110,
            dailyBudget: 50,
          },
        ],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByLabelText('com_ui_project_meta_ads_select_campaign'));

    expect(screen.getByLabelText('com_ui_project_meta_ads_select_campaign')).toBeChecked();
    expect(screen.getAllByLabelText('com_ui_project_meta_ads_select_ad_set')).toHaveLength(2);
    screen
      .getAllByLabelText('com_ui_project_meta_ads_select_ad_set')
      .forEach((checkbox) => expect(checkbox).toBeChecked());

    fireEvent.click(screen.getByLabelText('com_ui_project_meta_ads_select_campaign'));

    expect(screen.getByLabelText('com_ui_project_meta_ads_select_campaign')).not.toBeChecked();
    screen
      .getAllByLabelText('com_ui_project_meta_ads_select_ad_set')
      .forEach((checkbox) => expect(checkbox).not.toBeChecked());
  });

  it('requires confirmation before sending a manual budget change', () => {
    mockStatusData.campaigns = [
      {
        campaignId: 'campaign-cbo',
        campaignName: 'CBO Messages',
        spend: 230,
        dailyBudget: 100,
        editableBudgetLevel: 'campaign',
        budgetMode: 'CBO',
        adSets: [],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByText('R$ 100,00'));
    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_new_budget'), {
      target: { value: '125' },
    });
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_save_budget'));

    expect(mockMutateBudget).not.toHaveBeenCalled();
    expect(screen.getByText('com_ui_project_meta_ads_confirm_budget_title')).toBeInTheDocument();

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_confirm_budget'));

    expect(mockMutateBudget).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        payload: expect.objectContaining({
          entityLevel: 'campaign',
          entityId: 'campaign-cbo',
          dailyBudget: 125,
        }),
      },
      expect.any(Object),
    );
  });

  it('shows budget change history', () => {
    mockStatusData.changes = [
      {
        _id: 'change-1',
        entityId: 'campaign-cbo',
        entityName: 'CBO Messages',
        entityLevel: 'campaign',
        previousDailyBudget: 100,
        newDailyBudget: 125,
        deltaDailyBudget: 25,
        deltaPercent: 25,
        actor: 'user',
        reason: 'manual-ui',
        createdAt: '2026-06-12T12:00:00.000Z',
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(screen.getByText('com_ui_project_meta_ads_history')).toBeInTheDocument();
    expect(screen.getByText('CBO Messages')).toBeInTheDocument();
    expect(screen.getByText('R$ 100,00 -> R$ 125,00')).toBeInTheDocument();
    expect(screen.getByText('+R$ 25,00 · +25.00%')).toBeInTheDocument();
  });

  it('renders global, group, and override rules in one list', () => {
    const projectWithRules = {
      ...project,
      metaAds: {
        enabled: true,
        ruleGroups: [
          {
            id: 'group-1',
            name: 'Prospecting group',
            entityLevel: 'campaign' as const,
            entityIds: ['campaign-1'],
            enabled: true,
            rules: {
              targetCpa: 45,
              minRoas: 2,
              maxIncreasePct: 15,
              maxDecreasePct: 20,
              minDailyBudget: 20,
              maxDailyBudget: 500,
              cooldownHours: 24,
              minSpend: 10,
            },
          },
        ],
        ruleOverrides: [
          {
            entityLevel: 'campaign' as const,
            entityId: 'campaign-2',
            entityName: 'Campaign override',
            enabled: true,
            rules: { targetCpa: 30 },
          },
          {
            entityLevel: 'adset' as const,
            entityId: 'adset-1',
            entityName: 'Ad set override',
            enabled: false,
            rules: { targetCpa: 25 },
          },
        ],
      },
    } as TProject;

    render(<ProjectMetaAdsPanel project={projectWithRules} canEdit={true} />);

    expect(screen.getAllByTestId('meta-ads-rule-row')).toHaveLength(4);
    expect(screen.getByText('com_ui_project_meta_ads_global_rules')).toBeInTheDocument();
    expect(screen.getByText('Prospecting group')).toBeInTheDocument();
    expect(screen.getByText('Campaign override')).toBeInTheDocument();
    expect(screen.getByText('Ad set override')).toBeInTheDocument();
    expect(screen.queryAllByLabelText('com_ui_project_meta_ads_delete_rule')).toHaveLength(3);
  });

  it('marks CPA and ROAS rule labels as individually optional in pt-BR and English', () => {
    expect(PortugueseBrazil.com_ui_project_meta_ads_target_cpa).toBe('CPA alvo (opcional)');
    expect(PortugueseBrazil.com_ui_project_meta_ads_min_roas).toBe('ROAS mínimo (opcional)');
    expect(English.com_ui_project_meta_ads_target_cpa).toBe('Target CPA (optional)');
    expect(English.com_ui_project_meta_ads_min_roas).toBe('Minimum ROAS (optional)');
  });

  it('shows hover hints for rule editor labels including cooldown behavior', () => {
    expect(PortugueseBrazil.com_ui_project_meta_ads_cooldown_hint).toContain(
      'aguarda antes de mudar o orçamento da mesma campanha ou conjunto novamente',
    );
    expect(English.com_ui_project_meta_ads_cooldown_hint).toContain(
      'waits before changing the budget for the same campaign or ad set again',
    );

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getAllByText('com_ui_project_meta_ads_create_rule_group')[0]);
    const ruleDrawer = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_global_rules',
    });

    expect(
      within(ruleDrawer).getByText('com_ui_project_meta_ads_target_cpa_hint'),
    ).toBeInTheDocument();
    expect(
      within(ruleDrawer).getByText('com_ui_project_meta_ads_min_roas_hint'),
    ).toBeInTheDocument();
    expect(
      within(ruleDrawer).getByText('com_ui_project_meta_ads_cooldown_hint'),
    ).toBeInTheDocument();
    expect(within(ruleDrawer).queryByTitle('com_ui_project_meta_ads_cooldown_hint')).toBeNull();
  });

  it('toggles global, group, and override rules through the unified list', () => {
    const projectWithRules = {
      ...project,
      metaAds: {
        enabled: true,
        ruleGroups: [
          {
            id: 'group-1',
            name: 'Prospecting group',
            entityLevel: 'campaign' as const,
            entityIds: ['campaign-1'],
            enabled: true,
            rules: { targetCpa: 45 },
          },
        ],
        ruleOverrides: [
          {
            entityLevel: 'campaign' as const,
            entityId: 'campaign-2',
            entityName: 'Campaign override',
            enabled: true,
            rules: { targetCpa: 30 },
          },
        ],
      },
    } as TProject;

    render(<ProjectMetaAdsPanel project={projectWithRules} canEdit={true} />);

    const rows = screen.getAllByTestId('meta-ads-rule-row');
    fireEvent.click(within(rows[0]).getByLabelText('com_ui_project_meta_ads_disable_rule'));
    expect(mockMutateSettings).toHaveBeenLastCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({ enabled: false }),
      },
      expect.any(Object),
    );

    fireEvent.click(within(rows[1]).getByLabelText('com_ui_project_meta_ads_disable_rule'));
    expect(mockMutateSettings).toHaveBeenLastCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          ruleGroups: [expect.objectContaining({ id: 'group-1', enabled: false })],
        }),
      },
      expect.any(Object),
    );

    fireEvent.click(within(rows[2]).getByLabelText('com_ui_project_meta_ads_disable_rule'));
    expect(mockMutateSettings).toHaveBeenLastCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          ruleOverrides: [
            expect.objectContaining({
              entityLevel: 'campaign',
              entityId: 'campaign-2',
              enabled: false,
            }),
          ],
        }),
      },
      expect.any(Object),
    );
  });

  it('edits global, group, and override rules from the drawer', () => {
    const projectWithRules = {
      ...project,
      metaAds: {
        enabled: true,
        rules: { targetCpa: 45 },
        creativeRules: { maxFrequency: 5 },
        ruleGroups: [
          {
            id: 'group-1',
            name: 'Old group',
            entityLevel: 'campaign' as const,
            entityIds: ['campaign-1'],
            enabled: true,
            rules: { targetCpa: 45 },
          },
        ],
        ruleOverrides: [
          {
            entityLevel: 'campaign' as const,
            entityId: 'campaign-2',
            entityName: 'Campaign override',
            enabled: true,
            rules: { targetCpa: 30 },
          },
        ],
      },
    } as TProject;

    render(<ProjectMetaAdsPanel project={projectWithRules} canEdit={true} />);

    const rows = screen.getAllByTestId('meta-ads-rule-row');
    fireEvent.click(within(rows[0]).getByLabelText('com_ui_project_meta_ads_edit_rule'));
    let ruleDrawer = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_global_rules',
    });
    fireEvent.change(within(ruleDrawer).getByLabelText('com_ui_project_meta_ads_target_cpa'), {
      target: { value: '60' },
    });
    fireEvent.change(
      within(ruleDrawer).getByLabelText('com_ui_project_meta_ads_max_frequency_alert'),
      {
        target: { value: '4' },
      },
    );
    fireEvent.click(within(ruleDrawer).getByText('com_ui_project_meta_ads_save_rule_group'));
    expect(mockMutateSettings).toHaveBeenLastCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          rules: expect.objectContaining({ targetCpa: 60 }),
          creativeRules: expect.objectContaining({ maxFrequency: 4 }),
        }),
      },
      expect.any(Object),
    );

    fireEvent.click(
      within(screen.getAllByTestId('meta-ads-rule-row')[1]).getByLabelText(
        'com_ui_project_meta_ads_edit_rule',
      ),
    );
    const ruleGroupDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_edit_rule_group',
    });
    fireEvent.change(
      within(ruleGroupDialog).getByLabelText('com_ui_project_meta_ads_rule_group_name'),
      {
        target: { value: 'New group' },
      },
    );
    fireEvent.click(within(ruleGroupDialog).getByText('com_ui_project_meta_ads_save_rule_group'));

    expect(mockMutateSettings).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          ruleGroups: [
            expect.objectContaining({
              id: 'group-1',
              name: 'New group',
            }),
          ],
        }),
      },
      expect.any(Object),
    );

    fireEvent.click(
      within(screen.getAllByTestId('meta-ads-rule-row')[2]).getByLabelText(
        'com_ui_project_meta_ads_edit_rule',
      ),
    );
    ruleDrawer = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_edit_rule_override',
    });
    fireEvent.change(within(ruleDrawer).getByLabelText('com_ui_project_meta_ads_target_cpa'), {
      target: { value: '35' },
    });
    fireEvent.click(within(ruleDrawer).getByText('com_ui_project_meta_ads_save_rule_group'));
    expect(mockMutateSettings).toHaveBeenLastCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          ruleOverrides: [
            expect.objectContaining({
              entityId: 'campaign-2',
              rules: expect.objectContaining({ targetCpa: 35 }),
            }),
          ],
        }),
      },
      expect.any(Object),
    );
  });

  it('saves a rule with only ROAS configured as the performance metric', () => {
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getAllByText('com_ui_project_meta_ads_create_rule_group')[0]);
    const ruleDrawer = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_global_rules',
    });
    fireEvent.change(within(ruleDrawer).getByLabelText('com_ui_project_meta_ads_target_cpa'), {
      target: { value: '' },
    });
    fireEvent.change(within(ruleDrawer).getByLabelText('com_ui_project_meta_ads_min_roas'), {
      target: { value: '3' },
    });
    fireEvent.click(within(ruleDrawer).getByText('com_ui_project_meta_ads_save_rule_group'));

    expect(mockMutateSettings).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          rules: expect.objectContaining({
            targetCpa: undefined,
            minRoas: 3,
          }),
        }),
      },
      expect.any(Object),
    );
  });

  it('saves a rule with only a guardrail metric configured', () => {
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getAllByText('com_ui_project_meta_ads_create_rule_group')[0]);
    const ruleDrawer = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_global_rules',
    });
    fireEvent.change(within(ruleDrawer).getByLabelText('com_ui_project_meta_ads_target_cpa'), {
      target: { value: '' },
    });
    fireEvent.change(within(ruleDrawer).getByLabelText('com_ui_project_meta_ads_min_roas'), {
      target: { value: '' },
    });
    fireEvent.change(within(ruleDrawer).getByLabelText('com_ui_project_meta_ads_max_cpc'), {
      target: { value: '1.5' },
    });
    fireEvent.click(within(ruleDrawer).getByText('com_ui_project_meta_ads_save_rule_group'));

    expect(mockMutateSettings).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          rules: expect.objectContaining({
            targetCpa: undefined,
            minRoas: undefined,
            maxCpc: 1.5,
          }),
        }),
      },
      expect.any(Object),
    );
  });

  it('blocks saving a rule without any performance metric', () => {
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getAllByText('com_ui_project_meta_ads_create_rule_group')[0]);
    const ruleDrawer = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_global_rules',
    });
    fireEvent.change(within(ruleDrawer).getByLabelText('com_ui_project_meta_ads_target_cpa'), {
      target: { value: '' },
    });
    fireEvent.change(within(ruleDrawer).getByLabelText('com_ui_project_meta_ads_min_roas'), {
      target: { value: '' },
    });
    fireEvent.click(within(ruleDrawer).getByText('com_ui_project_meta_ads_save_rule_group'));

    expect(mockMutateSettings).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'com_ui_project_meta_ads_metric_required',
      status: 'error',
    });
  });

  it('deletes group and override rules but not the global rule', () => {
    const projectWithRules = {
      ...project,
      metaAds: {
        enabled: true,
        ruleGroups: [
          {
            id: 'group-1',
            name: 'Old group',
            entityLevel: 'campaign' as const,
            entityIds: ['campaign-1'],
            enabled: true,
            rules: { targetCpa: 45 },
          },
        ],
        ruleOverrides: [
          {
            entityLevel: 'campaign' as const,
            entityId: 'campaign-2',
            entityName: 'Campaign override',
            enabled: true,
            rules: { targetCpa: 30 },
          },
        ],
      },
    } as TProject;

    render(<ProjectMetaAdsPanel project={projectWithRules} canEdit={true} />);

    const rows = screen.getAllByTestId('meta-ads-rule-row');
    expect(within(rows[0]).queryByLabelText('com_ui_project_meta_ads_delete_rule')).toBeNull();

    fireEvent.click(within(rows[1]).getByLabelText('com_ui_project_meta_ads_delete_rule'));

    expect(mockMutateSettings).toHaveBeenLastCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({ ruleGroups: [] }),
      },
      expect.any(Object),
    );

    fireEvent.click(within(rows[2]).getByLabelText('com_ui_project_meta_ads_delete_rule'));

    expect(mockMutateSettings).toHaveBeenLastCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({ ruleOverrides: [] }),
      },
      expect.any(Object),
    );
  });

  it('runs Meta Ads analysis with visible success feedback', () => {
    mockMutateRun.mockImplementationOnce((_projectId, options?: { onSuccess?: () => void }) =>
      options?.onSuccess?.(),
    );

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_run'));

    expect(mockMutateRun).toHaveBeenCalledWith('p1', expect.any(Object));
    expect(mockRefetchStatus).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'com_ui_project_meta_ads_run_success',
      status: 'success',
    });
  });

  it('shows Meta Ads analysis errors to the user', () => {
    mockMutateRun.mockImplementationOnce(
      (
        _projectId,
        options?: { onError?: (error: { response: { data: { message: string } } }) => void },
      ) =>
        options?.onError?.({
          response: {
            data: {
              message: 'Invalid JSON for postcard',
            },
          },
        }),
    );

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_run'));

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid JSON for postcard');
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'Invalid JSON for postcard',
      status: 'error',
    });
  });

  it('refetches status and shows feedback after applying a recommendation', () => {
    mockStatusData.recommendations = [
      {
        _id: 'r1',
        entityId: 'adset-1',
        entityName: 'Prospecting',
        action: 'increase',
        status: 'pending',
        currentDailyBudget: 100,
        proposedDailyBudget: 115,
      },
    ];
    mockMutateApply.mockImplementationOnce(
      (
        _payload,
        options?: {
          onSuccess?: () => void;
        },
      ) => options?.onSuccess?.(),
    );

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_apply'));

    expect(mockMutateApply).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        recommendationId: 'r1',
      },
      expect.any(Object),
    );
    expect(mockRefetchStatus).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'com_ui_project_meta_ads_apply_success',
      status: 'success',
    });
  });

  it('does not show an apply button for hold recommendations', () => {
    mockStatusData.recommendations = [
      {
        _id: 'r1',
        entityId: 'adset-1',
        entityName: 'Prospecting',
        action: 'hold',
        status: 'pending',
        currentDailyBudget: 100,
        proposedDailyBudget: 100,
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(screen.getByText('Prospecting')).toBeInTheDocument();
    expect(screen.queryByText('com_ui_project_meta_ads_apply')).not.toBeInTheDocument();
  });

  it('shows apply errors to the user', () => {
    mockStatusData.recommendations = [
      {
        _id: 'r1',
        entityId: 'adset-1',
        entityName: 'Prospecting',
        action: 'increase',
        status: 'pending',
        currentDailyBudget: 100,
        proposedDailyBudget: 115,
      },
    ];
    mockMutateApply.mockImplementationOnce(
      (
        _payload,
        options?: {
          onError?: (error: { response: { data: { message: string } } }) => void;
        },
      ) =>
        options?.onError?.({
          response: {
            data: {
              message: 'Meta budget changed since recommendation.',
            },
          },
        }),
    );

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_apply'));

    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'Meta budget changed since recommendation.',
      status: 'error',
    });
  });

  it('shows a masked token status when the Meta Ads secret is configured', () => {
    mockStatusData.credentials = {
      effectiveSource: 'tenant',
      projectConfigured: false,
      tenantConfigured: true,
      secretName: 'meta_graph_access_token',
    };

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(screen.getByText('com_ui_project_meta_ads_tenant_token_configured')).toBeInTheDocument();
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_account_credentials'));
    expect(screen.queryByText('********')).not.toBeInTheDocument();
    expect(screen.queryByText('com_ui_show_password')).not.toBeInTheDocument();
  });

  it('lets admins save the tenant global Meta Ads token from the credentials modal', () => {
    mockUserRole = 'ADMIN';
    mockStatusData.credentials = {
      effectiveSource: 'tenant',
      projectConfigured: false,
      tenantConfigured: true,
      secretName: 'meta_graph_access_token',
    };
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_account_credentials'));
    const accountDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_account_credentials',
    });
    fireEvent.click(within(accountDialog).getByText('com_ui_project_meta_ads_manage_tokens'));
    const credentialsDialog = screen.getAllByRole('dialog')[1];
    const token = `EAA${'b'.repeat(48)}`;

    expect(
      within(credentialsDialog).getByText('com_ui_project_meta_ads_global_token_title'),
    ).toBeInTheDocument();
    expect(
      within(credentialsDialog).getByText('com_ui_project_meta_ads_local_token_title'),
    ).toBeInTheDocument();

    fireEvent.change(
      within(credentialsDialog).getAllByPlaceholderText(
        'com_ui_project_meta_ads_token_placeholder',
      )[0],
      {
        target: { value: token },
      },
    );
    fireEvent.click(
      within(credentialsDialog).getByText('com_ui_project_meta_ads_save_tenant_token'),
    );

    expect(mockMutateTenantToken).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        metaAccessToken: token,
      },
      expect.any(Object),
    );
    expect(
      within(credentialsDialog).getAllByPlaceholderText(
        'com_ui_project_meta_ads_token_placeholder',
      )[0],
    ).toHaveValue('');
    expect(mockRefetchStatus).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'com_ui_saved',
      status: 'success',
    });
  });

  it('keeps tenant global token editing hidden from regular project editors', () => {
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_account_credentials'));
    const accountDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_account_credentials',
    });
    fireEvent.click(within(accountDialog).getByText('com_ui_project_meta_ads_manage_tokens'));
    const credentialsDialog = screen.getAllByRole('dialog')[1];

    expect(
      within(credentialsDialog).getByText('com_ui_project_meta_ads_global_token_title'),
    ).toBeInTheDocument();
    expect(
      within(credentialsDialog).getByText('com_ui_project_meta_ads_local_token_title'),
    ).toBeInTheDocument();
    expect(
      within(credentialsDialog).getByText('com_ui_project_meta_ads_tenant_token_admin_hint'),
    ).toBeInTheDocument();
    expect(
      within(credentialsDialog).queryByText('com_ui_project_meta_ads_save_tenant_token'),
    ).not.toBeInTheDocument();
  });

  it('shows a missing token status when the configured Meta Ads secret is absent', () => {
    mockStatusData.credentials = {
      effectiveSource: 'missing',
      projectConfigured: false,
      tenantConfigured: false,
      secretName: 'meta_graph_access_token_project_p1',
    };

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(screen.getByText('com_ui_project_meta_ads_token_missing')).toBeInTheDocument();
  });

  it('clears the project token reference when switching back to tenant token', () => {
    const projectWithToken = {
      ...project,
      metaAds: {
        tokenSecretName: 'meta_graph_access_token_project_p1',
      },
    };
    mockStatusData.credentials = {
      effectiveSource: 'project',
      projectConfigured: true,
      tenantConfigured: true,
      secretName: 'meta_graph_access_token_project_p1',
    };

    render(<ProjectMetaAdsPanel project={projectWithToken} canEdit={true} />);

    expect(
      screen.getByText('com_ui_project_meta_ads_project_token_configured'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_account_credentials'));
    const accountDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_account_credentials',
    });
    fireEvent.click(within(accountDialog).getByText('com_ui_project_meta_ads_manage_tokens'));
    const credentialsDialog = screen.getAllByRole('dialog')[1];
    fireEvent.click(
      within(credentialsDialog).getByText('com_ui_project_meta_ads_use_tenant_token'),
    );

    expect(mockMutateSettings).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({
          tokenSecretName: '',
          credentialMode: 'tenant_default',
        }),
      },
      expect.any(Object),
    );
  });

  it('shows the global token fallback action when status reports a project token', () => {
    mockStatusData.credentials = {
      effectiveSource: 'project',
      projectConfigured: true,
      tenantConfigured: true,
      secretName: 'meta_graph_access_token_project_p1',
    };

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_account_credentials'));
    const accountDialog = screen.getByRole('dialog', {
      name: 'com_ui_project_meta_ads_account_credentials',
    });
    fireEvent.click(within(accountDialog).getByText('com_ui_project_meta_ads_manage_tokens'));
    const credentialsDialog = screen.getAllByRole('dialog')[1];

    expect(
      within(credentialsDialog).getByText('com_ui_project_meta_ads_use_tenant_token'),
    ).toBeInTheDocument();
  });
});
