import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MoveToProjectModal from '../MoveToProjectModal';

const mockOnOpenChange = jest.fn();
const mockOnMove = jest.fn();

jest.mock('~/data-provider', () => ({
  useProjectsQuery: jest.fn(),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key) => key,
}));

jest.mock('~/utils', () => ({
  cn: (...classes) => classes.filter(Boolean).join(' '),
}));

jest.mock('@librechat/client', () => ({
  Dialog: ({ children, open }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  Button: ({ children, onClick, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

import { useProjectsQuery } from '~/data-provider';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

function renderModal(props = {}) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MoveToProjectModal
        open={true}
        onOpenChange={mockOnOpenChange}
        currentProjectId="p1"
        onMove={mockOnMove}
        isLoading={false}
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe('MoveToProjectModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderModal();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders empty state when no other projects exist', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [{ projectId: 'p1', name: 'Current Project' }],
      isLoading: false,
    });
    renderModal();
    expect(screen.getByText('com_ui_no_other_projects')).toBeInTheDocument();
  });

  it('renders list of other projects', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [
        { projectId: 'p1', name: 'Current Project' },
        { projectId: 'p2', name: 'Project Beta' },
        { projectId: 'p3', name: 'Project Gamma' },
      ],
      isLoading: false,
    });
    renderModal();
    expect(screen.queryByText('Current Project')).not.toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
    expect(screen.getByText('Project Gamma')).toBeInTheDocument();
  });

  it('selects a project on click', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [
        { projectId: 'p1', name: 'Current Project' },
        { projectId: 'p2', name: 'Project Beta' },
      ],
      isLoading: false,
    });
    renderModal();
    fireEvent.click(screen.getByText('Project Beta'));
    fireEvent.click(screen.getByText('com_ui_move'));
    expect(mockOnMove).toHaveBeenCalledWith('p2');
  });

  it('calls onOpenChange with false on cancel', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [{ projectId: 'p1', name: 'Current Project' }],
      isLoading: false,
    });
    renderModal();
    fireEvent.click(screen.getByText('com_ui_cancel'));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows remove from project button when currentProjectId exists', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [
        { projectId: 'p1', name: 'Current Project' },
        { projectId: 'p2', name: 'Project Beta' },
      ],
      isLoading: false,
    });
    renderModal();
    expect(screen.getByText('com_ui_remove_from_project')).toBeInTheDocument();
  });

  it('hides remove from project button when no currentProjectId', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [
        { projectId: 'p1', name: 'Project Alpha' },
        { projectId: 'p2', name: 'Project Beta' },
      ],
      isLoading: false,
    });
    renderModal({ currentProjectId: null });
    expect(screen.queryByText('com_ui_remove_from_project')).not.toBeInTheDocument();
  });

  it('calls onMove with null when remove from project is clicked', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [
        { projectId: 'p1', name: 'Current Project' },
        { projectId: 'p2', name: 'Project Beta' },
      ],
      isLoading: false,
    });
    renderModal();
    fireEvent.click(screen.getByText('com_ui_remove_from_project'));
    expect(mockOnMove).toHaveBeenCalledWith(null);
  });

  it('disables move button when isLoading is true', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [
        { projectId: 'p1', name: 'Current Project' },
        { projectId: 'p2', name: 'Project Beta' },
      ],
      isLoading: false,
    });
    renderModal({ isLoading: true });
    const moveButton = screen.getByText('com_ui_loading');
    expect(moveButton).toBeDisabled();
  });
});
