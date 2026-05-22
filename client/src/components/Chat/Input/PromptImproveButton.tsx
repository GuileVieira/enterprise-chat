import React, { useCallback, useMemo, useRef, useState } from 'react';
import { MagicWand } from '@phosphor-icons/react';
import { Spinner, TooltipAnchor, useToastContext } from '@librechat/client';
import { useImprovePromptMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

type PromptImproveButtonProps = {
  text: string | undefined;
  disabled: boolean;
  setText: (value: string) => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
};

const MIN_WORDS = 3;

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

const PromptImproveButton = React.memo(function PromptImproveButton({
  text,
  disabled,
  setText,
  textAreaRef,
}: PromptImproveButtonProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const improvePrompt = useImprovePromptMutation();
  const lastImprovedWordCountRef = useRef<number | null>(null);
  const [isImproving, setIsImproving] = useState(false);
  const [hasError, setHasError] = useState(false);
  const currentText = text ?? '';
  const currentWordCount = countWords(currentText);
  const requiredWordCount = lastImprovedWordCountRef.current;
  const needsMoreWords =
    requiredWordCount != null && currentWordCount < requiredWordCount + MIN_WORDS;
  const isDisabled = useMemo(
    () =>
      disabled ||
      isImproving ||
      improvePrompt.isLoading ||
      currentWordCount < MIN_WORDS ||
      needsMoreWords,
    [currentWordCount, disabled, improvePrompt.isLoading, isImproving, needsMoreWords],
  );

  const handleClick = useCallback(async () => {
    const originalText = currentText;
    if (countWords(originalText) < MIN_WORDS || needsMoreWords) {
      return;
    }

    try {
      setHasError(false);
      setIsImproving(true);
      const result = await improvePrompt.mutateAsync({ text: originalText });
      lastImprovedWordCountRef.current = countWords(result.improvedText);
      setText(result.improvedText);
      showToast({ message: localize('com_ui_prompt_improved'), status: 'success' });
      textAreaRef.current?.focus();
    } catch {
      textAreaRef.current?.focus();
      setHasError(true);
      showToast({ message: localize('com_ui_improve_prompt_failed'), status: 'error' });
    } finally {
      setIsImproving(false);
    }
  }, [currentText, improvePrompt, localize, needsMoreWords, setText, showToast, textAreaRef]);

  const tooltipText = useMemo(() => {
    if (isImproving || improvePrompt.isLoading) {
      return localize('com_ui_improving_prompt');
    }
    if (needsMoreWords) {
      return localize('com_ui_improve_prompt_add_words');
    }
    if (hasError) {
      return localize('com_ui_improve_prompt_failed');
    }
    return localize('com_ui_improve_prompt');
  }, [hasError, improvePrompt.isLoading, isImproving, localize, needsMoreWords]);

  return (
    <TooltipAnchor
      description={tooltipText}
      render={
        <button
          type="button"
          aria-label={localize('com_ui_improve_prompt')}
          disabled={isDisabled}
          onClick={handleClick}
          className={cn(
            'rounded-full p-2 text-text-secondary outline-offset-4 transition-all duration-200 hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30',
          )}
          data-testid="prompt-improve-button"
        >
          {isImproving || improvePrompt.isLoading ? (
            <Spinner className="h-[22px] w-[22px]" />
          ) : (
            <MagicWand size={22} />
          )}
        </button>
      }
    />
  );
});

export default PromptImproveButton;
