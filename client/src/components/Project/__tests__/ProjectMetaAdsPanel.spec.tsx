import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ProjectMetaAdsPanel from '../ProjectMetaAdsPanel';

const mockMutateSettings = jest.fn();
const mockMutateRun = jest.fn();
const mockMutateApply = jest.fn();
const mockNavigate = jest.fn();
const mockStatusData = {
  latestSnapshots: [],
  recommendations: [],
  changes: [],
};
const mockStartupConfig = {
  interface: {
    metaAdsTrafficAgentId: 'traffic-agent-1',
  },
};

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({
    data: mockStartupConfig,
  }),
  useProjectMetaAdsQuery: () => ({
    data: mockStatusData,
  }),
  useUpdateProjectMetaAdsMutation: () => ({
    mutate: mockMutateSettings,
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
}));

const project = {
  projectId: 'p1',
  name: 'Project',
  user: 'u1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ProjectMetaAdsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockStatusData.latestSnapshots = [];
    mockStatusData.recommendations = [];
    mockStatusData.changes = [];
    delete mockStatusData.credentials;
    mockStartupConfig.interface.metaAdsTrafficAgentId = 'traffic-agent-1';
  });

  it('accepts numeric ad account input and saves act_ format with project token secret', () => {
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.change(screen.getByPlaceholderText('123456789'), {
      target: { value: '123-456-789' },
    });
    fireEvent.change(screen.getByPlaceholderText('meta_graph_access_token_project_p1'), {
      target: { value: 'meta_graph_access_token_project_p1' },
    });
    fireEvent.click(screen.getByText('com_ui_save'));

    expect(mockMutateSettings).toHaveBeenCalledWith({
      projectId: 'p1',
      metaAds: expect.objectContaining({
        adAccountId: 'act_123456789',
        tokenSecretName: 'meta_graph_access_token_project_p1',
        credentialMode: 'project_secret',
        scheduleIntervalMinutes: 180,
      }),
    });
  });

  it('saves a selected schedule interval', () => {
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.change(screen.getByDisplayValue('com_ui_project_meta_ads_schedule_180'), {
      target: { value: '30' },
    });
    fireEvent.click(screen.getByText('com_ui_save'));

    expect(mockMutateSettings).toHaveBeenCalledWith({
      projectId: 'p1',
      metaAds: expect.objectContaining({
        scheduleIntervalMinutes: 30,
      }),
    });
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
        action: 'increase',
        status: 'pending',
        proposedDailyBudget: 115,
        reason: 'CPA below target.',
      },
    ];

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.click(screen.getByLabelText('com_ui_project_meta_ads_select_ad_set'));
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

  it('shows a masked token status when the Meta Ads secret is configured', () => {
    mockStatusData.credentials = {
      configured: true,
      secretName: 'meta_graph_access_token',
      source: 'tenant',
    };

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(screen.getByText('com_ui_project_meta_ads_token_configured')).toBeInTheDocument();
    expect(screen.getByText('********')).toBeInTheDocument();
  });

  it('shows a missing token status when the configured Meta Ads secret is absent', () => {
    mockStatusData.credentials = {
      configured: false,
      secretName: 'meta_graph_access_token_project_p1',
      source: 'project',
    };

    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    expect(screen.getByText('com_ui_project_meta_ads_token_missing')).toBeInTheDocument();
  });

  it('blocks saving when a Meta token value is pasted as the token secret name', () => {
    render(<ProjectMetaAdsPanel project={project} canEdit={true} />);

    fireEvent.change(screen.getByPlaceholderText('meta_graph_access_token_project_p1'), {
      target: { value: `EAA${'a'.repeat(48)}` },
    });
    fireEvent.click(screen.getByText('com_ui_save'));

    expect(screen.getByText('com_ui_project_meta_ads_token_secret_name_error')).toBeInTheDocument();
    expect(mockMutateSettings).not.toHaveBeenCalled();
  });
});
