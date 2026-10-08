import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SharedMemoryLibrary from '../SharedMemoryLibrary';

const mockArchiveMutate = jest.fn();
const mockRestoreMutate = jest.fn();
const mockResolveLegacyMutate = jest.fn();
const mockLinkMutate = jest.fn();
const mockUpdateMutate = jest.fn();
let mockLibraryValue = 'warm';
let mockLibraryUpdatedAt = '2026-01-01';
let mockLegacyItems: Array<{
  key: string;
  status: string;
  candidates: Array<{ memoryId: string; authorId: string }>;
}> = [];
let mockContextStatus: Record<string, number> | undefined;
let mockCanUpdateLibrary = true;

jest.mock('@phosphor-icons/react', () => ({
  Archive: () => null,
  Copy: () => null,
  LinkSimple: () => null,
  PencilSimple: () => null,
  Plus: () => null,
  Trash: () => null,
}));
jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Checkbox: ({
    onCheckedChange,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { onCheckedChange?: () => void }) => (
    <input type="checkbox" onChange={onCheckedChange} {...props} />
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
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
  useArchiveSharedMemoryMutation: () => ({ mutate: mockArchiveMutate }),
  useCopySharedMemoryMutation: () => ({ mutate: jest.fn() }),
  useCreateSharedMemoryMutation: () => ({ mutate: jest.fn(), isLoading: false }),
  useLinkSharedMemoriesMutation: () => ({ mutate: mockLinkMutate, isLoading: false }),
  useRestoreSharedMemoryMutation: () => ({ mutate: mockRestoreMutate }),
  useUpdateSharedMemoryMutation: () => ({ mutate: mockUpdateMutate }),
  useSharedMemoriesQuery: (_projectId: string, status?: string) => ({
    data: {
      items:
        status === 'archived'
          ? [{ id: 'archived', key: 'old', updatedAt: '2026-01-02' }]
          : [
              {
                id: 'm1',
                key: 'tone',
                value: mockLibraryValue,
                updatedAt: mockLibraryUpdatedAt,
                linkedToProject: false,
              },
            ],
      total: 1,
      page: 1,
      limit: 50,
    },
    isLoading: false,
  }),
  useProjectLegacyMemoryCandidatesQuery: () => ({ data: { items: mockLegacyItems } }),
  useResolveProjectLegacyMemoriesMutation: () => ({
    mutate: mockResolveLegacyMutate,
    isLoading: false,
  }),
  useSharedMemoryContextStatusQuery: () => ({ data: mockContextStatus }),
  useSharedMemoryConsumersQuery: () => ({
    data: { visible: [{ projectId: 'p2', name: 'Projeto visível' }], hasOtherConsumers: true },
  }),
  useUnlinkSharedMemoryMutation: () => ({ mutate: jest.fn() }),
}));
jest.mock('~/hooks', () => ({
  useHasAccess: ({ permission }: { permission: string }) =>
    permission === 'UPDATE' && mockCanUpdateLibrary,
  useLocalize: () => (key: string) => key,
}));
jest.mock('../SharedMemoryPortability', () => () => <div />);

