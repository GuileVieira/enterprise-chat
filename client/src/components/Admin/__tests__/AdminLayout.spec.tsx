import React from 'react';
import { render, screen } from 'test/layout-test-utils';
import { useAuthContext } from '~/hooks/AuthContext';
import AdminLayout from '../AdminLayout';

jest.mock('~/hooks/AuthContext');
jest.mock('react-router-dom', () => ({
  NavLink: function NavLink({ children, to }: { children: React.ReactNode; to: string }) {
    return React.createElement('a', { href: to }, children);
  },
  useLocation: () => ({ pathname: '/admin' }),
  Navigate: function Navigate() {
    return null;
  },
  Outlet: function Outlet() {
    return React.createElement('div', { 'data-testid': 'outlet' }, 'Outlet Content');
  },
}));

describe('AdminLayout', () => {
  const mockUseAuthContext = useAuthContext as jest.MockedFunction<typeof useAuthContext>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders null for unauthenticated users (redirects)', () => {
    mockUseAuthContext.mockReturnValue({
      user: null,
      isAuthenticated: false,
      token: null,
      login: jest.fn(),
      logout: jest.fn(),
      roles: {},
      setToken: jest.fn(),
      error: null,
    });

    const { container } = render(<AdminLayout />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null for non-admin users (redirects)', () => {
    mockUseAuthContext.mockReturnValue({
      user: { role: 'USER', name: 'John', email: 'john@test.com' },
      isAuthenticated: true,
      token: 'mock-token',
      login: jest.fn(),
      logout: jest.fn(),
      roles: {},
      setToken: jest.fn(),
      error: null,
    });

    const { container } = render(<AdminLayout />);
    expect(container.firstChild).toBeNull();
  });

  it('renders admin navigation and outlet for admin users', () => {
    mockUseAuthContext.mockReturnValue({
      user: { role: 'ADMIN', name: 'Admin', email: 'admin@test.com' },
      isAuthenticated: true,
      token: 'mock-token',
      login: jest.fn(),
      logout: jest.fn(),
      roles: {},
      setToken: jest.fn(),
      error: null,
    });

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
