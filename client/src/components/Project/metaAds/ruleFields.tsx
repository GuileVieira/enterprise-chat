import { Info } from '@phosphor-icons/react';
import type { TranslationKeys } from '~/hooks';
import type { Localize } from './types';

export function RuleFieldLabel({
  labelKey,
  hintKey,
  localize,
}: {
  labelKey: TranslationKeys;
  hintKey: TranslationKeys;
  localize: Localize;
}) {
  return (
    <span className="group/rule-label relative inline-flex w-fit max-w-full items-center gap-1.5">
      <span>{localize(labelKey)}</span>
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/10 text-[#948b7d] transition group-hover/rule-label:border-amber-300/40 group-hover/rule-label:text-amber-100"
      >
        <Info size={11} weight="bold" />
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-64 border border-white/10 bg-[#1b1812] p-2 text-[11px] normal-case leading-4 tracking-normal text-[#d8d0c2] shadow-xl group-focus-within/rule-label:block group-hover/rule-label:block"
      >
        {localize(hintKey)}
      </span>
    </span>
  );
}
