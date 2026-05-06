import React, { useMemo, useState } from 'react';
import {
  Key,
  Menu,
  Search,
  Shield,
  Users,
  Wrench,
  X,
  Settings,
  Building2,
  UserCircle,
  ChevronLeft,
  LayoutDashboard,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SystemRoles } from 'librechat-data-provider';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  { path: '/admin/tenants', labelKey: 'com_admin_tenants', icon: Building2 },
  { path: '/admin/roles', labelKey: 'com_admin_roles', icon: Shield },
  { path: '/admin/groups', labelKey: 'com_admin_groups', icon: UserCircle },
  { path: '/admin/functions', labelKey: 'com_admin_functions', icon: Wrench },
  { path: '/admin/secrets', labelKey: 'com_admin_secrets', icon: Key },
  { path: '/admin/config', labelKey: 'com_admin_config', icon: Settings },
];

interface AdminNavProps {
  onNavigate?: () => void;
}

const AdminNav: React.FC<AdminNavProps> = ({ onNavigate }) => {
  const location = useLocation();
  const localize = useLocalize();

  return (
    <nav className="flex h-full flex-col border-r border-border-medium bg-surface-primary">
      <div className="px-5 py-5">
        <NavLink
          to="/c/new"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
        >
          <ChevronLeft className="size-4" />
          {localize('com_admin_back_to_chat')}
        </NavLink>
      </div>

      <div className="px-5 pb-4">
        <p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
          {localize('com_admin_super_admin')}
        </p>
        <h1 className="mt-2 px-2 text-xl font-semibold text-text-primary">
          {localize('com_admin_console')}
        </h1>
        <p className="mt-2 px-2 text-sm leading-5 text-text-secondary">
          {localize('com_admin_nav_description')}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-4 py-2">
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
              onClick={onNavigate}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
                isActive
                  ? 'bg-surface-tertiary text-text-primary shadow-sm shadow-black/5'
                  : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="admin-nav-active"
                  className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-text-primary"
                />
              )}
              <Icon className="size-4 transition-transform duration-200 group-hover:scale-105" />
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const localize = useLocalize();

  const displayName = useMemo(() => {
    return user?.name ?? user?.username ?? user?.email ?? localize('com_admin_admin_user');
  }, [user, localize]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== SystemRoles.ADMIN) {
    return <Navigate to="/c/new" replace />;
  }

  return (
    <div className="flex min-h-dvh w-screen bg-surface-primary text-text-primary">
      <aside className="hidden w-72 shrink-0 md:block">
        <AdminNav />
      </aside>

      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label={localize('com_admin_close_navigation')}
            className="absolute inset-0 bg-black/45"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <motion.aside
            initial={{ x: -288 }}
            animate={{ x: 0 }}
            className="relative h-full w-72 shadow-xl"
          >
            <AdminNav onNavigate={() => setIsMobileNavOpen(false)} />
          </motion.aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border-light bg-surface-primary/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={localize('com_admin_open_navigation')}
                className="inline-flex size-10 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-secondary hover:text-text-primary md:hidden"
                onClick={() => setIsMobileNavOpen(true)}
              >
                <Menu className="size-5" />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  {localize('com_admin_super_admin')}
                </p>
                <p className="text-sm font-medium text-text-primary">{displayName}</p>
              </div>
            </div>

            <div className="hidden flex-1 justify-center lg:flex">
              <button
                type="button"
                onClick={() => navigate('/admin/users')}
                className="flex h-10 w-full max-w-md items-center gap-2 rounded-lg border border-border-light bg-surface-secondary px-3 text-left text-sm text-text-secondary shadow-sm shadow-black/5 transition-colors hover:bg-surface-tertiary"
              >
                <Search className="size-4" />
                {localize('com_admin_search_shortcut')}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-md bg-surface-tertiary px-2 py-1 text-xs font-semibold text-text-secondary sm:inline-flex">
                {localize('com_admin_role_super_admin')}
              </span>
              <button
                type="button"
                aria-label={localize('com_admin_close_navigation')}
                className="hidden size-10 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
        </header>

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
