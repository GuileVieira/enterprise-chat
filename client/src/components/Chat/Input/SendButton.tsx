import React, { forwardRef } from 'react';
import { useRecoilValue } from 'recoil';
import { useWatch } from 'react-hook-form';
import { ArrowUp } from '@phosphor-icons/react';
import { TooltipAnchor } from '@librechat/client';
import type { Control } from 'react-hook-form';
import { cn, isSubmittableMessage } from '~/utils';
import { useLocalize } from '~/hooks';
import store from '~/store';

type SendButtonProps = {
  disabled: boolean;
  control: Control<{ text: string }>;
  index: number;
  /** Number of attached files; attachments allow sending without text */
  fileCount?: number;
};

const SubmitButton = React.memo(
  forwardRef((props: { disabled: boolean }, ref: React.ForwardedRef<HTMLButtonElement>) => {
    const localize = useLocalize();
    return (
      <TooltipAnchor
        description={localize('com_nav_send_message')}
        render={
          <button
            ref={ref}
            aria-label={localize('com_nav_send_message')}
            id="send-button"
            disabled={props.disabled}
            className={cn(
              'size-theme-control rounded-theme-control-round bg-text-primary p-theme-compact text-text-primary outline-offset-4 transition-all duration-theme-normal disabled:cursor-not-allowed disabled:text-text-secondary disabled:opacity-10',
            )}
            data-testid="send-button"
            type="submit"
          >
            <span className="" data-state="closed">
              <ArrowUp size={24} weight="bold" className="text-surface-primary" />
            </span>
          </button>
        }
      />
    );
  }),
);

const SendButton = React.memo(
  forwardRef((props: SendButtonProps, ref: React.ForwardedRef<HTMLButtonElement>) => {
    const data = useWatch({ control: props.control });
    const activeHiddenPrompt = useRecoilValue(store.activeHiddenPromptByIndex(props.index));
    const canSubmit = isSubmittableMessage(data?.text, props.fileCount) || !!activeHiddenPrompt;
    return <SubmitButton ref={ref} disabled={props.disabled || !canSubmit} />;
  }),
);

export default SendButton;
