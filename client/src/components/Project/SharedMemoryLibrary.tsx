import { useMemo, useState } from 'react';
import { Archive, Copy, LinkSimple, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import {
  Button,
  Checkbox,
  Input,
  OGDialog,
  OGDialogTemplate,
  Textarea,
  useToastContext,
} from '@librechat/client';
import { Permissions, PermissionTypes } from 'librechat-data-provider';
import type { TProject } from 'librechat-data-provider';
import {
  useArchiveSharedMemoryMutation,
  useCopySharedMemoryMutation,
  useCreateSharedMemoryMutation,
  useLinkSharedMemoriesMutation,
  useRestoreSharedMemoryMutation,
  useUpdateSharedMemoryMutation,
  useSharedMemoriesQuery,
  useProjectLegacyMemoryCandidatesQuery,
  useSharedMemoryContextStatusQuery,
  useResolveProjectLegacyMemoriesMutation,
  useUnlinkSharedMemoryMutation,
} from '~/data-provider';
import { useHasAccess, useLocalize } from '~/hooks';
import type { TSharedMemory } from '~/data-provider/SharedMemories/types';
import SharedMemoryPortability from './SharedMemoryPortability';

interface Props {
  project?: TProject;
  canEdit: boolean;
}

export default function SharedMemoryLibrary({ project, canEdit }: Props) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [search, setSearch] = useState('');
  const canCreateLibrary = useHasAccess({
    permissionType: PermissionTypes.SHARED_MEMORIES,
    permission: Permissions.CREATE,
  });
  const canUpdateLibrary = useHasAccess({
    permissionType: PermissionTypes.SHARED_MEMORIES,
    permission: Permissions.UPDATE,
  });
  const projectId = project?.projectId;
  const { data, isLoading } = useSharedMemoriesQuery(projectId, 'active', search);
  const { data: accessibleData } = useSharedMemoriesQuery(projectId);
  const { data: archivedData } = useSharedMemoriesQuery(projectId, 'archived');
  const { data: legacyCandidates } = useProjectLegacyMemoryCandidatesQuery(projectId);
  const { data: contextStatus } = useSharedMemoryContextStatusQuery(projectId);
  const resolveLegacy = useResolveProjectLegacyMemoriesMutation();
  const [legacySelections, setLegacySelections] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TSharedMemory | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const create = useCreateSharedMemoryMutation();
  const link = useLinkSharedMemoriesMutation();
  const unlink = useUnlinkSharedMemoryMutation();
  const archive = useArchiveSharedMemoryMutation();
  const restore = useRestoreSharedMemoryMutation();
  const update = useUpdateSharedMemoryMutation();
  const copy = useCopySharedMemoryMutation();
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const linked = useMemo(
    () =>
      data?.items.filter(
        (item) =>
          item.linkedToProject &&
          `${item.key} ${item.value}`.toLocaleLowerCase().includes(normalizedSearch),
      ) ?? [],
    [data, normalizedSearch],
  );
  const available = useMemo(
    () =>
      data?.items.filter(
        (item) =>
          !item.linkedToProject &&
          `${item.key} ${item.value}`.toLocaleLowerCase().includes(normalizedSearch),
      ) ?? [],
    [data, normalizedSearch],
  );
  const legacyKeys = project?.memoryKeys ?? [];

  const notify = (status: 'success' | 'error') =>
    showToast({
      message: localize(status === 'success' ? 'com_ui_saved' : 'com_ui_error'),
      status,
    });
  const toggle = (id: string) =>
    setSelected((old) => (old.includes(id) ? old.filter((item) => item !== id) : [...old, id]));
  const publish = () => {
    if (!key.trim() || !value.trim()) return;
    create.mutate(
      { key: key.trim(), value: value.trim() },
      {
        onSuccess: () => {
          setKey('');
          setValue('');
          notify('success');
        },
        onError: () => notify('error'),
      },
    );
  };
  const addSelected = () =>
    link.mutate(
      { projectId: projectId ?? '', memoryIds: selected },
      {
        onSuccess: () => {
          setSelected([]);
          notify('success');
        },
        onError: () => notify('error'),
      },
    );

  return (
    <section className="space-y-5" aria-label={localize('com_ui_shared_memory_library')}>
      <div className="rounded-2xl border border-border-light bg-surface-secondary p-4">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-primary">
            {localize('com_ui_shared_memory_library')}
          </h3>
          <SharedMemoryPortability
            ids={selected}
            scope="library"
            search={search}
            canCreateLibrary={canCreateLibrary}
            canEditProject={canEdit && projectId != null}
            filteredCount={data?.total}
            accessibleCount={accessibleData?.total}
          />
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          {localize('com_ui_shared_memory_audience')}
        </p>
        {canCreateLibrary && (
          <div className="mt-3 grid min-w-0 gap-2">
            <Input
              className="min-w-0"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder={localize('com_ui_project_memory_key_placeholder')}
            />
            <Textarea
              className="min-w-0"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={localize('com_ui_project_memory_value_placeholder')}
            />
            <Button
              type="button"
              className="justify-self-start"
              onClick={publish}
              disabled={create.isLoading || !key.trim() || !value.trim()}
            >
              <Plus className="mr-1 size-4" />
              {localize('com_ui_publish_memory')}
            </Button>
          </div>
        )}
      </div>
      {legacyKeys.length > 0 && (
        <div
          role="status"
          className="rounded-xl border border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
        >
          {localize('com_ui_project_legacy_memory_warning', { count: legacyKeys.length })}
          {legacyCandidates?.items.map((item) => (
            <div key={item.key} className="mt-2">
              <p>{`${item.key}: ${localize(`com_ui_memory_legacy_${item.status}`)}`}</p>
              {(item.status === 'resolved' || item.status === 'ambiguous') &&
                item.candidates.length > 0 &&
                canEdit && (
                  <div className="mt-1 flex gap-2">
                    <select
                      aria-label={item.key}
                      value={legacySelections[item.key] ?? ''}
                      onChange={(event) =>
                        setLegacySelections((current) => ({
                          ...current,
                          [item.key]: event.target.value,
                        }))
                      }
                    >
                      <option value="">{localize('com_ui_select')}</option>
                      {item.candidates.map((candidate) => (
                        <option key={candidate.memoryId} value={candidate.memoryId}>
                          {candidate.memoryId}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!legacySelections[item.key] || resolveLegacy.isLoading}
                      onClick={() =>
                        projectId &&
                        resolveLegacy.mutate(
                          {
                            projectId,
                            resolutions: [{ key: item.key, memoryId: legacySelections[item.key] }],
                          },
                          { onSuccess: () => notify('success'), onError: () => notify('error') },
                        )
                      }
                    >
                      {localize('com_ui_resolve_memory')}
                    </Button>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
      {contextStatus &&
      (contextStatus.archived ||
        contextStatus.missing ||
        contextStatus.filtered ||
        contextStatus.omittedByLimit) ? (
        <p
          role="status"
          className="rounded-xl border border-amber-400/40 p-3 text-sm text-text-secondary"
        >
          {localize('com_ui_shared_memory_context_unavailable', { ...contextStatus })}
        </p>
      ) : null}

      <div className="rounded-2xl border border-border-light p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium">{localize('com_ui_project_shared_memories')}</h3>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              onClick={addSelected}
              disabled={!selected.length || link.isLoading}
            >
              <LinkSimple className="mr-1 size-4" />
              {localize('com_ui_add_from_library')}
            </Button>
          )}
        </div>
        <Input
          className="mt-3"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={localize('com_ui_search')}
          aria-label={localize('com_ui_search')}
        />
        {isLoading ? (
          <p className="mt-3 text-sm text-text-secondary">{localize('com_ui_loading')}</p>
        ) : (
          <div className="mt-3 space-y-2" role="list">
            {linked.map((memory) => (
              <div
                key={memory.id}
                role="listitem"
                className="flex items-start gap-3 rounded-xl border border-border-light p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{memory.key}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">
                    {memory.value}
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {memory.authorName ?? localize('com_ui_memory_author_removed')}
                  </p>
                </div>
                {canEdit && (
                  <>
                    {canUpdateLibrary && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={localize('com_ui_edit_memory')}
                        onClick={() => {
                          setEditing(memory);
                          setEditKey(memory.key);
                          setEditValue(memory.value);
                        }}
                      >
                        <PencilSimple className="size-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={localize('com_ui_remove_from_project')}
                      onClick={() =>
                        unlink.mutate(
                          { projectId: projectId ?? '', memoryId: memory.id },
                          { onSuccess: () => notify('success'), onError: () => notify('error') },
                        )
                      }
                    >
                      <Trash className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            {!linked.length && (
              <p className="text-sm text-text-secondary">
                {localize('com_ui_project_no_memories')}
              </p>
            )}
            {available.map((memory) => (
              <label
                key={memory.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-light p-3"
              >
                <Checkbox
                  checked={selected.includes(memory.id)}
                  onCheckedChange={() => toggle(memory.id)}
                  disabled={!canEdit}
                  aria-label={memory.key}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{memory.key}</span>
                  <span className="mt-1 block whitespace-pre-wrap text-sm text-text-secondary">
                    {memory.value}
                  </span>
                </span>
                {canEdit && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={localize('com_ui_create_independent_copy')}
                      onClick={(event) => {
                        event.preventDefault();
                        copy.mutate(
                          { id: memory.id, projectId: projectId ?? '' },
                          { onSuccess: () => notify('success'), onError: () => notify('error') },
                        );
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                    {canUpdateLibrary && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={localize('com_ui_archive_memory')}
                        onClick={(event) => {
                          event.preventDefault();
                          setArchiveId(memory.id);
                        }}
                      >
                        <Archive className="size-4" />
                      </Button>
                    )}
                  </>
                )}
              </label>
            ))}
            {archivedData?.items.map((memory) => (
              <div
                key={memory.id}
                className="flex items-center justify-between rounded-xl border border-dashed border-border-light p-3 text-sm text-text-secondary"
              >
                <span>{memory.key}</span>
                {canUpdateLibrary && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      restore.mutate(
                        { id: memory.id, expectedUpdatedAt: memory.updatedAt },
                        {
                          onSuccess: () => notify('success'),
                          onError: () => notify('error'),
                        },
                      )
                    }
                  >
                    {localize('com_ui_restore_memory')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <OGDialog open={archiveId !== null} onOpenChange={(open) => !open && setArchiveId(null)}>
        <OGDialogTemplate
          title={localize('com_ui_archive_memory')}
          main={
            <p className="text-sm text-text-secondary">
              {localize('com_ui_archive_memory_impact')}
            </p>
          }
          selection={{
            selectText: localize('com_ui_archive_memory'),
            selectClasses: 'bg-surface-destructive text-text-on-status',
            selectHandler: () => {
              if (archiveId)
                archive.mutate(
                  {
                    id: archiveId,
                    expectedUpdatedAt:
                      data?.items.find((item) => item.id === archiveId)?.updatedAt ?? '',
                  },
                  {
                    onSuccess: () => {
                      setArchiveId(null);
                      notify('success');
                    },
                    onError: () => notify('error'),
                  },
                );
            },
          }}
        />
      </OGDialog>
      <OGDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <OGDialogTemplate
          title={localize('com_ui_edit_memory')}
          main={
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">{localize('com_ui_edit_memory_impact')}</p>
              <Input value={editKey} onChange={(event) => setEditKey(event.target.value)} />
              <Textarea value={editValue} onChange={(event) => setEditValue(event.target.value)} />
            </div>
          }
          selection={{
            selectText: localize('com_ui_save'),
            selectHandler: () => {
              if (editing)
                update.mutate(
                  {
                    id: editing.id,
                    key: editKey.trim(),
                    value: editValue.trim(),
                    expectedUpdatedAt: editing.updatedAt,
                  },
                  {
                    onSuccess: () => {
                      setEditing(null);
                      notify('success');
                    },
                    onError: () => notify('error'),
                  },
                );
            },
          }}
        />
      </OGDialog>
    </section>
  );
}
