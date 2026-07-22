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
  setRunNoticeMessage: (message: string | null) => void;
  setRunNoticeStatus: (status: 'success' | 'error') => void;
};

export function useMetaAdsRunAnalysis({
  projectId,
  runAnalysis,
  statusQuery,
  localize,
  showToast,
  setRunNoticeMessage,
  setRunNoticeStatus,
}: UseMetaAdsRunAnalysisParams) {
  return () => {
    setRunNoticeMessage(null);
    runAnalysis.mutate(projectId, {
      onSuccess: (data) => {
        statusQuery.refetch();
        const message =
          Array.isArray(data?.messages) && data.messages.length > 0
            ? data.messages[0]
            : localize('com_ui_project_meta_ads_run_success');
        setRunNoticeStatus('success');
        setRunNoticeMessage(message);
        showToast({
          message,
          status: 'success',
        });
      },
      onError: (error) => {
        const message = getRequestErrorMessage(
          error,
          localize('com_ui_project_meta_ads_run_failed'),
        );
        setRunNoticeStatus('error');
        setRunNoticeMessage(message);
        showToast({ message, status: 'error' });
        logger.error('MetaAds', 'Failed to run project Meta Ads analysis', {
          projectId,
          error,
        });
      },
    });
  };
}
