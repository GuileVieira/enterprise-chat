import React from 'react';
import { Building2, Users, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useListAdminTenants } from '~/data-provider/admin';

const TenantsPage: React.FC = () => {
  const { data, isLoading } = useListAdminTenants();
  const navigate = useNavigate();
  const tenants = data?.tenants ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Tenants</h1>
        <p className="mt-1 text-sm text-text-secondary">
          View all tenants and their user counts. Click a tenant to see details.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
        </div>
      )}

      {!isLoading && tenants.length === 0 && (
        <div className="rounded-xl border border-border-medium bg-surface-secondary py-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-text-secondary" />
          <p className="mt-4 text-text-secondary">No tenants found.</p>
          <p className="mt-1 text-xs text-text-secondary">
            Tenants are created implicitly when users are assigned a tenantId.
          </p>
        </div>
      )}

      {!isLoading && tenants.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <button
              key={tenant.id}
              onClick={() => navigate(`/admin/tenants/${encodeURIComponent(tenant.id)}`)}
              className="flex items-center justify-between rounded-xl border border-border-medium bg-surface-secondary p-6 text-left transition-colors hover:bg-surface-tertiary"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-tertiary">
                  <Building2 className="h-6 w-6 text-text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text-primary">{tenant.id}</h3>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-text-secondary">
                    <Users className="h-3.5 w-3.5" />
                    <span>{tenant.userCount} users</span>
                  </div>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-text-secondary" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TenantsPage;
