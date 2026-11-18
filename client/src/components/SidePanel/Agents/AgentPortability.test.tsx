/* eslint-disable i18next/no-literal-string */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { dataService } from 'librechat-data-provider';
import AgentPortability from './AgentPortability';

jest.mock('librechat-data-provider', () => ({
  QueryKeys: { agents: 'agents' },
  dataService: { previewAgentImport: jest.fn(), importAgent: jest.fn(), exportAgent: jest.fn() },
}));
jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, vars?: { name?: string }) =>
    vars?.name ? `${key}: ${vars.name}` : key,
}));
jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  OGDialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div>
        <button onClick={() => onOpenChange(false)}>cancel</button>
        {children}
      </div>
    ) : null,
  OGDialogTemplate: ({
    title,
    main,
    selection,
  }: {
    title: string;
    main: React.ReactNode;
    selection: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {main}
      {selection}
    </div>
  ),
  useToastContext: () => ({ showToast: jest.fn() }),
}));

const renderPanel = (canCreate = true, canExport = true) => {
  const onImported = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AgentPortability
        agentId="id"
        agentName="Agent"
        canCreate={canCreate}
        canExport={canExport}
        onImported={onImported}
      />
    </QueryClientProvider>,
  );
  return onImported;
};

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

test('previews dependencies and creates only after confirmation', async () => {
  const preview = jest.mocked(dataService.previewAgentImport).mockResolvedValue({
    name: 'Agent',
    skills: ['Skill'],
    tools: ['Tool'],
    warnings: ['Unavailable'],
  });
  const create = jest
    .mocked(dataService.importAgent)
    .mockResolvedValue({ id: 'new' } as Awaited<ReturnType<typeof dataService.importAgent>>);
  const onImported = renderPanel();
  fireEvent.click(screen.getByText('com_agent_import_zip'));
  const file = new File(['zip'], 'agent.zip', { type: 'application/zip' });
  fireEvent.change(screen.getByLabelText('com_agent_import_file'), { target: { files: [file] } });
  fireEvent.click(screen.getByText('com_ui_preview'));
  expect(await screen.findByText('Unavailable')).toBeInTheDocument();
  expect(preview).toHaveBeenCalledWith(file);
  expect(create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('com_ui_import'));
  await waitFor(() => expect(onImported).toHaveBeenCalledWith('new'));
  expect(create).toHaveBeenCalledWith(file);
});

test('failed preview does not enable import', async () => {
  jest.mocked(dataService.previewAgentImport).mockRejectedValue(new Error('bad zip'));
  const create = jest.mocked(dataService.importAgent);
  renderPanel();
  fireEvent.click(screen.getByText('com_agent_import_zip'));
  fireEvent.change(screen.getByLabelText('com_agent_import_file'), {
    target: { files: [new File(['x'], 'bad.zip')] },
  });
  fireEvent.click(screen.getByText('com_ui_preview'));
  await waitFor(() => expect(screen.getByText('com_ui_preview')).not.toBeDisabled());
  expect(create).not.toHaveBeenCalled();
});

test('hides actions without permission', () => {
  renderPanel(false, false);
  expect(screen.queryByText('com_agent_import_zip')).not.toBeInTheDocument();
  expect(screen.queryByText('com_agent_export_zip')).not.toBeInTheDocument();
});

test('downloads returned binary', async () => {
  const blob = new Blob(['zip'], { type: 'application/zip' });
  jest.mocked(dataService.exportAgent).mockResolvedValue(blob);
  const createURL = jest.fn().mockReturnValue('blob:agent');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  renderPanel();
  fireEvent.click(screen.getByText('com_agent_export_zip'));
  await waitFor(() => expect(createURL).toHaveBeenCalledWith(blob));
});

test('cancel after preview does not create an agent', async () => {
  jest
    .mocked(dataService.previewAgentImport)
    .mockResolvedValue({ name: 'Agent', skills: [], tools: [], warnings: [] });
  renderPanel();
  fireEvent.click(screen.getByText('com_agent_import_zip'));
  fireEvent.change(screen.getByLabelText('com_agent_import_file'), {
    target: { files: [new File(['x'], 'agent.zip')] },
  });
  fireEvent.click(screen.getByText('com_ui_preview'));
  await screen.findByText('com_ui_import');
  fireEvent.click(screen.getByText('cancel'));
  expect(dataService.importAgent).not.toHaveBeenCalled();
  expect(screen.queryByText('com_ui_import')).not.toBeInTheDocument();
});

test('localizes known dependency warnings and retains unknown warnings', async () => {
  jest.mocked(dataService.previewAgentImport).mockResolvedValue({
    name: 'Agent',
    skills: [],
    tools: [],
    warnings: [
      'Reconnect tool in destination: Search',
      'Reuse unchanged skill in destination: Writer',
      'All skills scope uses the destination catalog.',
      'Unknown warning',
    ],
  });
  renderPanel();
  fireEvent.click(screen.getByText('com_agent_import_zip'));
  fireEvent.change(screen.getByLabelText('com_agent_import_file'), {
    target: { files: [new File(['x'], 'agent.zip')] },
  });
  fireEvent.click(screen.getByText('com_ui_preview'));
  expect(await screen.findByText('com_agent_import_warning_reconnect: Search')).toBeInTheDocument();
  expect(screen.getByText('com_agent_import_warning_reuse: Writer')).toBeInTheDocument();
  expect(screen.getByText('com_agent_import_warning_all_skills')).toBeInTheDocument();
  expect(screen.getByText('Unknown warning')).toBeInTheDocument();
});
