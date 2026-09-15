import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRecoilCallback, useRecoilValue } from 'recoil';
import { Spinner, useToastContext } from '@librechat/client';
import { useParams, useSearchParams } from 'react-router-dom';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import {
  Constants,
  EModelEndpoint,
  PermissionBits,
  isAgentsEndpoint,
  isEphemeralAgentId,
} from 'librechat-data-provider';
import type { TPreset, TAgentsMap } from 'librechat-data-provider';
import {
  defaultSpecAwaitsAgents,
  mergeQuerySettingsWithSpec,
  processValidSettings,
  getDefaultModelSpec,
  getModelSpecPreset,
  hasModelSelection,
  isNotFoundError,
  isTemporaryConversation,
  logger,
  clearMessagesCache,
} from '~/utils';
import {
  useGetConvoIdQuery,
  useGetStartupConfig,
  useGetEndpointsQuery,
  useListAgentsQuery,
} from '~/data-provider';
import {
  useAssistantListMap,
  useIdChangeEffect,
  useAppStartup,
  useNewConvo,
  useLocalize,
} from '~/hooks';
import { ToolCallsMapProvider, useAgentsMapContext } from '~/Providers';
import ChatView from '~/components/Chat/ChatView';
import { NotificationSeverity } from '~/common';
import useAuthRedirect from './useAuthRedirect';
import temporaryStore from '~/store/temporary';
import store from '~/store';

