import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SharedMemoryPortability from '../SharedMemoryPortability';

const mockPreviewMutate = jest.fn();
const mockImportMutate = jest.fn();
const mockExportMutate = jest.fn();

jest.mock('@phosphor-icons/react', () => ({
  DownloadSimple: () => null,
  UploadSimple: () => null,
}));

jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Dropdown: ({
    value,
    onChange,
    options,
    ariaLabel,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    ariaLabel: string;
  }) => (
    <select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  OGDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OGDialogTemplate: ({
    main,
    selection,
  }: {
    main: React.ReactNode;
    selection: React.ReactElement | { selectText: string; selectHandler: () => void };
  }) => (
    <>
      <div>{main}</div>
      {jest.requireActual<typeof import('react')>('react').isValidElement(selection) ? (
        selection
      ) : (
        <button onClick={(selection as { selectHandler: () => void }).selectHandler}>
          {(selection as { selectText: string }).selectText}
        </button>
      )}
    </>
  ),
  useToastContext: () => ({ showToast: jest.fn() }),
}));

jest.mock('~/data-provider', () => ({
  useSharedMemoryExportMutation: () => ({ mutate: mockExportMutate, isLoading: false }),
  useSharedMemoryImportMutation: () => ({ mutate: mockImportMutate, isLoading: false }),
  useSharedMemoryImportPreviewMutation: () => ({ mutate: mockPreviewMutate, isLoading: false }),
}));

jest.mock('~/hooks', () => ({ useLocalize: () => (key: string) => key }));

const conflict = {
  items: [
    {
      ref: 'r1',
      key: 'tone',
      value: 'new value',
      status: 'conflict' as const,
      existing: {
        id: 'old',
        key: 'tone',
        value: 'old value',
        version: 7,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  ],
};

const result = (failed = false) => ({
  operationId: 'server-op',
  items: [{ ref: 'r1', status: failed ? ('failed' as const) : ('updated' as const) }],
  totals: { created: 0, updated: failed ? 0 : 1, skipped: 0, failed: failed ? 1 : 0 },
});

function renderPortability(
  props: Partial<React.ComponentProps<typeof SharedMemoryPortability>> = {},
) {
  return render(<SharedMemoryPortability projectId="project-1" {...props} />);
}

async function openAndPreview(container: HTMLElement) {
  fireEvent.click(screen.getByRole('button', { name: 'com_ui_import_memories' }));
  fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
    target: { files: [{ name: 'memories.json', text: () => Promise.resolve('{"items":[]}') }] },
  });
  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.click(screen.getByRole('button', { name: 'com_ui_preview' }));
}

