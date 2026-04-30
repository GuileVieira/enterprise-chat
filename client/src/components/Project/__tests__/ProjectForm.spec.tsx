import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectForm from '../ProjectForm';

const mockNavigate = jest.fn();
const mockCreateMutateAsync = jest.fn();
const mockUpdateMutateAsync = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('~/data-provider', () => ({
  useGetEndpointsQuery: jest.fn(),
  useCreateProjectMutation: () => ({
    mutateAsync: mockCreateMutateAsync,
    isLoading: false,
  }),
  useUpdateProjectMutation: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isLoading: false,
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key) => key,
}));

jest.mock('~/utils', () => ({
  cn: (...classes) => classes.filter(Boolean).join(' '),
}));

import { useGetEndpointsQuery } from '~/data-provider';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

function renderForm(props = {}) {
  const queryClient = createQueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProjectForm {...props} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ProjectForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useGetEndpointsQuery as jest.Mock).mockReturnValue({
      data: {
        openAI: { name: 'OpenAI' },
        azureOpenAI: { name: 'Azure' },
      },
    });
  });

  describe('creation mode', () => {
    it('renders creation title', () => {
      renderForm();
      expect(screen.getByText('com_ui_new_project')).toBeInTheDocument();
    });

    it('shows validation error when name is empty', () => {
      renderForm();
      fireEvent.click(screen.getByText('com_ui_create'));
      expect(screen.getByText('com_ui_project_name_required')).toBeInTheDocument();
      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });

    it('creates project and navigates on submit', async () => {
      mockCreateMutateAsync.mockResolvedValue({ projectId: 'new-proj' });
      renderForm();

      fireEvent.change(screen.getByPlaceholderText('com_ui_project_name_placeholder'), {
        target: { value: 'My Project' },
      });
      fireEvent.click(screen.getByText('com_ui_create'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith({
          name: 'My Project',
          description: undefined,
          instructions: undefined,
          endpoint: undefined,
          model: undefined,
        });
      });
      expect(mockNavigate).toHaveBeenCalledWith('/projects/new-proj');
    });

    it('submits with optional fields', async () => {
      mockCreateMutateAsync.mockResolvedValue({ projectId: 'new-proj' });
      renderForm();

      fireEvent.change(screen.getByPlaceholderText('com_ui_project_name_placeholder'), {
        target: { value: 'My Project' },
      });
      fireEvent.change(screen.getByPlaceholderText('com_ui_project_description_placeholder'), {
        target: { value: 'A description' },
      });
      fireEvent.change(screen.getByPlaceholderText('com_ui_project_instructions_placeholder'), {
        target: { value: 'Be helpful' },
      });

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'openAI' } });

      fireEvent.change(screen.getByPlaceholderText('com_ui_project_model_placeholder'), {
        target: { value: 'gpt-4' },
      });

      fireEvent.click(screen.getByText('com_ui_create'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith({
          name: 'My Project',
          description: 'A description',
          instructions: 'Be helpful',
          endpoint: 'openAI',
          model: 'gpt-4',
        });
      });
    });

    it('shows error on mutation failure', async () => {
      mockCreateMutateAsync.mockRejectedValue(new Error('fail'));
      renderForm();

      fireEvent.change(screen.getByPlaceholderText('com_ui_project_name_placeholder'), {
        target: { value: 'My Project' },
      });
      fireEvent.click(screen.getByText('com_ui_create'));

      await waitFor(() => {
        expect(screen.getByText('com_ui_project_save_error')).toBeInTheDocument();
      });
    });

    it('navigates back on cancel', () => {
      renderForm();
      fireEvent.click(screen.getByText('com_ui_cancel'));
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('edit mode', () => {
    const project = {
      projectId: 'p1',
      name: 'Existing Project',
      description: 'Existing desc',
      instructions: 'Existing instructions',
      endpoint: 'openAI',
      model: 'gpt-4',
      user: 'user-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('renders edit title and pre-fills fields', () => {
      renderForm({ project });
      expect(screen.getByText('com_ui_edit_project')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Existing Project')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Existing desc')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Existing instructions')).toBeInTheDocument();
      expect(screen.getByDisplayValue('gpt-4')).toBeInTheDocument();
    });

    it('updates project and calls onSuccess', async () => {
      mockUpdateMutateAsync.mockResolvedValue({ ...project, name: 'Updated' });
      const onSuccess = jest.fn();
      renderForm({ project, onSuccess });

      fireEvent.change(screen.getByDisplayValue('Existing Project'), {
        target: { value: 'Updated' },
      });
      fireEvent.click(screen.getByText('com_ui_save'));

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
          projectId: 'p1',
          payload: {
            name: 'Updated',
            description: 'Existing desc',
            instructions: 'Existing instructions',
            endpoint: 'openAI',
            model: 'gpt-4',
          },
        });
      });
      expect(onSuccess).toHaveBeenCalled();
    });

    it('trims whitespace from fields on submit', async () => {
      mockCreateMutateAsync.mockResolvedValue({ projectId: 'new-proj' });
      renderForm();

      fireEvent.change(screen.getByPlaceholderText('com_ui_project_name_placeholder'), {
        target: { value: '  My Project  ' },
      });
      fireEvent.change(screen.getByPlaceholderText('com_ui_project_description_placeholder'), {
        target: { value: '  desc  ' },
      });
      fireEvent.click(screen.getByText('com_ui_create'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith({
          name: 'My Project',
          description: 'desc',
          instructions: undefined,
          endpoint: undefined,
          model: undefined,
        });
      });
    });
  });
});
