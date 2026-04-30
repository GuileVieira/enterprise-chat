import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectDetailPage from '../ProjectDetailPage';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ projectId: 'p1' }),
}));

jest.mock('~/data-provider', () => ({
  useProjectByIdQuery: jest.fn(),
  useGetProjectFiles: jest.fn(),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key) => key,
}));

jest.mock('~/hooks/useProjectPermissions', () => ({
  useProjectPermissions: jest.fn(),
}));

jest.mock('../ProjectPromptGroups', () => ({
  __esModule: true,
  default: () => <div data-testid="project-prompt-groups" />,
}));

jest.mock('../ProjectConversationsTab', () => ({
  __esModule: true,
  default: () => <div data-testid="project-conversations-tab" />,
}));

jest.mock('../ProjectForm', () => ({
  __esModule: true,
  default: ({ onSuccess }) => (
    <div data-testid="project-form">
      <button type="button" onClick={onSuccess} data-testid="submit-form" />
    </div>
  ),
}));

import { useProjectByIdQuery, useGetProjectFiles } from '~/data-provider';
import { useProjectPermissions } from '~/hooks/useProjectPermissions';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

function renderPage() {
  const queryClient = createQueryClient();
  return render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useGetProjectFiles as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
    });
    (useProjectPermissions as jest.Mock).mockReturnValue({
      permissions: { canView: true, canEdit: true, canDelete: true, canShare: true },
      isLoading: false,
    });
  });

  it('renders loading state', () => {
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderPage();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders not found when project is missing', () => {
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('com_ui_project_not_found')).toBeInTheDocument();
  });

  it('renders project name and description', () => {
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: {
        projectId: 'p1',
        name: 'Test Project',
        description: 'A test project',
        endpoint: 'openAI',
        model: 'gpt-4',
        instructions: 'Be helpful',
        memories: [{ key: 'tone', value: 'friendly' }],
        promptGroupIds: ['pg1'],
        user: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('A test project')).toBeInTheDocument();
  });

  it('shows conversation tab by default', () => {
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: {
        projectId: 'p1',
        name: 'Test Project',
        user: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByTestId('project-conversations-tab')).toBeInTheDocument();
  });

  it('switches to prompts tab', () => {
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: {
        projectId: 'p1',
        name: 'Test Project',
        promptGroupIds: ['pg1'],
        user: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('com_ui_project_tab_prompts'));
    expect(screen.getByTestId('project-prompt-groups')).toBeInTheDocument();
  });

  it('shows memories tab with memories', () => {
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: {
        projectId: 'p1',
        name: 'Test Project',
        memories: [{ key: 'tone', value: 'friendly' }],
        user: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('com_ui_project_tab_memories'));
    expect(screen.getByText('tone')).toBeInTheDocument();
    expect(screen.getByText('friendly')).toBeInTheDocument();
  });

  it('shows memories tab empty state', () => {
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: {
        projectId: 'p1',
        name: 'Test Project',
        memories: [],
        user: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('com_ui_project_tab_memories'));
    expect(screen.getByText('com_ui_project_no_memories')).toBeInTheDocument();
  });

  it('shows settings tab with instructions', () => {
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: {
        projectId: 'p1',
        name: 'Test Project',
        instructions: 'Be helpful',
        model: 'gpt-4',
        user: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('com_ui_project_tab_settings'));
    expect(screen.getByText('Be helpful')).toBeInTheDocument();
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('shows settings tab without instructions', () => {
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: {
        projectId: 'p1',
        name: 'Test Project',
        instructions: '',
        model: '',
        user: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('com_ui_project_tab_settings'));
    expect(screen.getByText('com_ui_project_no_instructions')).toBeInTheDocument();
  });

  it('shows edit button when user has edit permission', () => {
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: {
        projectId: 'p1',
        name: 'Test Project',
        user: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.getByText('com_ui_edit')).toBeInTheDocument();
  });

  it('hides edit button when user lacks edit permission', () => {
    (useProjectPermissions as jest.Mock).mockReturnValue({
      permissions: { canView: true, canEdit: false, canDelete: false, canShare: false },
      isLoading: false,
    });
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: {
        projectId: 'p1',
        name: 'Test Project',
        user: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
    });
    renderPage();
    expect(screen.queryByText('com_ui_edit')).not.toBeInTheDocument();
  });

  it('switches to edit mode when edit button clicked', () => {
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: {
        projectId: 'p1',
        name: 'Test Project',
        user: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('com_ui_edit'));
    expect(screen.getByTestId('project-form')).toBeInTheDocument();
  });

  it('exits edit mode on form success', () => {
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: {
        projectId: 'p1',
        name: 'Test Project',
        user: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      isLoading: false,
    });
    renderPage();
    fireEvent.click(screen.getByText('com_ui_edit'));
    fireEvent.click(screen.getByTestId('submit-form'));
    expect(screen.queryByTestId('project-form')).not.toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });
});