describe('SharedMemoryPortability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExportMutate.mockReset();
    Object.defineProperty(global.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => 'operation-id'),
    });
    mockPreviewMutate.mockImplementation((_request, callbacks) => callbacks.onSuccess(conflict));
    mockImportMutate.mockImplementation((_request, callbacks) => callbacks.onSuccess(result()));
  });

  it('sends preview conflict version with replace decision', async () => {
    const { container } = renderPortability();
    await openAndPreview(container);

    fireEvent.change(screen.getByLabelText('tone'), { target: { value: 'replace' } });
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_import' }));

    expect(mockImportMutate.mock.calls[0][0]).toMatchObject({
      decisions: {
        r1: {
          action: 'replace',
          expectedVersion: 7,
          expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      selectedRefs: ['r1'],
    });
  });

  it('sends copyKey for conflict copy', async () => {
    const { container } = renderPortability();
    await openAndPreview(container);

    fireEvent.change(screen.getByLabelText('tone'), { target: { value: 'copy' } });
    fireEvent.change(screen.getByLabelText('com_ui_project_memory_key'), {
      target: { value: 'tone-copy' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_import' }));

    expect(mockImportMutate.mock.calls[0][0].decisions.r1).toEqual({
      action: 'copy',
      expectedVersion: 7,
      expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
      copyKey: 'tone-copy',
    });
  });

  it('retries only failed refs with same operation id', async () => {
    mockImportMutate.mockImplementationOnce((_request, callbacks) =>
      callbacks.onSuccess(result(true)),
    );
    const { container } = renderPortability();
    await openAndPreview(container);
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_import' }));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_retry' }));

    expect(mockImportMutate.mock.calls[1][0]).toMatchObject({ selectedRefs: ['r1'] });
    expect(mockImportMutate.mock.calls[1][0].operationId).toBe(
      mockImportMutate.mock.calls[0][0].operationId,
    );
  });

  it('clears preview when destination changes', async () => {
    const { container } = renderPortability();
    await openAndPreview(container);
    expect(screen.getByText('new value')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'com_ui_memory_destination_personal' }));

    expect(screen.queryByText('new value')).not.toBeInTheDocument();
  });

  it('imports into the current project by default even from its library section', async () => {
    const { container } = renderPortability({ scope: 'library', canCreateLibrary: true });
    await openAndPreview(container);

    expect(screen.getByRole('radio', { name: 'com_ui_memory_destination_project' })).toBeChecked();
    expect(mockPreviewMutate.mock.calls[0][0].destination).toEqual({
      type: 'project',
      projectId: 'project-1',
    });
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_import' }));
    expect(mockImportMutate.mock.calls[0][0].destination).toEqual({
      type: 'project',
      projectId: 'project-1',
    });
  });

  it('explains each destination and allows an explicit library import', async () => {
    const { container } = renderPortability({ scope: 'library', canCreateLibrary: true });
    await openAndPreview(container);

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAccessibleDescription();
    }
    fireEvent.click(screen.getByRole('radio', { name: 'com_ui_shared_memory_library' }));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_preview' }));
    expect(mockPreviewMutate.mock.calls[1][0].destination).toEqual({ type: 'library' });
  });

  it('resets the destination to the current project when reopening', async () => {
    const { container, rerender } = renderPortability({ scope: 'library', canCreateLibrary: true });
    await openAndPreview(container);
    fireEvent.click(screen.getByRole('radio', { name: 'com_ui_memory_destination_personal' }));

    rerender(<SharedMemoryPortability projectId="project-2" scope="library" canCreateLibrary />);
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_import_memories' }));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_preview' }));
    expect(mockPreviewMutate.mock.calls[1][0].destination).toEqual({
      type: 'project',
      projectId: 'project-2',
    });
  });

  it.each([
    { projectId: undefined, canEditProject: false },
    { projectId: 'read-only-project', canEditProject: false },
  ])('does not offer a project destination without edit access: %s', async (props) => {
    const { container } = renderPortability({ ...props, scope: 'library', canCreateLibrary: true });
    await openAndPreview(container);
    expect(screen.queryByRole('radio', { name: 'com_ui_memory_destination_project' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'com_ui_shared_memory_library' })).toBeChecked();
    expect(mockPreviewMutate.mock.calls[0][0].destination).toEqual({ type: 'library' });
  });

  it('exports selected ids independently of search without project id for library', () => {
    Object.assign(URL, { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() });
    const createObjectURL = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:memories');
    const revokeObjectURL = jest.spyOn(URL, 'revokeObjectURL').mockImplementation();
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation();
    mockExportMutate.mockImplementation((_request, callbacks) =>
      callbacks.onSuccess({ items: [] }),
    );
    renderPortability({ scope: 'library', ids: ['m1', 'm2'], search: '  tone  ' });

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_memory_export_json' }));

    expect(mockExportMutate.mock.calls[0][0]).toEqual({
      format: 'json',
      scope: 'library',
      ids: ['m1', 'm2'],
    });
    click.mockRestore();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('exports all filtered server-side instead of loaded page ids', () => {
    Object.assign(URL, { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() });
    jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:memories');
    jest.spyOn(URL, 'revokeObjectURL').mockImplementation();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation();
    mockExportMutate.mockImplementation((_request, callbacks) =>
      callbacks.onSuccess({ items: [] }),
    );
    renderPortability({
      scope: 'library',
      ids: ['loaded-memory'],
      search: 'tone',
      filteredCount: 73,
      accessibleCount: 120,
    });

    fireEvent.change(screen.getByLabelText('com_ui_memory_export_scope'), {
      target: { value: 'filtered' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_memory_export_json' }));

    expect(mockExportMutate.mock.calls[0][0]).toEqual({
      format: 'json',
      scope: 'library',
      search: 'tone',
    });
  });

  it('exports all accessible memories independently of selection and search', () => {
    renderPortability({ scope: 'library', ids: ['m1'], search: 'tone', accessibleCount: 120 });
    fireEvent.change(screen.getByLabelText('com_ui_memory_export_scope'), {
      target: { value: 'accessible' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_memory_export_json' }));
    expect(mockExportMutate.mock.calls[0][0]).toEqual({ format: 'json', scope: 'library' });
  });

  it('preserves the chosen agent partition for personal import and export', async () => {
    const { container } = renderPortability({
      projectId: undefined,
      scope: 'personal',
      agentId: 'agent-1',
    });
    await openAndPreview(container);
    expect(mockPreviewMutate.mock.calls[0][0].destination).toEqual({
      type: 'personal',
      agentId: 'agent-1',
    });
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_memory_export_json' }));
    expect(mockExportMutate.mock.calls[0][0]).toMatchObject({
      scope: 'personal',
      agentId: 'agent-1',
    });
  });

  it('identifies current and file contents before an overwrite and explains the selected action', async () => {
    const { container } = renderPortability();
    await openAndPreview(container);
    const current = screen.getByText('com_ui_memory_conflict_current').parentElement;
    const file = screen.getByText('com_ui_memory_conflict_file').parentElement;
    expect(current).toHaveTextContent('old value');
    expect(file).toHaveTextContent('new value');
    expect(screen.getByLabelText('tone')).toHaveValue('skip');
    expect(screen.getByLabelText('tone')).toHaveAccessibleDescription(
      'com_ui_memory_conflict_skip_description',
    );
    fireEvent.change(screen.getByLabelText('tone'), { target: { value: 'replace' } });
    expect(screen.getByLabelText('tone')).toHaveAccessibleDescription(
      'com_ui_memory_conflict_replace_description',
    );
  });

  it('names the export origin and avoids invented zero counts', () => {
    renderPortability({ projectId: undefined, scope: 'personal', search: 'tone' });
    expect(screen.getByText('com_ui_memory_export_personal')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'com_ui_memory_export_filtered_uncounted' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'com_ui_memory_export_accessible_uncounted' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'com_ui_memory_export_filtered' })).toBeNull();
  });

  it('visibly switches to all-source export when the selected items disappear', () => {
    const { rerender } = renderPortability({ scope: 'library', ids: ['m1'], accessibleCount: 2 });
    rerender(
      <SharedMemoryPortability
        projectId="project-1"
        scope="library"
        ids={[]}
        accessibleCount={2}
      />,
    );
    expect(screen.getByLabelText('com_ui_memory_export_scope')).toHaveValue('accessible');
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_memory_export_json' }));
    expect(mockExportMutate.mock.calls[0][0]).toEqual({ format: 'json', scope: 'library' });
  });
});
