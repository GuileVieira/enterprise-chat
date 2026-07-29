import { SpinnerGap } from '@phosphor-icons/react';

import type { useLocalize } from '~/hooks';

import { MetaAdsButton } from './ui';

type Localize = ReturnType<typeof useLocalize>;

type MetaAdsRunAnalysisButtonProps = {
  disabled: boolean;
  running: boolean;
  localize: Localize;
  onClick: () => void;
};

export function MetaAdsRunAnalysisButton({
  disabled,
  running,
  localize,
  onClick,
}: MetaAdsRunAnalysisButtonProps) {
  return (
    <MetaAdsButton
      disabled={disabled || running}
      aria-busy={running}
      className="inline-flex items-center gap-2"
      onClick={onClick}
    >
      {running && <SpinnerGap className="h-4 w-4 animate-spin" aria-hidden="true" />}
      <span>
        {localize(
          running ? 'com_ui_project_meta_ads_running_analysis' : 'com_ui_project_meta_ads_run',
        )}
      </span>
    </MetaAdsButton>
  );
}

export function MetaAdsRunAnalysisStatus({
  running,
  localize,
}: {
  running: boolean;
  localize: Localize;
}) {
  if (!running) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="m-5 mb-0 flex items-center gap-2 border border-amber-300/35 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100"
    >
      <SpinnerGap className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{localize('com_ui_project_meta_ads_run_status')}</span>
    </div>
  );
}
