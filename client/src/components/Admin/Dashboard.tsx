import React from 'react';
import { Settings, Shield, UserCircle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocalize } from '~/hooks';
import { AdminPageHeader } from './common';

interface StatCardProps {
  title: string;
  description: string;
  actionLabel: string;
  icon: React.ElementType;
  onClick: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  icon: Icon,
  onClick,
  actionLabel,
  description,
}) => (
  <button
    onClick={onClick}
    className="group flex min-h-40 flex-col justify-between rounded-xl border border-border-light bg-surface-secondary p-5 text-left shadow-sm shadow-black/5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:translate-y-0"
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-tertiary">
        <Icon className="h-5 w-5 text-text-primary" />
      </div>
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
        {actionLabel}
      </span>
    </div>
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
    </div>
  </button>
);

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const localize = useLocalize();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow={localize('com_admin_administration')}
        title={localize('com_admin_dashboard_title')}
        description={localize('com_admin_dashboard_description')}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={localize('com_admin_users')}
          actionLabel={localize('com_admin_open')}
          description={localize('com_admin_users_description')}
          icon={Users}
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          title={localize('com_admin_roles')}
          actionLabel={localize('com_admin_open')}
          description={localize('com_admin_roles_description')}
          icon={Shield}
          onClick={() => navigate('/admin/roles')}
        />
        <StatCard
          title={localize('com_admin_groups')}
          actionLabel={localize('com_admin_open')}
          description={localize('com_admin_groups_description')}
          icon={UserCircle}
          onClick={() => navigate('/admin/groups')}
        />
        <StatCard
          title={localize('com_admin_config')}
          actionLabel={localize('com_admin_open')}
          description={localize('com_admin_config_description')}
          icon={Settings}
          onClick={() => navigate('/admin/config')}
        />
      </div>
    </div>
  );
};

export default AdminDashboard;
