import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { replaceSpecialVars } from 'librechat-data-provider';
import type { TPromptGroup } from 'librechat-data-provider';
import { useChatContext, useChatFormContext, useAddedChatContext } from '~/Providers';
import { useAuthContext } from '~/hooks/AuthContext';
import store from '~/store';

export default function useSubmitMessage() {
  const { user } = useAuthContext();
  const methods = useChatFormContext();
  const { conversation: addedConvo } = useAddedChatContext();
  const { ask, index, getMessages, setMessages } = useChatContext();
  const latestMessage = useRecoilValue(store.latestMessageFamily(index));

  const activeHiddenPrompt = useRecoilValue(store.activeHiddenPromptByIndex(index));
  const setActiveHiddenPrompt = useSetRecoilState(store.activeHiddenPromptByIndex(index));

  const submitMessage = useCallback(
    (data?: { text: string }) => {
      if (!data && !activeHiddenPrompt) {
        return console.warn('No data provided to submitMessage');
      }
      const rawText = data?.text?.trim() ?? '';
      if (!rawText && !activeHiddenPrompt) {
        return console.warn('No message text provided to submitMessage');
      }
      const text =
        activeHiddenPrompt && (!rawText || rawText.startsWith('/'))
          ? activeHiddenPrompt.name
          : rawText;
      const rootMessages = getMessages();
      const isLatestInRootMessages = rootMessages?.some(
        (message) => message.messageId === latestMessage?.messageId,
      );
      if (!isLatestInRootMessages && latestMessage) {
        setMessages([...(rootMessages || []), latestMessage]);
      }

      ask(
        {
          text,
          hiddenPromptContext: activeHiddenPrompt,
        },
        {
          addedConvo: addedConvo ?? undefined,
        },
      );
      setActiveHiddenPrompt(null);
      methods.reset();
    },
    [
      ask,
      methods,
      addedConvo,
      setMessages,
      getMessages,
      latestMessage,
      activeHiddenPrompt,
      setActiveHiddenPrompt,
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
