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
      'orqest:project-meta-ads-status:v3:p1:live:last_7d:none:none',
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

  it('keeps snapshot and live status caches separate', async () => {
    const snapshotData = {
      source: 'snapshot',
      latestSnapshots: [],
      recommendations: [],
      changes: [],
    };
    const liveData = {
      source: 'live',
      latestSnapshots: [],
      recommendations: [],
      changes: [],
    };
    localStorage.setItem(
      'orqest:project-meta-ads-status:v3:p1:snapshot:last_7d:none:none',
      JSON.stringify({
        cachedAt: Date.now() - 5 * 60 * 1000,
        data: snapshotData,
      }),
    );
    localStorage.setItem(
      'orqest:project-meta-ads-status:v3:p1:live:last_7d:none:none',
      JSON.stringify({
        cachedAt: Date.now() - 5 * 60 * 1000,
        data: liveData,
      }),
    );

    const { result: snapshotResult } = renderHook(
      () => useProjectMetaAdsQuery('p1', { datePreset: 'last_7d', scope: 'snapshot' }),
      { wrapper },
    );
    const { result: liveResult } = renderHook(
      () => useProjectMetaAdsQuery('p1', { datePreset: 'last_7d', scope: 'live' }),
      { wrapper },
    );

    await waitFor(() => expect(snapshotResult.current.data).toEqual(snapshotData));
    await waitFor(() => expect(liveResult.current.data).toEqual(liveData));
    expect(mockGetProjectMetaAdsStatus).not.toHaveBeenCalled();
  });
});
