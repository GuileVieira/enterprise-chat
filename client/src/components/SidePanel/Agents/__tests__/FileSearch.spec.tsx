import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { EModelEndpoint, mergeFileConfig } from 'librechat-data-provider';
import type { TEndpointsConfig } from 'librechat-data-provider';
import type { AgentForm } from '~/common';
import FileSearch from '../FileSearch';

const mockEndpointsConfig: TEndpointsConfig = {
  [EModelEndpoint.agents]: { userProvide: false, order: 1 },
  Moonshot: { type: EModelEndpoint.custom, userProvide: false, order: 9999 },
};

let mockFileConfig = mergeFileConfig({ endpoints: { default: { fileLimit: 10 } } });

jest.mock('~/data-provider', () => ({
  useGetEndpointsQuery: () => ({ data: mockEndpointsConfig }),
  useGetFileConfig: ({ select }: { select?: (d: unknown) => unknown }) => ({
    data: select != null ? select(mockFileConfig) : mockFileConfig,
  }),
  useGetStartupConfig: () => ({ data: { sharePointFilePickerEnabled: false } }),
}));

jest.mock('~/hooks', () => ({
  useAgentFileConfig: jest.requireActual('~/hooks/Agents/useAgentFileConfig').default,
  useLocalize: () => (key: string) => key,
  useLazyEffect: () => {},
}));

const mockUseFileHandlingNoChatContext = jest.fn().mockReturnValue({
  handleFileChange: jest.fn(),
});

jest.mock('~/hooks/Files/useFileHandling', () => ({
  useFileHandlingNoChatContext: (...args: unknown[]) => mockUseFileHandlingNoChatContext(...args),
}));

jest.mock('~/hooks/Files/useSharePointFileHandling', () => ({
  useSharePointFileHandlingNoChatContext: () => ({
    handleSharePointFiles: jest.fn(),
    isProcessing: false,
    downloadProgress: 0,
  }),
}));

jest.mock('~/components/SharePoint', () => ({
  SharePointPickerDialog: () => null,
}));

jest.mock('~/components/Chat/Input/Files/FileRow', () => () => null);
jest.mock('../FileSearchCheckbox', () => () => null);

jest.mock('@ariakit/react', () => ({
  MenuButton: ({ children, ...props }: { children: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@librechat/client', () => ({
  SharePointIcon: () => <span />,
  AttachmentIcon: () => <span />,
  DropdownPopup: () => null,
}));

function Wrapper({
  provider,
  fileSearch = false,
  children,
}: {
  provider?: string;
  fileSearch?: boolean;
  children: React.ReactNode;
}) {
  const methods = useForm<AgentForm>({
    defaultValues: {
      provider: provider as AgentForm['provider'],
      file_search: fileSearch,
    },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('FileSearch', () => {
  it('opens file input for a saved agent with File Search enabled', () => {
    const { container } = render(
      <Wrapper fileSearch={true}>
        <FileSearch agent_id="agent_123" />
      </Wrapper>,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error('File input not found');
    }
    const click = jest.spyOn(input, 'click');

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_upload_file_search' }));

    expect(click).toHaveBeenCalled();
    expect(input).not.toBeDisabled();
  });

  it('explains that File Search must be enabled for a saved agent', () => {
    render(
      <Wrapper fileSearch={false}>
        <FileSearch agent_id="agent_123" />
      </Wrapper>,
    );

    expect(screen.getByRole('button', { name: 'com_ui_upload_file_search' })).toBeDisabled();
    expect(screen.getByText('com_agents_file_search_enable_upload')).toBeInTheDocument();
  });

  it('keeps upload disabled until the agent is saved', () => {
    render(
      <Wrapper fileSearch={true}>
        <FileSearch agent_id="new-agent" />
      </Wrapper>,
    );

    expect(screen.getByRole('button', { name: 'com_ui_upload_file_search' })).toBeDisabled();
    expect(screen.getByText('com_agents_file_search_disabled')).toBeInTheDocument();
  });

  it('renders upload UI when file uploads are not disabled', () => {
    mockFileConfig = mergeFileConfig({ endpoints: { default: { fileLimit: 10 } } });
    render(
      <Wrapper provider="Moonshot">
        <FileSearch agent_id="agent-1" />
      </Wrapper>,
    );
    expect(screen.getByText('com_assistants_file_search')).toBeInTheDocument();
  });

  it('returns null when file config is disabled for provider', () => {
    mockFileConfig = mergeFileConfig({
      endpoints: { Moonshot: { disabled: true }, default: { fileLimit: 10 } },
    });
    const { container } = render(
      <Wrapper provider="Moonshot">
        <FileSearch agent_id="agent-1" />
      </Wrapper>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null when agents endpoint config is disabled and no provider config', () => {
    mockFileConfig = mergeFileConfig({
      endpoints: { [EModelEndpoint.agents]: { disabled: true }, default: { fileLimit: 10 } },
    });
    const { container } = render(
      <Wrapper>
        <FileSearch agent_id="agent-1" />
      </Wrapper>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('passes provider as endpointOverride and resolved type as endpointTypeOverride', () => {
    mockFileConfig = mergeFileConfig({ endpoints: { default: { fileLimit: 10 } } });
    mockUseFileHandlingNoChatContext.mockClear();
    render(
      <Wrapper provider="Moonshot">
        <FileSearch agent_id="agent-1" />
      </Wrapper>,
    );
    const params = mockUseFileHandlingNoChatContext.mock.calls[0][0];
    expect(params.endpointOverride).toBe('Moonshot');
    expect(params.endpointTypeOverride).toBe(EModelEndpoint.custom);
  });

  it('falls back to agents for endpointOverride when no provider', () => {
    mockFileConfig = mergeFileConfig({ endpoints: { default: { fileLimit: 10 } } });
    mockUseFileHandlingNoChatContext.mockClear();
    render(
      <Wrapper>
        <FileSearch agent_id="agent-1" />
      </Wrapper>,
    );
    const params = mockUseFileHandlingNoChatContext.mock.calls[0][0];
    expect(params.endpointOverride).toBe(EModelEndpoint.agents);
    expect(params.endpointTypeOverride).toBe(EModelEndpoint.agents);
  });

  it('renders when provider has no specific config and agents config is enabled', () => {
    mockFileConfig = mergeFileConfig({
      endpoints: {
        [EModelEndpoint.agents]: { fileLimit: 20 },
        default: { fileLimit: 10 },
      },
    });
    render(
      <Wrapper provider="Moonshot">
        <FileSearch agent_id="agent-1" />
      </Wrapper>,
    );
    expect(screen.getByText('com_assistants_file_search')).toBeInTheDocument();
  });
});
