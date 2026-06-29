import React from 'react';
import { RecoilRoot } from 'recoil';
import { renderHook, act } from '@testing-library/react';
import { EModelEndpoint } from 'librechat-data-provider';
import type { TConversation, TEndpointsConfig } from 'librechat-data-provider';
import useSelectMention from './useSelectMention';

const mockNewConversation = jest.fn();

jest.mock('~/hooks', () => ({
  useDefaultConvo: () =>
    jest.fn(({ conversation, preset }) => ({
      ...conversation,
      ...preset,
    })),
}));

const endpointsConfig = {
  [EModelEndpoint.openAI]: {
    order: 0,
    type: EModelEndpoint.openAI,
  },
} satisfies TEndpointsConfig;

const existingConversation: TConversation = {
  conversationId: 'c1',
  title: 'Conversation One',
  createdAt: '2026-06-29T00:00:00.000Z',
  updatedAt: '2026-06-29T00:00:00.000Z',
  endpoint: EModelEndpoint.openAI,
  model: 'gpt-4',
  projectId: 'p1',
};

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(RecoilRoot, null, children);
}

describe('useSelectMention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves conversation and project when selecting a model in an existing conversation', () => {
    const { result } = renderHook(
      () =>
        useSelectMention({
          modelSpecs: [],
          returnHandlers: true,
          endpointsConfig,
          getConversation: () => existingConversation,
          newConversation: mockNewConversation,
        }),
      { wrapper },
    );

    const { onSelectEndpoint } = result.current;
    expect(onSelectEndpoint).toBeDefined();
    if (!onSelectEndpoint) {
      throw new Error('onSelectEndpoint handler missing');
    }

    act(() => {
      onSelectEndpoint(EModelEndpoint.openAI, { model: 'gpt-4o' });
    });

    expect(mockNewConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        template: expect.objectContaining({
          conversationId: 'c1',
          projectId: 'p1',
          endpoint: EModelEndpoint.openAI,
          model: 'gpt-4o',
        }),
        preset: expect.objectContaining({
          endpoint: EModelEndpoint.openAI,
          model: 'gpt-4o',
          spec: null,
        }),
      }),
    );
  });
});
