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
  OGDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OGDialogTemplate: ({
    main,
    selection,
  }: {
    main: React.ReactNode;
    selection: { selectText: string; selectHandler: () => void };
  }) => (
    <>
      <div>{main}</div>
      <button onClick={selection.selectHandler}>{selection.selectText}</button>
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

    fireEvent.change(container.querySelector('select') as HTMLSelectElement, {
      target: { value: 'personal' },
    });

    expect(screen.queryByText('new value')).not.toBeInTheDocument();
  });

  it('exports requested scope, selected ids, and search without project id for library', () => {
    Object.assign(URL, { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() });
    const createObjectURL = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:memories');
    const revokeObjectURL = jest.spyOn(URL, 'revokeObjectURL').mockImplementation();
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation();
    mockExportMutate.mockImplementation((_request, callbacks) =>
      callbacks.onSuccess({ items: [] }),
    );
    renderPortability({ scope: 'library', ids: ['m1', 'm2'], search: '  tone  ' });

    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));

    expect(mockExportMutate.mock.calls[0][0]).toEqual({
      format: 'json',
      scope: 'library',
      ids: ['m1', 'm2'],
      search: 'tone',
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
    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));

    expect(mockExportMutate.mock.calls[0][0]).toEqual({
      format: 'json',
      scope: 'library',
      search: 'tone',
    });
  });
});
