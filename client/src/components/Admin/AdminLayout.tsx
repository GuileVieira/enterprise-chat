import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Users,
  Shield,
  UserCircle,
  Settings,
  LayoutDashboard,
  ChevronLeft,
} from 'lucide-react';
import { useAuthContext } from '~/hooks/AuthContext';
import { SystemRoles } from 'librechat-data-provider';
import { Navigate } from 'react-router-dom';

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/roles', label: 'Roles', icon: Shield },
  { path: '/admin/groups', label: 'Groups', icon: UserCircle },
  { path: '/admin/config', label: 'Config', icon: Settings },
];

const AdminNav: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="flex h-full w-64 flex-col border-r border-border-medium bg-surface-primary">
      <div className="flex items-center gap-3 px-4 py-5">
        <NavLink
          to="/c/new"
          className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Chat
        </NavLink>
      </div>

      <div className="px-3 py-2">
        <h2 className="px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Administration
        </h2>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-3">
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
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-surface-tertiary text-text-primary'
                  : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
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
    <div className="flex h-screen w-screen bg-surface-primary text-text-primary">
      <AdminNav />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
