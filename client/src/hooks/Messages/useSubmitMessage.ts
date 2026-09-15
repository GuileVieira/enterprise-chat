import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { replaceSpecialVars } from 'librechat-data-provider';
import type { TPromptGroup } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import { useChatContext, useChatFormContext, useAddedChatContext } from '~/Providers';
import { useGetLatestMessage } from '~/hooks/Messages/useLatestMessage';
import { useAuthContext } from '~/hooks/AuthContext';
import store from '~/store';

export default function useSubmitMessage() {
  const { user } = useAuthContext();
  const methods = useChatFormContext();
  const { conversation: addedConvo } = useAddedChatContext();
  const { ask, index, files, getMessages, setMessages } = useChatContext();
  const getLatestMessage = useGetLatestMessage(index);

  const activeHiddenPrompt = useRecoilValue(store.activeHiddenPromptByIndex(index));
  const setActiveHiddenPrompt = useSetRecoilState(store.activeHiddenPromptByIndex(index));

  const submitMessage = useCallback(
    (data?: {
      text: string;
      overrideFiles?: TMessage['files'];
      overrideQuotes?: string[];
      overrideManualSkills?: string[];
      overrideClientRequestId?: string;
      overrideRecoverySteerId?: string;
      overrideExpectedPredecessorCreatedAt?: number;
      overrideQueuedMessageOrigin?: unknown;
    }) => {
      if (!data && !activeHiddenPrompt) {
        return console.warn('No data provided to submitMessage');
      }
      const rawText = data?.text?.trim() ?? '';
      const hasAttachedFiles = (data?.overrideFiles?.length ?? files?.size ?? 0) > 0;
      if (!rawText && !activeHiddenPrompt && !hasAttachedFiles) {
        return console.warn('No message text provided to submitMessage');
      }
      const text =
        activeHiddenPrompt && (!rawText || rawText.startsWith('/'))
          ? activeHiddenPrompt.name
          : rawText;
      const latestMessage = getLatestMessage();
      const rootMessages = getMessages();
      const isLatestInRootMessages = rootMessages?.some(
        (message) => message.messageId === latestMessage?.messageId,
      );
      if (!isLatestInRootMessages && latestMessage) {
        setMessages([...(rootMessages || []), latestMessage]);
      }

      const submitted = ask(
        {
          text,
          ...(activeHiddenPrompt ? { hiddenPromptContext: activeHiddenPrompt } : {}),
          ...(data?.overrideRecoverySteerId != null && {
            overrideUserMessageId: data.overrideRecoverySteerId,
          }),
        },
        {
          addedConvo: addedConvo ?? undefined,
          // Queued during-run messages carry their own consumed attachments,
          // quote chips, and manual skill picks (undefined = drain composer).
          overrideFiles: data?.overrideFiles,
          overrideQuotes: data?.overrideQuotes,
          overrideManualSkills: data?.overrideManualSkills,
          overrideClientRequestId: data?.overrideClientRequestId,
          overrideRecoverySteerId: data?.overrideRecoverySteerId,
          overrideExpectedPredecessorCreatedAt: data?.overrideExpectedPredecessorCreatedAt,
          overrideQueuedMessageOrigin: data?.overrideQueuedMessageOrigin,
        },
      );
      if (submitted === false) {
        return false;
      }
      setActiveHiddenPrompt(null);
      methods.reset();
    },
    [
      ask,
      methods,
      addedConvo,
      setMessages,
      getMessages,
      getLatestMessage,
      activeHiddenPrompt,
      setActiveHiddenPrompt,
      files,
    ],
  );

  const submitPrompt = useCallback(
    (text: string, group?: TPromptGroup) => {
      const parsedText = replaceSpecialVars({ text, user });
      setActiveHiddenPrompt({
        name: group?.name ?? 'Prompt',
        content: parsedText,
        promptGroupId: group?._id,
        promptId: group?.productionId ?? undefined,
        description: group?.oneliner ?? undefined,
      });
    },
    [setActiveHiddenPrompt, user],
  );

  return { submitMessage, submitPrompt };
}
