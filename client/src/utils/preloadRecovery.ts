const PRELOAD_RELOAD_KEY = 'orqest:preload-reload';

export const clearPreloadReload = () => sessionStorage.removeItem(PRELOAD_RELOAD_KEY);

export const recoverFromPreloadError = (
  event: Event,
  reload: () => void = () => window.location.reload(),
) => {
  if (sessionStorage.getItem(PRELOAD_RELOAD_KEY) === window.location.href) {
    return;
  }

  event.preventDefault();
  sessionStorage.setItem(PRELOAD_RELOAD_KEY, window.location.href);
  reload();
};
