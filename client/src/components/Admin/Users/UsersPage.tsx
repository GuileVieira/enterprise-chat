import React, { useState } from 'react';
import { Search, Trash2, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Placeholder data - will be replaced with real API data
const placeholderUsers = [
  { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'ADMIN', username: 'admin' },
  { id: '2', name: 'John Doe', email: 'john@example.com', role: 'USER', username: 'john' },
  { id: '3', name: 'Jane Smith', email: 'jane@example.com', role: 'USER', username: 'jane' },
];

const UsersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const filteredUsers = placeholderUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Users</h1>
          <p className="mt-1 text-sm text-text-secondary">Manage user accounts and permissions.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          placeholder="Search users by name, email, or username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border-medium bg-surface-secondary py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-xheavy focus:outline-none"
        />
      </div>

      <div className="rounded-xl border border-border-medium bg-surface-secondary">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-medium">
              <th className="px-6 py-3 font-medium text-text-secondary">Name</th>
              <th className="px-6 py-3 font-medium text-text-secondary">Email</th>
              <th className="px-6 py-3 font-medium text-text-secondary">Username</th>
              <th className="px-6 py-3 font-medium text-text-secondary">Role</th>
              <th className="px-6 py-3 font-medium text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr
                key={user.id}
                className="border-b border-border-medium transition-colors hover:bg-surface-tertiary"
              >
                <td className="px-6 py-4 font-medium text-text-primary">{user.name}</td>
                <td className="px-6 py-4 text-text-secondary">{user.email}</td>
                <td className="px-6 py-4 text-text-secondary">{user.username}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.role === 'ADMIN'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {user.role === 'ADMIN' && <Shield className="h-3 w-3" />}
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => navigate(`/admin/roles`)}
                    className="text-text-secondary transition-colors hover:text-text-primary"
                    title="Manage Role"
                  >
                    <Shield className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-text-secondary">
                  No users found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsersPage;
