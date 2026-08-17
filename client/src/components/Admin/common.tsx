import React from 'react';
import { X } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
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
  <div className="flex flex-col gap-4 border-b border-border-light pb-7 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-2xl">
      {eyebrow != null && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
          {eyebrow}
        </p>
      )}
      <h1 className="text-balance text-3xl font-semibold leading-tight text-text-primary sm:text-4xl">
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
      'overflow-hidden rounded-2xl border border-border-light bg-surface-secondary shadow-sm shadow-black/[0.04] dark:shadow-black/20',
      className,
    )}
    {...props}
  >
    {children}
  </section>
);

interface AdminSectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const AdminSectionHeader: React.FC<AdminSectionHeaderProps> = ({
  title,
  action,
  description,
}) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      {description != null && (
        <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
      )}
    </div>
    {action != null && <div className="shrink-0">{action}</div>}
  </div>
);

interface AdminToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export const AdminToolbar: React.FC<AdminToolbarProps> = ({ children, className }) => (
  <div
    className={cn(
      'flex flex-col gap-3 rounded-2xl border border-border-light bg-surface-secondary p-3 shadow-sm shadow-black/[0.03] dark:shadow-black/20 sm:flex-row sm:items-center sm:justify-between',
      className,
    )}
  >
    {children}
  </div>
);

interface AdminTenantSelectorProps {
  label: string;
  value: string;
  tenants: Array<{ id: string }>;
  placeholder: string;
  onChange: (tenantId: string) => void;
}

export const AdminTenantSelector: React.FC<AdminTenantSelectorProps> = ({
  label,
  value,
  tenants,
  onChange,
  placeholder,
}) => (
  <label className="block w-full sm:w-72">
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="focus:ring-ring-primary/20 h-10 w-full rounded-xl border border-border-light bg-surface-secondary px-3 text-sm font-medium text-text-primary shadow-sm shadow-black/[0.03] outline-none transition-all duration-200 hover:border-border-medium hover:bg-surface-tertiary focus:border-border-xheavy focus:ring-2 dark:shadow-black/20"
    >
      <option value="">{placeholder}</option>
      {tenants.map((tenant) => (
        <option key={tenant.id} value={tenant.id}>
          {tenant.id}
        </option>
      ))}
    </select>
  </label>
);

interface AdminMetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  onClick?: () => void;
}

export const AdminMetricCard: React.FC<AdminMetricCardProps> = ({
  title,
  value,
  icon: Icon,
  onClick,
  description,
}) => {
  const Component = onClick != null ? motion.button : motion.div;

  return (
    <Component
      type={onClick != null ? 'button' : undefined}
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={onClick != null ? { scale: 0.99 } : undefined}
      className={cn(
        'min-h-32 rounded-2xl border border-border-light bg-surface-secondary p-4 text-left shadow-sm shadow-black/[0.04] dark:shadow-black/20',
        onClick != null &&
          'transition-colors hover:border-border-medium hover:bg-surface-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-secondary">{title}</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-text-primary">{value}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-xl bg-surface-tertiary text-text-primary shadow-inner shadow-white/30 dark:shadow-black/20">
          <Icon className="size-5" />
        </div>
      </div>
      {description != null && (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-text-tertiary">{description}</p>
      )}
    </Component>
  );
};

interface AdminStatGridProps {
  children: React.ReactNode;
}

export const AdminStatGrid: React.FC<AdminStatGridProps> = ({ children }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
);

interface AdminStatusBadgeProps {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}

export const AdminStatusBadge: React.FC<AdminStatusBadgeProps> = ({
  active,
  activeLabel,
  inactiveLabel,
}) => (
  <AdminBadge tone={active ? 'success' : 'neutral'}>
    {active ? activeLabel : inactiveLabel}
  </AdminBadge>
);

interface AdminDataTableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
}

interface AdminDataTableProps<T> {
  items: T[];
  columns: Array<AdminDataTableColumn<T>>;
  getRowKey: (item: T) => string;
}

export function AdminDataTable<T>({ items, columns, getRowKey }: AdminDataTableProps<T>) {
  return (
    <AdminPanel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="bg-surface-primary/55 border-b border-border-light">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn('px-6 py-3 font-medium text-text-secondary', column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={getRowKey(item)}
                className="hover:bg-surface-tertiary/80 border-b border-border-light transition-colors last:border-b-0"
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-6 py-4', column.className)}>
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPanel>
  );
}

interface AdminDangerZoneProps {
  title: string;
  description: string;
  action: React.ReactNode;
}

export const AdminDangerZone: React.FC<AdminDangerZoneProps> = ({ title, action, description }) => (
  <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold text-red-700 dark:text-red-300">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
      </div>
      {action}
    </div>
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
          'bg-surface-submit text-white shadow-sm shadow-black/10 hover:bg-surface-submit-hover dark:shadow-black/30',
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
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const AdminConfirmDialog: React.FC<AdminConfirmDialogProps> = ({
  title,
  isOpen,
  onCancel,
  isLoading,
  error,
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
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {error}
              </p>
            )}
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
