import type { useProjectMetaAdsQuery, useRunProjectMetaAdsMutation } from '~/data-provider';
import { logger } from '~/utils';
import { getRequestErrorMessage } from '../errors';
import type { Localize } from '../types';

type ToastStatus = 'success' | 'error' | 'warning' | 'info';

type UseMetaAdsRunAnalysisParams = {
  projectId: string;
  runAnalysis: ReturnType<typeof useRunProjectMetaAdsMutation>;
  statusQuery: ReturnType<typeof useProjectMetaAdsQuery>;
  localize: Localize;
  showToast: (toast: { message: string; status: ToastStatus }) => void;
  setRunErrorMessage: (message: string | null) => void;
};

export function useMetaAdsRunAnalysis({
  projectId,
  runAnalysis,
  statusQuery,
  localize,
  showToast,
  setRunErrorMessage,
}: UseMetaAdsRunAnalysisParams) {
  return () => {
    setRunErrorMessage(null);
    runAnalysis.mutate(projectId, {
      onSuccess: () => {
        statusQuery.refetch();
        showToast({
          message: localize('com_ui_project_meta_ads_run_success'),
          status: 'success',
        });
      },
      onError: (error) => {
        const message = getRequestErrorMessage(
          error,
          localize('com_ui_project_meta_ads_run_failed'),
        );
        setRunErrorMessage(message);
        showToast({ message, status: 'error' });
        logger.error('MetaAds', 'Failed to run project Meta Ads analysis', {
          projectId,
          error,
        });
      },
    });
  };
}
