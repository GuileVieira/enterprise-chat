import { useCallback } from 'react';
import { useToastContext } from '@librechat/client';
import { usePinConversationMutation } from '~/data-provider';
import { NotificationSeverity } from '~/common';
import { useLocalize } from '~/hooks';

export const CONVERSATION_DRAG_TYPE = 'conversation-item';

/** Which kind of target the pointer was over most recently.
 *
 *  `monitor.didDrop()` alone cannot tell a reorder from a drop outside the
 *  pinned list. Tracking the last hovered surface prevents incidental row
 *  movement from being persisted when the drag ends elsewhere. */
let lastHoverWasExternal = false;

/** Called by the pinned rows, whose hover is what reorders the list. */
export const markPinnedHover = (): void => {
  lastHoverWasExternal = false;
};

/** Called when the pointer leaves the pinned reorder surface. */
export const markExternalHover = (): void => {
  lastHoverWasExternal = true;
};

export const beginPinnedDrag = (): void => {
  lastHoverWasExternal = false;
};

export const endedOverExternalTarget = (): boolean => lastHoverWasExternal;

export type ConversationDragItem = {
  conversationId: string;
  pinned: boolean;
};

/** Unpins a dropped conversation, if it was pinned at all. */
export type UnpinDroppedConversation = (item: ConversationDragItem) => void;

/** Unpins a dragged conversation, for a drop on the plain Chats list: a chat
 *  landing there is being asked to be an ordinary chat, which a pinned one is
 *  not. Silent on success — the row leaving the pinned section is the feedback
 *  — and reports only the failure, as the row badge does. */
export const useUnpinDroppedConversation = (): UnpinDroppedConversation => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const pinConversation = usePinConversationMutation();

  return useCallback(
    (item: ConversationDragItem) => {
      const conversationId = item.conversationId;
      if (!conversationId || item.pinned !== true) {
        return;
      }
      pinConversation.mutate(
        { conversationId, pinned: false },
        {
          onError: () =>
            showToast({
              message: localize('com_ui_unpin_error'),
              severity: NotificationSeverity.ERROR,
              showIcon: true,
            }),
        },
      );
    },
    [pinConversation, localize, showToast],
  );
};

/** Whether a hover should reorder yet. Rows only swap once the pointer crosses
 *  the hovered row's midpoint: without the threshold a shorter dragged row
 *  keeps re-entering the taller row it just displaced, and the list oscillates
 *  under a cursor that never moved. */
export const shouldSwapOnHover = ({
  dragIndex,
  hoverIndex,
  pointerY,
  hoverTop,
  hoverBottom,
}: {
  dragIndex: number;
  hoverIndex: number;
  pointerY: number;
  hoverTop: number;
  hoverBottom: number;
}): boolean => {
  if (dragIndex < 0 || hoverIndex < 0 || dragIndex === hoverIndex) {
    return false;
  }
  const middleY = (hoverBottom - hoverTop) / 2;
  const offsetY = pointerY - hoverTop;
  if (dragIndex < hoverIndex) {
    return offsetY >= middleY;
  }
  return offsetY <= middleY;
};

/** Which group of the Pinned section a stored key belongs to. The section
 *  orders its two kinds independently, so a merge has to know them apart. */
const keyKind = (key: string): 'convo' | 'favorite' =>
  key.startsWith('convo:') ? 'convo' : 'favorite';

/**
 * Rewrites only the slots the visible keys occupy in the stored order, so a
 * reorder performed while a filter hides part of the list keeps every hidden
 * key exactly where it was instead of dropping it. Visible keys the stored
 * order does not know about append after their own kind.
 *
 * The stored order is grouped first, because that is how the section reads it
 * back, and each kind is then substituted within its own run. An order saved
 * before the kinds were kept apart can interleave them, and merging across that
 * interleaving let a reorder of two visible chats carry a hidden chat between
 * them across a favorite — moving a row nobody had touched once the rest of the
 * pinned list finally arrived.
 */
export const mergeVisibleOrder = (stored: string[], visible: string[]): string[] => {
  const visibleSet = new Set(visible);
  const kinds: Array<'favorite' | 'convo'> = ['favorite', 'convo'];
  return kinds.flatMap((kind) => {
    const slots = stored.filter((key) => keyKind(key) === kind);
    const incoming = visible.filter((key) => keyKind(key) === kind);
    const merged: string[] = [];
    let next = 0;
    for (const key of slots) {
      if (!visibleSet.has(key)) {
        merged.push(key);
        continue;
      }
      if (next < incoming.length) {
        merged.push(incoming[next]);
        next += 1;
      }
    }
    /* Keys the stored order never held, such as a row pinned since it was
     * written. */
    for (; next < incoming.length; next += 1) {
      merged.push(incoming[next]);
    }
    return merged;
  });
};
