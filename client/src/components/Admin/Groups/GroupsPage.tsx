import React from 'react';
import { UserCircle, Users } from 'lucide-react';

// Placeholder data - will be replaced with real API data
const placeholderGroups = [
  { id: '1', name: 'Marketing Team', description: 'Marketing department users', memberCount: 5 },
  { id: '2', name: 'Engineering', description: 'Engineering team', memberCount: 12 },
  { id: '3', name: 'Support', description: 'Customer support team', memberCount: 8 },
];

const GroupsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Groups</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage user groups for easier permission management.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {placeholderGroups.map((group) => (
          <div
            key={group.id}
            className="rounded-xl border border-border-medium bg-surface-secondary p-6 transition-colors hover:bg-surface-tertiary"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-tertiary">
                <UserCircle className="h-5 w-5 text-text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="truncate text-base font-semibold text-text-primary">
                  {group.name}
                </h3>
                <p className="truncate text-sm text-text-secondary">{group.description}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary">
              <Users className="h-4 w-4" />
              <span>{group.memberCount} members</span>
            </div>
          </div>
        ))}
      </div>

      {placeholderGroups.length === 0 && (
        <div className="rounded-xl border border-border-medium bg-surface-secondary py-12 text-center">
          <UserCircle className="mx-auto h-12 w-12 text-text-secondary" />
          <p className="mt-4 text-text-secondary">No groups found.</p>
        </div>
      )}
    </div>
  );
};

export default GroupsPage;
