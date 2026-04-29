import React from 'react';
import {
  Shield,
  Users,
  UserCircle,
  Settings,
  ChevronLeft,
  LayoutDashboard,
  Building2,
  Wrench,
  Key,
} from 'lucide-react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import type { TranslationKeys } from '~/hooks';

const navItems: Array<{
  path: string;
  labelKey: TranslationKeys;
  icon: React.ElementType;
  end?: boolean;
}> = [
  { path: '/admin', labelKey: 'com_admin_dashboard', icon: LayoutDashboard, end: true },
  { path: '/admin/users', labelKey: 'com_admin_users', icon: Users },
  { path: '/admin/roles', labelKey: 'com_admin_roles', icon: Shield },
  { path: '/admin/groups', labelKey: 'com_admin_groups', icon: UserCircle },
  { path: '/admin/tenants', labelKey: 'com_admin_tenants', icon: Building2 },
  { path: '/admin/functions', labelKey: 'com_admin_functions', icon: Wrench },
  { path: '/admin/secrets', labelKey: 'com_admin_secrets', icon: Key },
  { path: '/admin/config', labelKey: 'com_admin_config', icon: Settings },
];

const AdminNav: React.FC = () => {
  const location = useLocation();
  const localize = useLocalize();

  return (
    <nav className="flex border-border-medium bg-surface-primary md:h-full md:w-72 md:flex-col md:border-r">
      <div className="hidden px-5 py-6 md:block">
        <NavLink
          to="/c/new"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          {localize('com_admin_back_to_chat')}
        </NavLink>
      </div>

      <div className="hidden px-5 pb-3 md:block">
        <h2 className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
          {localize('com_admin_administration')}
        </h2>
        <p className="mt-2 px-2 text-sm leading-5 text-text-secondary">
          {localize('com_admin_nav_description')}
        </p>
      </div>

      <div className="flex w-full gap-2 overflow-x-auto border-b border-border-light px-3 py-3 md:flex-1 md:flex-col md:border-b-0 md:px-4 md:py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.end
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={cn(
                'group flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary md:w-full',
                isActive
                  ? 'bg-surface-tertiary text-text-primary shadow-sm shadow-black/5'
                  : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary',
              )}
            >
              <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-105" />
              {localize(item.labelKey)}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

const AdminLayout: React.FC = () => {
  const { user, isAuthenticated } = useAuthContext();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== SystemRoles.ADMIN) {
    return <Navigate to="/c/new" replace />;
  }

  return (
    <div className="flex min-h-dvh w-screen flex-col bg-surface-primary text-text-primary md:flex-row">
      <AdminNav />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
