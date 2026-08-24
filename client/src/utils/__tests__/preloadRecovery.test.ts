import { clearPreloadReload, recoverFromPreloadError } from '../preloadRecovery';

describe('preload recovery', () => {
  beforeEach(() => sessionStorage.clear());

  it('reloads once for the same URL and preserves a repeated error', () => {
    const firstEvent = new Event('vite:preloadError', { cancelable: true });
    const repeatedEvent = new Event('vite:preloadError', { cancelable: true });
    const reload = jest.fn();

    recoverFromPreloadError(firstEvent, reload);
    recoverFromPreloadError(repeatedEvent, reload);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(firstEvent.defaultPrevented).toBe(true);
    expect(repeatedEvent.defaultPrevented).toBe(false);

    clearPreloadReload();
    recoverFromPreloadError(new Event('vite:preloadError', { cancelable: true }), reload);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
