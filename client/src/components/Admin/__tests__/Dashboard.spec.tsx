import { render, screen, fireEvent } from 'test/layout-test-utils';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from '../Dashboard';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

describe('AdminDashboard', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard title and description', () => {
    render(<AdminDashboard />);

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(
      screen.getByText('Manage users, roles, groups, and system configuration.'),
    ).toBeInTheDocument();
  });

  it('renders all stat cards', () => {
    render(<AdminDashboard />);

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Roles')).toBeInTheDocument();
    expect(screen.getByText('Groups')).toBeInTheDocument();
    expect(screen.getByText('Config')).toBeInTheDocument();
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
});
