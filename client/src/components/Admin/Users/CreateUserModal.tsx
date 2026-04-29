import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useCreateAdminUserMutation } from '~/data-provider/admin';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [role, setRole] = useState('USER');
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const createUser = useCreateAdminUserMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim() || !username.trim()) {
      return;
    }
    try {
      const result = await createUser.mutateAsync({
        email: email.trim(),
        name: name.trim(),
        username: username.trim(),
        password: password.trim() || undefined,
        tenantId: tenantId.trim() || undefined,
        role,
      });
      setCreatedPassword(result.password ?? null);
      setEmail('');
      setName('');
      setUsername('');
      setPassword('');
      setTenantId('');
      setRole('USER');
    } catch {
      // error handled by mutation
    }
  };

  const handleClose = () => {
    setCreatedPassword(null);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border-medium bg-surface-secondary p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Create User</h2>
          <button
            onClick={handleClose}
            className="text-text-secondary transition-colors hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {createdPassword ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">User created successfully!</p>
              {createdPassword && (
                <div className="mt-2">
                  <p className="text-xs text-green-700">Generated password:</p>
                  <code className="mt-1 block rounded bg-green-100 px-2 py-1 text-sm text-green-900">
                    {createdPassword}
                  </code>
                </div>
              )}
            </div>
            <button
              onClick={handleClose}
              className="w-full rounded-lg bg-surface-tertiary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-active-alt"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1 w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-xheavy focus:outline-none"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="mt-1 w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-xheavy focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary">Username *</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="mt-1 w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-xheavy focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary">Password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to auto-generate"
                className="mt-1 w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-xheavy focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary">Tenant</label>
                <input
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-xheavy focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-xheavy focus:outline-none"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-border-medium px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createUser.isLoading}
                className="flex items-center gap-2 rounded-lg bg-surface-tertiary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-active-alt disabled:opacity-50"
              >
                {createUser.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateUserModal;