describe('SharedMemoryLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLinkMutate.mockReset();
    mockUpdateMutate.mockReset();
    mockLibraryValue = 'warm';
    mockLibraryUpdatedAt = '2026-01-01';
    mockLegacyItems = [];
    mockContextStatus = undefined;
    mockCanUpdateLibrary = true;
  });

  it('gates publishing on shared-memory create permission', () => {
    render(<SharedMemoryLibrary project={{ projectId: 'p1' } as never} canEdit />);
    expect(screen.queryByRole('button', { name: 'com_ui_publish_memory' })).not.toBeInTheDocument();
  });

  it('keeps an editing draft after failure and reloads the original explicitly', () => {
    mockUpdateMutate.mockImplementationOnce((_request, callbacks) =>
      callbacks.onError(new Error('conflict')),
    );
    const { rerender } = render(<SharedMemoryLibrary canEdit={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_edit_memory' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'com_ui_project_memory_value' }), {
      target: { value: 'my draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('com_ui_memory_edit_error');
    expect(screen.getByRole('textbox', { name: 'com_ui_project_memory_value' })).toHaveValue(
      'my draft',
    );
    mockLibraryValue = 'concurrent original';
    mockLibraryUpdatedAt = '2026-01-02';
    rerender(<SharedMemoryLibrary canEdit={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_memory_reload_original' }));
    expect(screen.getByRole('textbox', { name: 'com_ui_project_memory_value' })).toHaveValue(
      'concurrent original',
    );
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_save' }));
    expect(mockUpdateMutate.mock.calls[1][0].expectedUpdatedAt).toBe('2026-01-02');
  });

  it('allows library management and export selection without project edit access', () => {
    render(<SharedMemoryLibrary canEdit={false} />);
    expect(screen.getByRole('button', { name: 'com_ui_edit_memory' })).toBeEnabled();
    expect(screen.getByRole('checkbox')).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'com_ui_create_independent_copy' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'com_ui_add_from_library' }),
    ).not.toBeInTheDocument();
  });

  it('does not offer original editing without library UPDATE permission', () => {
    mockCanUpdateLibrary = false;
    render(<SharedMemoryLibrary canEdit={false} />);
    expect(screen.queryByRole('button', { name: 'com_ui_edit_memory' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeEnabled();
  });

  it.each([
    ['com_ui_memory_keep_local', 'keep-local'],
    ['com_ui_memory_use_shared', 'use-shared'],
  ])(
    'sends the explicit conflict choice and preview timestamp: %s',
    (label, conflictResolution) => {
      mockLinkMutate.mockImplementationOnce((_request, callbacks) =>
        callbacks.onError({
          isAxiosError: true,
          response: {
            status: 409,
            data: { conflicts: [{ key: 'tone' }], expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
          },
        }),
      );
      render(<SharedMemoryLibrary project={{ projectId: 'p1' } as never} canEdit />);
      fireEvent.click(screen.getAllByRole('checkbox')[0]);
      fireEvent.click(screen.getByRole('button', { name: 'com_ui_add_from_library' }));
      expect(mockLinkMutate.mock.calls[0][0]).toEqual({ projectId: 'p1', memoryIds: ['m1'] });
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(mockLinkMutate.mock.calls[1][0]).toEqual({
        projectId: 'p1',
        memoryIds: ['m1'],
        conflictResolution,
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
      });
    },
  );

  it('sends version when archiving and restoring', () => {
    render(<SharedMemoryLibrary project={{ projectId: 'p1' } as never} canEdit />);
    fireEvent.click(screen.getAllByRole('button', { name: 'com_ui_archive_memory' })[0]);
    expect(screen.getAllByText('Projeto visível').length).toBeGreaterThan(0);
    expect(screen.getAllByText('com_ui_memory_other_consumers').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'com_ui_archive_memory' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_restore_memory' }));

    expect(mockArchiveMutate.mock.calls[0][0]).toEqual({
      id: 'm1',
      expectedUpdatedAt: '2026-01-01',
    });
    expect(mockRestoreMutate.mock.calls[0][0]).toEqual({
      id: 'archived',
      expectedUpdatedAt: '2026-01-02',
    });
  });

  it('resolves only the selected authorized legacy candidate', () => {
    mockLegacyItems = [
      {
        key: 'legacy-tone',
        status: 'ambiguous',
        candidates: [{ memoryId: 'own-memory', authorId: 'self' }],
      },
    ];
    render(
      <SharedMemoryLibrary
        project={{ projectId: 'p1', memoryKeys: ['legacy-tone'] } as never}
        canEdit
      />,
    );

    fireEvent.change(screen.getByLabelText('legacy-tone'), { target: { value: 'own-memory' } });
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_resolve_memory' }));

    expect(mockResolveLegacyMutate).toHaveBeenCalledWith(
      { projectId: 'p1', resolutions: [{ key: 'legacy-tone', memoryId: 'own-memory' }] },
      expect.any(Object),
    );
  });

  it('does not offer a resolution action for inaccessible legacy memory', () => {
    mockLegacyItems = [{ key: 'private-key', status: 'inaccessible', candidates: [] }];
    render(
      <SharedMemoryLibrary
        project={{ projectId: 'p1', memoryKeys: ['private-key'] } as never}
        canEdit
      />,
    );

    expect(screen.getByText('private-key: com_ui_memory_legacy_inaccessible')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'com_ui_resolve_memory' })).not.toBeInTheDocument();
  });

  it('warns when shared memories are unavailable to project context', () => {
    mockContextStatus = {
      linked: 4,
      available: 1,
      archived: 1,
      missing: 1,
      filtered: 1,
      omittedByLimit: 1,
    };
    render(<SharedMemoryLibrary project={{ projectId: 'p1' } as never} canEdit />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'com_ui_shared_memory_context_unavailable',
    );
  });
});
