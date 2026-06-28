import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import { useProjectMetaAdsQuery } from '../queries';

const mockGetProjectMetaAdsStatus = jest.fn();

jest.mock('librechat-data-provider', () => ({
  QueryKeys: {
    projectMetaAds: 'projectMetaAds',
  },
  dataService: {
    getProjectMetaAdsStatus: (...args: unknown[]) => mockGetProjectMetaAdsStatus(...args),
  },
  EModelEndpoint: {},
  isAgentsEndpoint: jest.fn(() => false),
  defaultOrderQuery: {},
  defaultAssistantsVersion: 'v2',
}));

jest.mock('~/utils', () => ({
  findConversationInInfinite: jest.fn(),
  isNotFoundError: jest.fn(() => false),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useProjectMetaAdsQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-28T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses fresh localStorage status without refetching immediately', async () => {
    const data = {
      latestSnapshots: [],
      recommendations: [],
      changes: [],
    };
    localStorage.setItem(
      'orqest:project-meta-ads-status:v2:p1:last_7d:none:none',
      JSON.stringify({
        cachedAt: Date.now() - 5 * 60 * 1000,
        data,
      }),
    );

    const { result } = renderHook(() => useProjectMetaAdsQuery('p1', { datePreset: 'last_7d' }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual(data));
    expect(mockGetProjectMetaAdsStatus).not.toHaveBeenCalled();
  });
});
