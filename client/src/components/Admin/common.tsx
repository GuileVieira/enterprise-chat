import React from 'react';
import { X } from 'lucide-react';
import { cn } from '~/utils';

interface AdminPageHeaderProps {
  title: string;
  description: string;
  eyebrow?: string;
  action?: React.ReactNode;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  action,
  eyebrow,
  description,
}) => (
  <div className="flex flex-col gap-4 border-b border-border-light pb-6 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-2xl">
      {eyebrow != null && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
          {eyebrow}
        </p>
      )}
      <h1 className="text-balance text-3xl font-semibold leading-tight text-text-primary">
        {title}
      </h1>
      <p className="mt-2 max-w-[65ch] text-sm leading-6 text-text-secondary">{description}</p>
    </div>
    {action != null && <div className="shrink-0">{action}</div>}
  </div>
);

interface AdminPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ children, className, ...props }) => (
  <section
    className={cn(
      'overflow-hidden rounded-xl border border-border-light bg-surface-secondary shadow-sm shadow-black/5',
      className,
    )}
    {...props}
  >
    {children}
  </section>
);

interface AdminActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
}

export const AdminActionButton = React.forwardRef<HTMLButtonElement, AdminActionButtonProps>(
  ({ icon, children, className, variant = 'primary', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' &&
          'bg-surface-submit text-white shadow-sm shadow-green-900/10 hover:bg-surface-submit-hover',
        variant === 'ghost' && 'bg-surface-tertiary text-text-primary hover:bg-surface-active-alt',
        variant === 'danger' &&
          'bg-surface-destructive text-white hover:bg-surface-destructive-hover',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  ),
);
AdminActionButton.displayName = 'AdminActionButton';

interface AdminIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'neutral' | 'danger';
}

export const AdminIconButton = React.forwardRef<HTMLButtonElement, AdminIconButtonProps>(
  ({ label, children, className, tone = 'neutral', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-md text-text-secondary transition-all duration-200 hover:bg-surface-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-95 disabled:pointer-events-none disabled:opacity-50',
        tone === 'danger' && 'hover:bg-red-500/10 hover:text-red-500',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
AdminIconButton.displayName = 'AdminIconButton';

interface AdminBadgeProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'danger' | 'accent';
  className?: string;
}

export const AdminBadge: React.FC<AdminBadgeProps> = ({
  children,
  className,
  tone = 'neutral',
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold leading-none',
      tone === 'neutral' && 'bg-surface-tertiary text-text-secondary',
      tone === 'success' && 'bg-green-500/10 text-green-700 dark:text-green-300',
      tone === 'danger' && 'bg-red-500/10 text-red-700 dark:text-red-300',
      tone === 'accent' && 'bg-surface-active text-text-primary',
      className,
    )}
  >
    {children}
  </span>
);

interface AdminEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const AdminEmptyState: React.FC<AdminEmptyStateProps> = ({
  icon,
  title,
  action,
  description,
}) => (
  <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border-medium bg-surface-secondary px-6 py-12 text-center">
    <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-surface-tertiary text-text-secondary">
      {icon}
    </div>
    <h2 className="text-base font-semibold text-text-primary">{title}</h2>
    {description != null && (
      <p className="mt-1 max-w-sm text-sm leading-6 text-text-secondary">{description}</p>
    )}
    {action != null && <div className="mt-5">{action}</div>}
  </div>
);

interface AdminSkeletonProps {
  rows?: number;
}

export const AdminSkeleton: React.FC<AdminSkeletonProps> = ({ rows = 5 }) => (
  <div className="space-y-3" aria-hidden="true">
    {Array.from({ length: rows }).map((_, index) => (
      <div
        key={index}
        className="h-14 animate-pulse rounded-lg bg-surface-tertiary"
        style={{ opacity: 1 - index * 0.08 }}
      />
    ))}
  </div>
);

interface AdminConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const AdminConfirmDialog: React.FC<AdminConfirmDialogProps> = ({
  title,
  isOpen,
  onCancel,
  isLoading,
  onConfirm,
  cancelLabel,
  description,
  confirmLabel,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        className="w-full max-w-md rounded-xl border border-border-medium bg-surface-dialog p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="admin-confirm-title" className="text-lg font-semibold text-text-primary">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
          </div>
          <AdminIconButton label={cancelLabel} onClick={onCancel}>
            <X className="size-4" />
          </AdminIconButton>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <AdminActionButton variant="ghost" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </AdminActionButton>
          <AdminActionButton variant="danger" onClick={onConfirm} disabled={isLoading}>
            {confirmLabel}
          </AdminActionButton>
        </div>
      </div>
    </div>
  );
};
