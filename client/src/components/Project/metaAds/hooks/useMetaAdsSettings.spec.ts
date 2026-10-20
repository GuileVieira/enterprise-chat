import { renderHook, act } from '@testing-library/react';
import { logger } from '~/utils';
import { useMetaAdsSettings } from './useMetaAdsSettings';

jest.mock('~/utils', () => ({ logger: { debug: jest.fn(), error: jest.fn() } }));

it('shows the settings failure reason without logging the request token', () => {
  const showToast = jest.fn();
  const mutate = jest.fn();
  const params = {
    project: { projectId: 'p1' },
    statusQuery: {},
    updateSettings: { mutate },
    updateBudget: {},
    updateTenantToken: {},
    localize: (key: string) => key,
    showToast,
  } as Parameters<typeof useMetaAdsSettings>[0];
  const { result } = renderHook(() => useMetaAdsSettings(params));
  act(() => result.current.saveSettings(result.current.settings, 'DO_NOT_EXPORT_TOKEN'));
  const error = Object.assign(new Error('Request failed with status code 400'), {
    response: {
      data: {
        message: 'Invalid Meta Ads creative rules.',
        details: ['pauseHighCost.minCreativesInScope'],
      },
    },
    config: { data: { metaAccessToken: 'DO_NOT_EXPORT_TOKEN' } },
  });
  act(() => mutate.mock.calls[0][1].onError(error));
  expect(showToast).toHaveBeenCalledWith({
    message: 'Invalid Meta Ads creative rules. (pauseHighCost.minCreativesInScope)',
    status: 'error',
  });
  expect(logger.error).toHaveBeenCalledWith('MetaAds', 'Failed to save project Meta Ads settings', {
    projectId: 'p1',
    message: 'Invalid Meta Ads creative rules. (pauseHighCost.minCreativesInScope)',
  });
});
