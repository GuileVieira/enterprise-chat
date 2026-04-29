import React from 'react';
import { Users, Shield, UserCircle, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  onClick: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 rounded-xl border border-border-medium bg-surface-secondary p-6 text-left transition-colors hover:bg-surface-tertiary"
  >
    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-tertiary">
      <Icon className="h-6 w-6 text-text-primary" />
    </div>
    <div>
      <p className="text-sm text-text-secondary">{title}</p>
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  </button>
);

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage users, roles, groups, and system configuration.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Users"
          value="Manage"
          icon={Users}
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          title="Roles"
          value="Manage"
          icon={Shield}
          onClick={() => navigate('/admin/roles')}
        />
        <StatCard
          title="Groups"
          value="Manage"
          icon={UserCircle}
          onClick={() => navigate('/admin/groups')}
        />
        <StatCard
          title="Config"
          value="Manage"
          icon={Settings}
          onClick={() => navigate('/admin/config')}
        />
      </div>
    </div>
  );
};

export default AdminDashboard;
