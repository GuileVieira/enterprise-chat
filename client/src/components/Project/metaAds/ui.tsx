import { forwardRef } from 'react';
import { TooltipAnchor } from '@librechat/client';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { DotsThreeVertical } from '@phosphor-icons/react';
import { cn } from '~/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
type BadgeVariant = 'default' | 'success' | 'muted' | 'warning' | 'danger' | 'info';
type PanelVariant = 'default' | 'muted' | 'modalTile';

const inputClassName =
  'w-full min-w-0 rounded-xl border border-slate-200/90 bg-white/90 px-3 font-medium text-slate-800 outline-none transition duration-200 placeholder:text-slate-400 hover:border-teal-400/60 focus:border-teal-400 focus:ring-4 focus:ring-teal-400/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-teal-300/45 dark:focus:border-teal-300 dark:focus:ring-teal-300/15';

const buttonClassNames: Record<ButtonVariant, string> = {
  secondary:
    'h-10 rounded-xl border border-slate-200/90 bg-white/80 px-3 text-xs font-semibold text-slate-700 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.42)] transition duration-200 hover:-translate-y-0.5 hover:border-teal-300/70 hover:bg-white hover:text-slate-950 active:translate-y-px disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-200 dark:hover:border-teal-300/45 dark:hover:bg-white/[0.09] dark:hover:text-white',
  ghost:
    'h-10 rounded-xl border border-transparent px-3 text-xs font-semibold text-slate-500 transition duration-200 hover:border-slate-200 hover:bg-white/70 hover:text-slate-900 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.06] dark:hover:text-slate-100',
  primary:
    'h-10 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white shadow-[0_18px_40px_-26px_rgba(15,23,42,0.75)] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-px disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:shadow-[0_18px_44px_-30px_rgba(255,255,255,0.6)] dark:hover:bg-teal-50',
  danger:
    'h-10 rounded-xl border border-red-300/60 bg-red-50 px-3 text-xs font-semibold text-red-700 transition duration-200 hover:-translate-y-0.5 hover:border-red-400 hover:bg-red-100 active:translate-y-px disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100 dark:hover:border-red-300/45 dark:hover:bg-red-400/15',
  icon: 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white/80 text-slate-600 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.42)] transition duration-200 hover:-translate-y-0.5 hover:border-teal-300/70 hover:bg-white hover:text-slate-950 active:translate-y-px disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-200 dark:hover:border-teal-300/45 dark:hover:bg-white/[0.09] dark:hover:text-white',
};

const badgeClassNames: Record<BadgeVariant, string> = {
  default:
    'border-slate-200 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300',
  success:
    'border-teal-300/40 bg-teal-50 text-teal-700 dark:border-teal-300/20 dark:bg-teal-400/10 dark:text-teal-100',
  muted:
    'border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-400',
  warning:
    'border-amber-300/40 bg-amber-50 text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100',
  danger:
    'border-red-300/40 bg-red-50 text-red-700 dark:border-red-300/20 dark:bg-red-400/10 dark:text-red-100',
  info: 'border-sky-300/40 bg-sky-50 text-sky-700 dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-100',
};

const panelClassNames: Record<PanelVariant, string> = {
  default:
    'rounded-2xl border border-slate-200/80 bg-white/78 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.42)] backdrop-blur-xl dark:border-white/10 dark:bg-[#182238]/78 dark:shadow-[0_18px_70px_-54px_rgba(8,13,28,0.95)]',
  muted:
    'rounded-2xl border border-slate-200/75 bg-slate-50/80 shadow-[0_16px_46px_-42px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.045]',
  modalTile:
    'rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_14px_36px_-32px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#172033]',
};

export const metaAdsLabelClassName =
  'min-h-7 text-[11px] font-semibold uppercase leading-tight tracking-[0.14em] text-slate-500 dark:text-slate-400';

export const metaAdsInputClassName = cn(inputClassName, 'h-10 text-xs');
export const metaAdsInputLargeClassName = cn(inputClassName, 'h-11 text-sm');
export const metaAdsButtonClassName = buttonClassNames.secondary;
export const metaAdsGhostButtonClassName = buttonClassNames.ghost;
export const metaAdsPrimaryButtonClassName = buttonClassNames.primary;
export const metaAdsPanelClassName = panelClassNames.default;
export const metaAdsMutedPanelClassName = panelClassNames.muted;
export const metaAdsModalTileClassName = panelClassNames.modalTile;

type MetaAdsButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export const MetaAdsButton = forwardRef<HTMLButtonElement, MetaAdsButtonProps>(
  ({ className, variant = 'secondary', type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonClassNames[variant], className)} {...props} />
  ),
);
MetaAdsButton.displayName = 'MetaAdsButton';

type MetaAdsFieldProps = LabelHTMLAttributes<HTMLLabelElement> & {
  label: string;
  hint?: string;
  cooldown?: string;
};

export function MetaAdsField({
  label,
  hint,
  cooldown,
  className,
  children,
  ...props
}: MetaAdsFieldProps) {
  return (
    <label
      className={cn('flex min-w-0 flex-col justify-end gap-1 text-xs text-[#bdb5a6]', className)}
      {...props}
    >
      <MetaAdsHintLabel label={label} hint={hint} cooldown={cooldown} />
      {children}
    </label>
  );
}

type MetaAdsHintLabelProps = {
  label: string;
  hint?: string;
  cooldown?: string;
  className?: string;
};

export function MetaAdsHintLabel({ label, hint, cooldown, className }: MetaAdsHintLabelProps) {
  const content = cooldown ? `${hint ? `${hint} ` : ''}${cooldown}` : hint;

  if (!content) {
    return <span className={cn(metaAdsLabelClassName, className)}>{label}</span>;
  }

  return (
    <span className={cn(metaAdsLabelClassName, 'inline-flex items-center gap-1', className)}>
      {label}
      <TooltipAnchor
        description={content}
        render={
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] normal-case tracking-normal text-slate-500 dark:border-white/15 dark:text-slate-400">
            ?
          </span>
        }
      />
    </span>
  );
}

type MetaAdsInputProps = InputHTMLAttributes<HTMLInputElement> & {
  sizeVariant?: 'sm' | 'lg';
};

export const MetaAdsInput = forwardRef<HTMLInputElement, MetaAdsInputProps>(
  ({ className, sizeVariant = 'sm', ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        sizeVariant === 'lg' ? metaAdsInputLargeClassName : metaAdsInputClassName,
        className,
      )}
      {...props}
    />
  ),
);
MetaAdsInput.displayName = 'MetaAdsInput';

export const MetaAdsSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(metaAdsInputClassName, className)} {...props} />
  ),
);
MetaAdsSelect.displayName = 'MetaAdsSelect';

export const MetaAdsTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(inputClassName, 'min-h-24 py-3 text-sm', className)}
    {...props}
  />
));
MetaAdsTextarea.displayName = 'MetaAdsTextarea';

type MetaAdsBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function MetaAdsBadge({ className, variant = 'default', ...props }: MetaAdsBadgeProps) {
  return (
    <span
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-semibold',
        badgeClassNames[variant],
        className,
      )}
      {...props}
    />
  );
}

type MetaAdsPanelProps = HTMLAttributes<HTMLDivElement> & {
  variant?: PanelVariant;
};

export function MetaAdsPanel({ className, variant = 'default', ...props }: MetaAdsPanelProps) {
  return <div className={cn(panelClassNames[variant], className)} {...props} />;
}

type MetaAdsMetricCardProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string;
  context?: string;
};

export function MetaAdsMetricCard({
  label,
  value,
  context,
  className,
  ...props
}: MetaAdsMetricCardProps) {
  return (
    <MetaAdsPanel className={cn('p-4', className)} {...props}>
      <div className={metaAdsLabelClassName}>{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</div>
      {context && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{context}</div>}
    </MetaAdsPanel>
  );
}

export function MetaAdsDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-slate-200/75 px-5 py-4 dark:border-white/10 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

type MetaAdsStatusToggleProps = MetaAdsButtonProps & {
  enabled: boolean;
  enabledLabel: string;
  disabledLabel: string;
};

export function MetaAdsStatusToggle({
  enabled,
  enabledLabel,
  disabledLabel,
  className,
  ...props
}: MetaAdsStatusToggleProps) {
  return (
    <MetaAdsButton
      className={cn(
        enabled ? 'border-teal-300/50 text-teal-700 dark:text-teal-100' : '',
        className,
      )}
      {...props}
    >
      {enabled ? enabledLabel : disabledLabel}
    </MetaAdsButton>
  );
}

type MetaAdsActionMenuButtonProps = MetaAdsButtonProps & {
  label: string;
};

export function MetaAdsActionMenuButton({
  label,
  className,
  children,
  ...props
}: MetaAdsActionMenuButtonProps) {
  return (
    <MetaAdsButton aria-label={label} variant="icon" className={className} {...props}>
      {children ?? <DotsThreeVertical className="h-4 w-4" aria-hidden="true" />}
    </MetaAdsButton>
  );
}
