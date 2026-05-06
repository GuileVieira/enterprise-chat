import { render, screen, fireEvent } from 'test/layout-test-utils';
import { useNavigate } from 'react-router-dom';
import { useGetAdminOverview } from '~/data-provider/admin';
import AdminDashboard from '../Dashboard';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));
jest.mock('~/data-provider/admin', () => ({
  useGetAdminOverview: jest.fn(),
}));

describe('AdminDashboard', () => {
  const mockNavigate = jest.fn();
  const mockUseGetAdminOverview = useGetAdminOverview as jest.MockedFunction<
    typeof useGetAdminOverview
  >;

  const overview = {
    usersTotal: 12,
    adminsTotal: 2,
    tenantsTotal: 3,
    rolesTotal: 4,
    groupsTotal: 5,
    configOverridesTotal: 6,
    activeConfigOverridesTotal: 4,
    functionsTotal: 8,
    activeFunctionsTotal: 7,
    secretsTotal: 9,
    topTenants: [{ id: 'tenant-a', userCount: 10 }],
    recentUsers: [
      {
        id: 'user-1',
        _id: 'user-1',
        name: 'Admin User',
        username: 'admin',
        email: 'admin@example.com',
        role: 'ADMIN',
        tenantId: 'tenant-a',
      },
    ],
  };

  beforeEach(() => {
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    mockUseGetAdminOverview.mockReturnValue({
      data: overview,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useGetAdminOverview>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard title and description', () => {
    render(<AdminDashboard />);

    expect(screen.getByText('Super Admin Console')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Monitor users, tenants, permissions, functions, secrets, and live configuration from one operational view.',
      ),
    ).toBeInTheDocument();
  });

  it('renders all operational metric cards', () => {
    render(<AdminDashboard />);

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Tenants')).toBeInTheDocument();
    expect(screen.getByText('Roles')).toBeInTheDocument();
    expect(screen.getByText('Groups')).toBeInTheDocument();
    expect(screen.getByText('Functions')).toBeInTheDocument();
    expect(screen.getByText('Secrets')).toBeInTheDocument();
    expect(screen.getByText('Config')).toBeInTheDocument();
    expect(screen.getByText('Super Admins')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getAllByText('tenant-a').length).toBeGreaterThan(0);
  });

  it('navigates to users page when Users card is clicked', () => {
    render(<AdminDashboard />);

    const usersCard = screen.getByText('Users').closest('button');
    fireEvent.click(usersCard!);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/users');
  });

  it('navigates to roles page when Roles card is clicked', () => {
    render(<AdminDashboard />);

    const rolesCard = screen.getByText('Roles').closest('button');
    fireEvent.click(rolesCard!);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/roles');
  });

  it('navigates to groups page when Groups card is clicked', () => {
    render(<AdminDashboard />);

    const groupsCard = screen.getByText('Groups').closest('button');
    fireEvent.click(groupsCard!);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/groups');
  });

  it('navigates to config page when Config card is clicked', () => {
    render(<AdminDashboard />);

    const configCard = screen.getByText('Config').closest('button');
    fireEvent.click(configCard!);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/config');
  });

  it('renders loading state', () => {
    mockUseGetAdminOverview.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useGetAdminOverview>);

    render(<AdminDashboard />);

    expect(screen.getByText('Super Admin Console')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUseGetAdminOverview.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof useGetAdminOverview>);

    render(<AdminDashboard />);

    expect(screen.getByText('Unable to load overview')).toBeInTheDocument();
  });
});
