import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ProjectMetaAdsStatus, TProject } from 'librechat-data-provider';
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
const mockNavigate = jest.fn();
const mockRefetchStatus = jest.fn();
const mockShowToast = jest.fn();
let mockStatusQueryState = {};
let mockUserRole = 'USER';
const mockUseProjectMetaAdsQuery = jest.fn((_projectId?: string, _params?: unknown) => ({
  data: mockStatusData,
  refetch: mockRefetchStatus,
  ...mockStatusQueryState,
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
    mockUserRole = 'USER';
    mockUseProjectMetaAdsQuery.mockClear();
    delete mockStatusData.campaigns;
    delete mockStatusData.credentials;
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

  it('accepts numeric ad account input and saves a pasted project token outside metaAds', async () => {
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

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

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_create_rule_group'));
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

    expect(screen.getByText('Messages Floripa')).toBeInTheDocument();
    expect(screen.queryByText('Topo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('com_ui_project_meta_ads_expand_campaign'));

    expect(screen.getByText('Topo')).toBeInTheDocument();
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
    expect(screen.getByText('com_ui_project_meta_ads_results')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_table_view')).toBeInTheDocument();
    expect(screen.getByDisplayValue('com_ui_project_meta_ads_view_summary')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_objective')).toBeInTheDocument();
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

    const cboCampaignRow = screen
      .getByText('CBO Messages')
      .closest('[data-testid="meta-ads-campaign-row"]');
    expect(cboCampaignRow).not.toBeNull();

    expect(screen.getAllByText('com_ui_project_meta_ads_budget_defined').length).toBeGreaterThan(0);
    fireEvent.click(within(cboCampaignRow as HTMLElement).getByText('R$ 100,00'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('15% = R$ 115,00')).toBeInTheDocument();
    expect(screen.getByText('20% = R$ 120,00')).toBeInTheDocument();
    expect(screen.getByText('30% = R$ 130,00')).toBeInTheDocument();
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

  it('renders ad thumbnails and opens a complete ad preview modal with metrics', () => {
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
                creativeId: 'creative-1',
                title: 'Book a private visit',
                body: 'Pick an open time and tour the model unit.',
                description: 'Limited slots this week',
                thumbnailUrl: 'https://example.com/thumb.jpg',
                imageUrl: 'https://example.com/image.jpg',
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
              },
            ],
          },
        ],
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(screen.getByText('com_ui_project_meta_ads_level_campaign')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_level_ad_set')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_level_ad')).toBeInTheDocument();
    expect(screen.getByText('Visit schedule creative')).toBeInTheDocument();
    expect(screen.getByText('Book a private visit')).toBeInTheDocument();
    expect(screen.getByAltText('Visit schedule creative')).toHaveAttribute(
      'src',
      'https://example.com/thumb.jpg',
    );

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_collapse_all'));
    expect(screen.queryByTestId('meta-ads-ad-card-ad-1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_expand_all'));
    expect(screen.getByTestId('meta-ads-ad-card-ad-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('meta-ads-ad-card-ad-1'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_ad_preview')).toBeInTheDocument();
    expect(screen.getByText('Pick an open time and tour the model unit.')).toBeInTheDocument();
    expect(screen.getByText('Limited slots this week')).toBeInTheDocument();
    expect(screen.getByText('LEARN_MORE')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/visit')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 48,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R$ 12,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4.00').length).toBeGreaterThan(0);
    expect(screen.getByText('1,800')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('com_ui_project_meta_ads_hide_ads'));
    expect(screen.queryByTestId('meta-ads-ad-card-ad-1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('com_ui_project_meta_ads_show_ads'));
    expect(screen.getByTestId('meta-ads-ad-card-ad-1')).toBeInTheDocument();
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
    expect(screen.getByText('R$ 13,69')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 15,00').length).toBeGreaterThan(0);
    expect(screen.getByText('25 65+ ARTES')).toBeInTheDocument();

    const adSetRow = screen.getByText('25 65+ ARTES').closest('tr');
    expect(adSetRow).not.toBeNull();
    expect(adSetRow).toHaveTextContent('-');
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
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_create_rule_group'));

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
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_create_rule_group'));

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

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_project_meta_ads_frequency' }));
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
    expect(screen.getByText('com_ui_project_meta_ads_total_spend')).toBeInTheDocument();
    expect(screen.getByText('R$ 300,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 25,00')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('com_ui_project_meta_ads_period'), {
      target: { value: 'last_30d' },
    });

    expect(mockUseProjectMetaAdsQuery).toHaveBeenLastCalledWith('p1', {
      datePreset: 'last_30d',
    });
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

    const table = screen.getByRole('table');
    const dashboard = screen.getByTestId('meta-ads-evolution-dashboard');
    expect(screen.getByText('com_ui_project_meta_ads_evolution')).toBeInTheDocument();
    expect(
      table.compareDocumentPosition(dashboard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByTestId('meta-ads-evolution-chart')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_best_evolution')).toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_budget_changes')).toBeInTheDocument();
    expect(screen.getByText('Messages Floripa')).toBeInTheDocument();
    expect(screen.getByText('+R$ 170,00')).toBeInTheDocument();
    expect(screen.getByText('+7.00')).toBeInTheDocument();
    expect(screen.getByText('-R$ 0,45')).toBeInTheDocument();
    expect(screen.getByText('+R$ 10,00')).toBeInTheDocument();
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

    expect(screen.queryByTestId('meta-ads-evolution-dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('com_ui_project_meta_ads_insufficient_evolution')).toBeInTheDocument();
    expect(screen.queryByText('🔥 [MENSAGEM] Blumenau Remarketing')).not.toBeInTheDocument();
    expect(screen.queryByText('R$ 0,00')).not.toBeInTheDocument();
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
    expect(workspace.className).toContain('fixed');
    expect(screen.getByText('Messages Floripa')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(workspace.className).not.toContain('fixed');
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

  it('edits and removes existing rule groups', () => {
    const projectWithRuleGroup = {
      ...project,
      metaAds: {
        ruleGroups: [
          {
            id: 'group-1',
            name: 'Old group',
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
      },
    } as TProject;

    render(<ProjectMetaAdsPanel project={projectWithRuleGroup} canEdit={true} />);

    expect(screen.getByText('Old group')).toBeInTheDocument();
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_edit_rule_group'));
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

    mockMutateSettings.mockClear();
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_delete_rule_group'));

    expect(mockMutateSettings).toHaveBeenCalledWith(
      {
        projectId: 'p1',
        metaAds: expect.objectContaining({ ruleGroups: [] }),
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
