import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ProjectMetaAdsPanel from '../ProjectMetaAdsPanel';

const mockMutateSettings = jest.fn();
const mockMutateRun = jest.fn();
const mockMutateApply = jest.fn();

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/data-provider', () => ({
  useProjectMetaAdsQuery: () => ({
    data: {
      latestSnapshots: [],
      recommendations: [],
      changes: [],
    },
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
      }),
    });
  });
});
