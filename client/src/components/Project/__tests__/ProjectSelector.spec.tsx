import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectSelector from '../ProjectSelector';

const mockOnSelectProject = jest.fn();

jest.mock('~/data-provider', () => ({
  useProjectsQuery: jest.fn(),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

import { useProjectsQuery } from '~/data-provider';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

function renderSelector(
  props: {
    selectedProjectId: string | null;
    onSelectProject?: typeof mockOnSelectProject;
  } = { selectedProjectId: null },
) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectSelector
        selectedProjectId={props.selectedProjectId}
        onSelectProject={props.onSelectProject ?? mockOnSelectProject}
      />
    </QueryClientProvider>,
  );
}

describe('ProjectSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [
        { projectId: 'p1', name: 'Project Alpha' },
        { projectId: 'p2', name: 'Project Beta' },
      ],
      isLoading: false,
    });
  });

  it('renders "All projects" when no project is selected', () => {
    renderSelector();
    expect(screen.getByText('com_ui_all_projects')).toBeInTheDocument();
  });

  it('renders selected project name when a project is selected', () => {
    renderSelector({ selectedProjectId: 'p1' });
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
  });

  it('shows clear button when a project is selected', () => {
    renderSelector({ selectedProjectId: 'p1' });
    expect(screen.getByLabelText('com_ui_clear_project_filter')).toBeInTheDocument();
  });

  it('does not show clear button when no project is selected', () => {
    renderSelector({ selectedProjectId: null });
    expect(screen.queryByLabelText('com_ui_clear_project_filter')).not.toBeInTheDocument();
  });

  it('opens dropdown and lists projects', async () => {
    renderSelector();
    const button = screen.getByLabelText('com_ui_filter_by_project');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });
  });

  it('calls onSelectProject when a project is clicked', async () => {
    renderSelector();
    const button = screen.getByLabelText('com_ui_filter_by_project');
    fireEvent.click(button);

    await waitFor(() => {
      const projectItem = screen.getByText('Project Alpha');
      fireEvent.click(projectItem);
    });

    expect(mockOnSelectProject).toHaveBeenCalledWith('p1');
  });

  it('calls onSelectProject with null when clear button is clicked', () => {
    renderSelector({ selectedProjectId: 'p1' });
    const clearButton = screen.getByLabelText('com_ui_clear_project_filter');
    fireEvent.click(clearButton);
    expect(mockOnSelectProject).toHaveBeenCalledWith(null);
  });

  it('calls onSelectProject with null when "All projects" is clicked', async () => {
    renderSelector();
    const button = screen.getByLabelText('com_ui_filter_by_project');
    fireEvent.click(button);

    await waitFor(() => {
      const allProjects = screen.getAllByText('com_ui_all_projects');
      // Second occurrence is the dropdown item
      fireEvent.click(allProjects[1]);
    });

    expect(mockOnSelectProject).toHaveBeenCalledWith(null);
  });
});
