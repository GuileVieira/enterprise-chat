import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import CreatePromptForm from '../CreatePromptForm';

const mockMutate = jest.fn();
let rejectPendingMutation: () => void;

jest.mock('@librechat/client', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
    Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
      (props, ref) => <input ref={ref} {...props} />,
    ),
    Spinner: () => <span data-testid="spinner" />,
    TextareaAutosize: React.forwardRef<
      HTMLTextAreaElement,
      React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number; maxRows?: number }
    >(({ minRows: _minRows, maxRows: _maxRows, ...props }, ref) => (
      <textarea ref={ref} {...props} />
    )),
    useMediaQuery: () => false,
  };
});

jest.mock('~/Providers', () => ({
  usePromptGroupsContext: () => ({ hasAccess: true }),
}));

jest.mock('~/hooks', () => ({
  useAuthContext: () => ({ user: { role: 'USER' } }),
  useHasAccess: () => true,
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/data-provider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useCreatePrompt: (options: { onError?: () => void }) => {
      const [isLoading, setIsLoading] = React.useState(false);
      rejectPendingMutation = () => {
        setIsLoading(false);
        options.onError?.();
      };
      return {
        isLoading,
        mutate: (payload: unknown) => {
          mockMutate(payload);
          setIsLoading(true);
        },
      };
    },
  };
});

jest.mock('~/data-provider/admin', () => ({
  useListAdminTenants: () => ({ data: undefined }),
}));

jest.mock('~/components/Chat/Menus/OpenSidebar', () => () => null);
jest.mock('../../fields/CategorySelector', () => () => <div />);
jest.mock('../../editor/VariablesDropdown', () => () => <div />);
jest.mock('../../display/PromptVariables', () => () => <div />);
jest.mock('../../fields/Description', () => () => <div />);
jest.mock('../../fields/Command', () => () => <div />);
jest.mock('~/utils', () => ({
  cn: (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' '),
}));

function renderForm(children: ReactNode = <CreatePromptForm isDialog />) {
  return render(<MemoryRouter>{children}</MemoryRouter>);
}

describe('CreatePromptForm', () => {
  beforeEach(() => {
    mockMutate.mockClear();
    window.localStorage.clear();
  });

  it('blocks a second submit while prompt creation is pending', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('com_ui_prompt_name'), {
      target: { value: 'Prompt name' },
    });
    fireEvent.change(screen.getByLabelText('com_ui_prompt_input_field'), {
      target: { value: 'Secret prompt body' },
    });

    const submit = screen.getByRole('button', { name: 'com_ui_create_prompt' });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    fireEvent.submit(submit.closest('form') as HTMLFormElement);

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    const pendingSubmit = screen.getByRole('button', { name: 'com_ui_create_prompt' });
    await waitFor(() => expect(pendingSubmit).toHaveAttribute('aria-busy', 'true'));
    expect(pendingSubmit).toBeDisabled();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it('allows retry after a failed creation releases the pending guard', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('com_ui_prompt_name'), {
      target: { value: 'Prompt name' },
    });
    fireEvent.change(screen.getByLabelText('com_ui_prompt_input_field'), {
      target: { value: 'Prompt body' },
    });

    const submit = screen.getByRole('button', { name: 'com_ui_create_prompt' });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));

    act(() => rejectPendingMutation());
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(2));
  });
});