export default function ChatRoute() {
  const { data: startupConfig } = useGetStartupConfig();
  const { isAuthenticated, user, roles } = useAuthRedirect();
  const queryClient = useQueryClient();

  const defaultTemporaryChat = useRecoilValue(temporaryStore.defaultTemporaryChat);
  const setIsTemporary = useRecoilCallback(
    ({ set }) =>
      (value: boolean) => {
        set(temporaryStore.isTemporary, value);
      },
    [],
  );
  const index = 0;
  const [searchParams] = useSearchParams();
  const { conversationId = '' } = useParams();
  useIdChangeEffect(conversationId);
  const { hasSetConversation, conversation } = store.useCreateConversationAtom(index);
  const mcpWarmupAllowed =
    conversation != null &&
    !(isAgentsEndpoint(conversation.endpoint) && isEphemeralAgentId(conversation.agent_id ?? ''));
  useAppStartup({ startupConfig, user, mcpWarmupAllowed });
  const { newConversation } = useNewConvo();
  const { showToast } = useToastContext();
  const localize = useLocalize();
  const modelsQuery = useGetModelsQuery({
    enabled: isAuthenticated,
    refetchOnMount: 'always',
  });
  const initialConvoQuery = useGetConvoIdQuery(conversationId, {
    enabled:
      isAuthenticated && conversationId !== Constants.NEW_CONVO && !hasSetConversation.current,
  });
  const endpointsQuery = useGetEndpointsQuery({ enabled: isAuthenticated });
  const assistantListMap = useAssistantListMap();
  /** The map comes from Root's shared context (one mapping pass app-wide); the
   * select-less observer only tracks settle state. Only a loaded list may
   * invalidate a stored agent pick: on a transient catalog failure (retries are
   * disabled) the map stays unknown, the pick stays trusted, and the gate below
   * releases so the landing never hangs on the error. */
  const agentsMap: TAgentsMap | undefined = useAgentsMapContext();
  const agentsQuery = useListAgentsQuery(
    { requiredPermission: PermissionBits.VIEW },
    { enabled: isAuthenticated },
  );

  const isTemporaryChat = isTemporaryConversation(conversation);

  useEffect(() => {
    if (conversationId === Constants.NEW_CONVO) {
      setIsTemporary(defaultTemporaryChat);
    } else if (isTemporaryChat) {
      setIsTemporary(isTemporaryChat);
    } else {
      setIsTemporary(false);
    }
  }, [conversationId, isTemporaryChat, setIsTemporary, defaultTemporaryChat]);

  /** This effect is mainly for the first conversation state change on first load of the page.
   *  Adjusting this may have unintended consequences on the conversation state.
   */
  useEffect(() => {
    // Wait for roles to load so hasAgentAccess has a definitive value in useNewConvo
    const rolesLoaded = roles?.USER != null;
    const isNewConvo = conversationId === Constants.NEW_CONVO;
    const shouldSetConvo =
      (startupConfig && rolesLoaded && !hasSetConversation.current && !modelsQuery.data?.initial) ??
      false;
    /* Early exit if startupConfig is not loaded and conversation is already set and only initial models have loaded */
    if (!shouldSetConvo) {
      return;
    }

    const queryParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key !== 'prompt' && key !== 'q' && key !== 'submit') {
        queryParams[key] = value;
      }
    });
    const querySettings = processValidSettings(queryParams);

    const notFoundConvo =
      Boolean(conversationId) &&
      !isNewConvo &&
      initialConvoQuery.isError &&
      isNotFoundError(initialConvoQuery.error);

    /** A stored agent pick can only be validated against the loaded agent list
     * (it may name an agent since deleted, or one from another org sharing this
     * browser storage). Defer the first conversation until the list settles.
     * A URL naming its own selection skips the wait only on the new-chat branch,
     * where it takes precedence over the stored pick; the 404 fallback never
     * applies query settings, so it always waits. */
    const awaitsAgentList =
      agentsMap == null &&
      !agentsQuery.isError &&
      defaultSpecAwaitsAgents(startupConfig, endpointsQuery.data);
    if (awaitsAgentList && (notFoundConvo || (isNewConvo && !hasModelSelection(querySettings)))) {
      return;
    }

    const getNewConvoPreset = () => {
      /** A spec named in the URL is an explicit selection: it must resolve to its own
       * full preset, or stale last-selection state (endpoint/agent) fills the gaps.
       * Names absent from the client config (e.g. `showInMenu: false`) stay in the
       * query settings untouched, since they remain resolvable server-side by name. */
      const urlSpec = querySettings.spec
        ? startupConfig?.modelSpecs?.list?.find((spec) => spec.name === querySettings.spec)
        : undefined;

      const result = urlSpec
        ? undefined
        : getDefaultModelSpec(startupConfig, endpointsQuery.data, agentsMap);
      const spec = urlSpec ?? result?.default ?? result?.last ?? result?.softDefault;
      const specPreset = spec ? getModelSpecPreset(spec) : undefined;

      if (Object.keys(querySettings).length > 0) {
        return mergeQuerySettingsWithSpec(specPreset, querySettings);
      }
      return specPreset;
    };

    if (isNewConvo && endpointsQuery.data && modelsQuery.data) {
      const preset = getNewConvoPreset();

      logger.log('conversation', 'ChatRoute, new convo effect', conversation);
      clearMessagesCache(queryClient, conversation?.conversationId);
      newConversation({
        modelsData: modelsQuery.data,
        ...(preset ? { preset } : {}),
      });

      hasSetConversation.current = true;
    } else if (initialConvoQuery.data && endpointsQuery.data && modelsQuery.data) {
      logger.log('conversation', 'ChatRoute initialConvoQuery', initialConvoQuery.data);
      newConversation({
        template: initialConvoQuery.data,
        /* this is necessary to load all existing settings */
        preset: initialConvoQuery.data as TPreset,
        modelsData: modelsQuery.data,
      });
      hasSetConversation.current = true;
    } else if (
      conversationId &&
      endpointsQuery.data &&
      modelsQuery.data &&
      initialConvoQuery.isError &&
      isNotFoundError(initialConvoQuery.error)
    ) {
      const result = getDefaultModelSpec(startupConfig, endpointsQuery.data, agentsMap);
      const spec = result?.default ?? result?.last ?? result?.softDefault;
      showToast({
        message: localize('com_ui_conversation_not_found'),
        severity: NotificationSeverity.WARNING,
      });
      logger.log(
        'conversation',
        'ChatRoute initialConvoQuery isNotFoundError',
        initialConvoQuery.error,
      );
      newConversation({
        modelsData: modelsQuery.data,
        ...(spec ? { preset: getModelSpecPreset(spec) } : {}),
      });
      hasSetConversation.current = true;
    } else if (
      isNewConvo &&
      assistantListMap[EModelEndpoint.assistants] &&
      assistantListMap[EModelEndpoint.azureAssistants]
    ) {
      const preset = getNewConvoPreset();

      logger.log('conversation', 'ChatRoute new convo, assistants effect', conversation);
      clearMessagesCache(queryClient, conversation?.conversationId);
      newConversation({
        modelsData: modelsQuery.data,
        ...(preset ? { preset } : {}),
      });
      hasSetConversation.current = true;
    } else if (
      assistantListMap[EModelEndpoint.assistants] &&
      assistantListMap[EModelEndpoint.azureAssistants]
    ) {
      logger.log('conversation', 'ChatRoute convo, assistants effect', initialConvoQuery.data);
      newConversation({
        template: initialConvoQuery.data,
        preset: initialConvoQuery.data as TPreset,
        modelsData: modelsQuery.data,
      });
      hasSetConversation.current = true;
    }
    /* Creates infinite render if all dependencies included due to newConversation invocations exceeding call stack before hasSetConversation.current becomes truthy */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    roles,
    agentsMap,
    agentsQuery.isError,
    startupConfig,
    initialConvoQuery.data,
    initialConvoQuery.isError,
    endpointsQuery.data,
    modelsQuery.data,
    assistantListMap,
    queryClient,
    conversation?.conversationId,
  ]);

  if (endpointsQuery.isLoading || modelsQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" aria-live="polite" role="status">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // if not a conversation
  if (conversation?.conversationId === Constants.SEARCH) {
    return null;
  }
  // if conversationId not match
  if (conversation?.conversationId !== conversationId && !conversation) {
    return null;
  }
  // if conversationId is null
  if (!conversationId) {
    return null;
  }

  return (
    <ToolCallsMapProvider conversationId={conversation.conversationId ?? ''}>
      <ChatView index={index} />
    </ToolCallsMapProvider>
  );
}
