import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectsList from '../ProjectsList';

const mockNavigate = jest.fn();
const mockDeleteMutate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('~/data-provider', () => ({
  useProjectsQuery: jest.fn(),
  useDeleteProjectMutation: () => ({
    mutate: mockDeleteMutate,
    isLoading: false,
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key) => key,
}));

jest.mock('~/utils', () => ({
  cn: (...classes) => classes.filter(Boolean).join(' '),
}));

import { useProjectsQuery } from '~/data-provider';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

function renderList() {
  const queryClient = createQueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProjectsList />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ProjectsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderList();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders empty state when no projects exist', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText('com_ui_projects_empty')).toBeInTheDocument();
    expect(screen.getByText('com_ui_create_first_project')).toBeInTheDocument();
  });

  it('renders list of active projects', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [
        {
          projectId: 'p1',
          name: 'Project Alpha',
          description: 'First project',
          endpoint: 'openAI',
          model: 'gpt-4',
        },
        { projectId: 'p2', name: 'Project Beta', description: '', endpoint: '', model: '' },
      ],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
    expect(screen.getByText('First project')).toBeInTheDocument();
    expect(screen.getByText('openAI')).toBeInTheDocument();
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('does not render archived projects', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [
        { projectId: 'p1', name: 'Active Project', isArchived: false },
        { projectId: 'p2', name: 'Archived Project', isArchived: true },
      ],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText('Active Project')).toBeInTheDocument();
    expect(screen.queryByText('Archived Project')).not.toBeInTheDocument();
  });

  it('navigates to project detail on card click', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [{ projectId: 'p1', name: 'Project Alpha' }],
      isLoading: false,
    });
    renderList();
    fireEvent.click(screen.getByText('Project Alpha'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/p1');
  });

  it('navigates to new project page on header button click', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
    });
    renderList();
    fireEvent.click(screen.getByText('com_ui_new_project'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/new');
  });

  it('navigates to new project page on empty state button click', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
    });
    renderList();
    fireEvent.click(screen.getByText('com_ui_create_first_project'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/new');
  });

  it('calls delete mutation after confirm', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [{ projectId: 'p1', name: 'Project Alpha' }],
      isLoading: false,
    });
    renderList();
    const deleteButton = screen.getByTitle('com_ui_delete');
    fireEvent.click(deleteButton);
    expect(mockDeleteMutate).toHaveBeenCalledWith('p1');
  });

  it('does not delete when confirm is cancelled', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [{ projectId: 'p1', name: 'Project Alpha' }],
      isLoading: false,
    });
    renderList();
    const deleteButton = screen.getByTitle('com_ui_delete');
    fireEvent.click(deleteButton);
    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it('navigates to edit on pencil button click', () => {
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [{ projectId: 'p1', name: 'Project Alpha' }],
      isLoading: false,
    });
    renderList();
    const editButton = screen.getByTitle('com_ui_edit');
    fireEvent.click(editButton);
    expect(mockNavigate).toHaveBeenCalledWith('/projects/p1');
  });
});
