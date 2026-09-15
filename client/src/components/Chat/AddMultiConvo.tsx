import { TooltipAnchor } from '@librechat/client';
import { PlusCircle } from '@phosphor-icons/react';
import useMultiConvo from '~/hooks/Chat/useMultiConvo';
import { useLocalize } from '~/hooks';

function AddMultiConvo() {
  const localize = useLocalize();
  const { show, addConversation } = useMultiConvo();

  if (!show) {
    return null;
  }

  return (
    <TooltipAnchor
      description={localize('com_ui_add_multi_conversation')}
      render={
        <button
          type="button"
          aria-label={localize('com_ui_add_multi_conversation')}
          onClick={addConversation}
          data-testid="add-multi-convo-button"
          className="inline-flex size-9 flex-shrink-0 items-center justify-center rounded-xl border border-border-light bg-presentation text-text-primary transition-all ease-in-out hover:bg-surface-tertiary disabled:pointer-events-none disabled:opacity-50 radix-state-open:bg-surface-tertiary"
        >
          <PlusCircle className="icon-sm" aria-hidden="true" />
        </button>
      }
    />
  );
}

export default AddMultiConvo;
