import React from 'react';
import axios from 'axios';
import { act, renderHook } from '@testing-library/react';
import { QueryKeys, DynamicQueryKeys } from 'librechat-data-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useSharedMemoryImportMutation,
  useUpdateSharedMemoryMutation,
} from '../SharedMemories/queries';

it('invalidates personal, project, library and context data after an import', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const keys = [
    DynamicQueryKeys.sharedMemories({ search: 'tone' }),
    [QueryKeys.memories, 'user'],
    [QueryKeys.project, 'p1'],
    [QueryKeys.projects],
    [QueryKeys.projectLegacyMemoryCandidates, 'p1'],
    [QueryKeys.sharedMemoryContextStatus, 'p1'],
    [QueryKeys.memoryDeletionImpact],
  ];
  keys.forEach((key) => client.setQueryData(key, { stale: false }));
  const spy = jest.spyOn(axios, 'post').mockResolvedValue({
    data: {
      operationId: 'op',
      items: [],
      totals: { created: 0, updated: 0, skipped: 0, failed: 0 },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  try {
    const { result } = renderHook(() => useSharedMemoryImportMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        operationId: 'op',
        destination: { type: 'personal' },
        format: 'json',
        content: '{}',
      });
    });
    keys.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
  } finally {
    spy.mockRestore();
    client.clear();
  }
});

it('invalidates cached originals after an optimistic update conflict', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const key = DynamicQueryKeys.sharedMemories({});
  client.setQueryData(key, { items: [{ id: 'm1', value: 'old' }] });
  const patch = jest
    .spyOn(axios, 'patch')
    .mockRejectedValue({ isAxiosError: true, response: { status: 409 } });
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  try {
    const { result } = renderHook(() => useUpdateSharedMemoryMutation(), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'm1',
          key: 'tone',
          value: 'draft',
          expectedUpdatedAt: '2026-01-01',
        }),
      ).rejects.toMatchObject({ response: { status: 409 } });
    });
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  } finally {
    patch.mockRestore();
    log.mockRestore();
    client.clear();
  }
});
