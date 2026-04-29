import React from 'react';
import { render, screen } from '@testing-library/react';
import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import AdminLayout from '../AdminLayout';

jest.mock('~/hooks/AuthContext');
jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => {
    const labels: Record<string, string> = {
      com_admin_config: 'Config',
      com_admin_roles: 'Roles',
      com_admin_users: 'Users',
      com_admin_groups: 'Groups',
      com_admin_dashboard: 'Dashboard',
      com_admin_back_to_chat: 'Back to Chat',
      com_admin_administration: 'Administration',
      com_admin_nav_description: 'Control access, groups, and configuration.',
    };
    return labels[key] ?? key;
  },
}));
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    NavLink: function NavLink({ children, to }: { children: React.ReactNode; to: string }) {
      const ReactActual = jest.requireActual('react') as typeof React;
      return ReactActual.createElement('a', { href: to }, children);
    },
    useLocation: () => ({ pathname: '/admin' }),
    Navigate: function Navigate() {
      return null;
    },
    Outlet: function Outlet() {
      const ReactActual = jest.requireActual('react') as typeof React;
      return ReactActual.createElement('div', { 'data-testid': 'outlet' }, 'Outlet Content');
    },
  };
});

describe('AdminLayout', () => {
  const mockUseAuthContext = useAuthContext as jest.MockedFunction<typeof useAuthContext>;
  type AuthContextValue = ReturnType<typeof useAuthContext>;

  const createAuthContext = (overrides: Record<string, unknown>): AuthContextValue =>
    ({
      user: undefined,
      isAuthenticated: false,
      token: undefined,
      login: jest.fn(),
      logout: jest.fn(),
      roles: {},
      setToken: jest.fn(),
      error: undefined,
      ...overrides,
    }) as unknown as AuthContextValue;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders null for unauthenticated users (redirects)', () => {
    mockUseAuthContext.mockReturnValue(
      createAuthContext({
        user: null,
        isAuthenticated: false,
        token: null,
        error: null,
      }),
    );

    const { container } = render(<AdminLayout />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null for non-admin users (redirects)', () => {
    mockUseAuthContext.mockReturnValue(
      createAuthContext({
        user: { role: SystemRoles.USER, name: 'John', email: 'john@test.com' },
        isAuthenticated: true,
        token: 'mock-token',
        error: null,
      }),
    );

    const { container } = render(<AdminLayout />);
    expect(container.firstChild).toBeNull();
  });

  it('renders admin navigation and outlet for admin users', () => {
    mockUseAuthContext.mockReturnValue(
      createAuthContext({
        user: { role: SystemRoles.ADMIN, name: 'Admin', email: 'admin@test.com' },
        isAuthenticated: true,
        token: 'mock-token',
        error: null,
      }),
    );

    render(<AdminLayout />);

    expect(screen.getByText('Administration')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Roles')).toBeInTheDocument();
    expect(screen.getByText('Groups')).toBeInTheDocument();
    expect(screen.getByText('Config')).toBeInTheDocument();
    expect(screen.getByText('Back to Chat')).toBeInTheDocument();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });
});
