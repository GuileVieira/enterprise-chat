import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SharedMemoryLibrary from '../SharedMemoryLibrary';

const mockArchiveMutate = jest.fn();
const mockRestoreMutate = jest.fn();
const mockResolveLegacyMutate = jest.fn();
let mockLegacyItems: Array<{
  key: string;
  status: string;
  candidates: Array<{ memoryId: string; authorId: string }>;
}> = [];
let mockContextStatus: Record<string, number> | undefined;

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
  useArchiveSharedMemoryMutation: () => ({ mutate: mockArchiveMutate }),
  useCopySharedMemoryMutation: () => ({ mutate: jest.fn() }),
  useCreateSharedMemoryMutation: () => ({ mutate: jest.fn(), isLoading: false }),
  useLinkSharedMemoriesMutation: () => ({ mutate: jest.fn(), isLoading: false }),
  useRestoreSharedMemoryMutation: () => ({ mutate: mockRestoreMutate }),
  useUpdateSharedMemoryMutation: () => ({ mutate: jest.fn() }),
  useSharedMemoriesQuery: (_projectId: string, status?: string) => ({
    data: {
      items:
        status === 'archived'
          ? [{ id: 'archived', key: 'old', updatedAt: '2026-01-02' }]
          : [
              {
                id: 'm1',
                key: 'tone',
                value: 'warm',
                updatedAt: '2026-01-01',
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
  useUnlinkSharedMemoryMutation: () => ({ mutate: jest.fn() }),
}));
jest.mock('~/hooks', () => ({
  useHasAccess: ({ permission }: { permission: string }) => permission === 'UPDATE',
  useLocalize: () => (key: string) => key,
}));
jest.mock('../SharedMemoryPortability', () => () => <div />);

describe('SharedMemoryLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLegacyItems = [];
    mockContextStatus = undefined;
  });

  it('gates publishing on shared-memory create permission', () => {
    render(<SharedMemoryLibrary project={{ projectId: 'p1' } as never} canEdit />);
    expect(screen.queryByRole('button', { name: 'com_ui_publish_memory' })).not.toBeInTheDocument();
  });

  it('sends version when archiving and restoring', () => {
    render(<SharedMemoryLibrary project={{ projectId: 'p1' } as never} canEdit />);
    fireEvent.click(screen.getAllByRole('button', { name: 'com_ui_archive_memory' })[0]);
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
