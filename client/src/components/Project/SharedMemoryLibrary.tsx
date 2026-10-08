import { useId, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Permissions, PermissionTypes } from 'librechat-data-provider';
import { Archive, Copy, LinkSimple, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import {
  Button,
  Checkbox,
  Input,
  OGDialog,
  OGDialogTemplate,
  Textarea,
  TooltipAnchor,
  useToastContext,
} from '@librechat/client';
import type { TProject, SharedMemoryLinkOptions } from 'librechat-data-provider';
import type { TSharedMemory } from '~/data-provider/SharedMemories/types';
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
  useSharedMemoryConsumersQuery,
  useResolveProjectLegacyMemoriesMutation,
  useUnlinkSharedMemoryMutation,
} from '~/data-provider';
import SharedMemoryPortability from './SharedMemoryPortability';
import { useHasAccess, useLocalize } from '~/hooks';

interface Props {
  project?: TProject;
  canEdit: boolean;
}

export default function SharedMemoryLibrary({ project, canEdit }: Props) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const formId = useId();
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
  const [linkConflict, setLinkConflict] = useState<{
    memoryIds: string[];
    keys: string[];
    expectedUpdatedAt: string;
  } | null>(null);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TSharedMemory | null>(null);
  const { data: consumers } = useSharedMemoryConsumersQuery(editing?.id ?? archiveId);
  const consumerImpact = (
    <div className="text-sm text-text-secondary">
      {consumers?.visible.map((consumer) => (
        <p key={consumer.projectId}>{consumer.name ?? consumer.projectId}</p>
      ))}
      {consumers?.hasOtherConsumers && <p>{localize('com_ui_memory_other_consumers')}</p>}
    </div>
  );
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState(false);
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
  const addSelected = (options: SharedMemoryLinkOptions = {}) =>
    link.mutate(
      { projectId: projectId ?? '', memoryIds: linkConflict?.memoryIds ?? selected, ...options },
      {
        onSuccess: () => {
          setSelected([]);
          setLinkConflict(null);
          notify('success');
        },
        onError: (error) => {
          if (
            isAxiosError<{ conflicts?: Array<{ key: string }>; expectedUpdatedAt?: string }>(
              error,
            ) &&
            error.response?.status === 409 &&
            error.response.data.conflicts?.length &&
            error.response.data.expectedUpdatedAt
          ) {
            setLinkConflict({
              memoryIds: [...selected],
              keys: error.response.data.conflicts.map((item) => item.key),
              expectedUpdatedAt: error.response.data.expectedUpdatedAt,
            });
            return;
          }
          setLinkConflict(null);
          notify('error');
        },
      },
    );

  const libraryActions = (memory: TSharedMemory) =>
    canUpdateLibrary ? (
      <>
        <TooltipAnchor
          description={localize('com_ui_memory_edit_library_hint')}
          render={<Button type="button" variant="ghost" size="icon" />}
          aria-label={localize('com_ui_edit_memory')}
          onClick={(event) => {
            event.preventDefault();
            setEditing(memory);
            setEditError(false);
            setEditKey(memory.key);
            setEditValue(memory.value);
          }}
        >
          <PencilSimple className="size-4" />
        </TooltipAnchor>
        <TooltipAnchor
          description={localize('com_ui_archive_memory_impact')}
          render={<Button type="button" variant="ghost" size="icon" />}
          aria-label={localize('com_ui_archive_memory')}
          onClick={(event) => {
            event.preventDefault();
            setArchiveId(memory.id);
          }}
        >
          <Archive className="size-4" />
        </TooltipAnchor>
      </>
    ) : null;

  return (
    <section
      className="space-y-5 text-text-primary"
      aria-label={localize('com_ui_shared_memory_library')}
    >
      <div className="rounded-2xl border border-border-light bg-surface-secondary p-4">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text-primary">
            {localize('com_ui_shared_memory_library')}
          </h3>
          <SharedMemoryPortability
            projectId={projectId}
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
            <label htmlFor={`${formId}-key`} className="text-sm font-medium">
              {localize('com_ui_project_memory_key')}
            </label>
            <Input
              id={`${formId}-key`}
              className="min-w-0"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder={localize('com_ui_project_memory_key_placeholder')}
            />
            <p className="text-xs leading-5 text-text-secondary">
              {localize('com_ui_memory_key_hint')}
            </p>
            <label htmlFor={`${formId}-value`} className="mt-1 text-sm font-medium">
              {localize('com_ui_project_memory_value')}
            </label>
            <Textarea
              id={`${formId}-value`}
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
                      className="h-10 min-w-0 rounded-xl border border-border-light bg-surface-primary px-3 text-text-primary dark:[color-scheme:dark]"
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
          <h3 className="text-sm font-medium">
            {localize(
              projectId ? 'com_ui_project_shared_memories' : 'com_ui_memory_library_entries',
            )}
          </h3>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              onClick={() => addSelected()}
              disabled={!selected.length || link.isLoading}
            >
              <LinkSimple className="mr-1 size-4" />
              {localize('com_ui_add_from_library')}
            </Button>
          )}
        </div>
        {projectId && (
          <div className="mt-3 space-y-1 text-sm leading-6 text-text-secondary">
            <p>{localize('com_ui_memory_link_hint')}</p>
            <p>{localize('com_ui_memory_copy_hint')}</p>
          </div>
        )}
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
            {projectId && linked.length > 0 && (
              <h4 className="pt-1 text-xs font-medium text-text-secondary">
                {localize('com_ui_memory_linked_entries')}
              </h4>
            )}
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
                {libraryActions(memory)}
                {canEdit && (
                  <TooltipAnchor
                    description={localize('com_ui_memory_unlink_hint')}
                    render={<Button type="button" variant="ghost" size="icon" />}
                    aria-label={localize('com_ui_remove_from_project')}
                    onClick={() =>
                      unlink.mutate(
                        { projectId: projectId ?? '', memoryId: memory.id },
                        { onSuccess: () => notify('success'), onError: () => notify('error') },
                      )
                    }
                  >
                    <Trash className="size-4" />
                  </TooltipAnchor>
                )}
              </div>
            ))}
            {projectId && !linked.length && (
              <p className="text-sm text-text-secondary">{localize('com_ui_memory_no_links')}</p>
            )}
            {available.length > 0 && projectId && (
              <div className="space-y-1 pt-4">
                <h4 className="text-xs font-medium text-text-secondary">
                  {localize('com_ui_memory_available_entries')}
                </h4>
                <p className="text-xs leading-5 text-text-secondary">
                  {localize('com_ui_memory_available_hint')}
                </p>
              </div>
            )}
            {!available.length && !linked.length && !projectId && (
              <p className="text-sm text-text-secondary">
                {localize('com_ui_memory_library_empty')}
              </p>
            )}
            {available.map((memory) => (
              <div
                key={memory.id}
                role="listitem"
                className="flex items-start gap-3 rounded-xl border border-border-light p-3"
              >
                <Checkbox
                  id={`${formId}-${memory.id}`}
                  checked={selected.includes(memory.id)}
                  onCheckedChange={() => toggle(memory.id)}
                  aria-label={memory.key}
                />
                <label htmlFor={`${formId}-${memory.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block text-sm font-medium">{memory.key}</span>
                  <span className="mt-1 block whitespace-pre-wrap text-sm text-text-secondary">
                    {memory.value}
                  </span>
                </label>
                {libraryActions(memory)}
                {canEdit && (
                  <TooltipAnchor
                    description={localize('com_ui_memory_copy_hint')}
                    render={<Button type="button" variant="ghost" size="icon" />}
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
                  </TooltipAnchor>
                )}
              </div>
            ))}
            {Boolean(archivedData?.items.length) && (
              <div className="space-y-1 pt-4">
                <h4 className="text-xs font-medium text-text-secondary">
                  {localize('com_ui_memory_archived_entries')}
                </h4>
                <p className="text-xs leading-5 text-text-secondary">
                  {localize('com_ui_memory_archived_hint')}
                </p>
              </div>
            )}
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
          className="max-w-lg"
          main={
            <div>
              <p className="text-sm text-text-secondary">
                {localize('com_ui_archive_memory_impact')}
              </p>
              {consumerImpact}
            </div>
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
          className="max-w-lg"
          main={
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">{localize('com_ui_edit_memory_impact')}</p>
              {consumerImpact}
              <label htmlFor={`${formId}-edit-key`} className="block text-sm font-medium">
                {localize('com_ui_project_memory_key')}
              </label>
              <Input
                id={`${formId}-edit-key`}
                aria-label={localize('com_ui_project_memory_key')}
                value={editKey}
                onChange={(event) => setEditKey(event.target.value)}
              />
              <label htmlFor={`${formId}-edit-value`} className="block text-sm font-medium">
                {localize('com_ui_project_memory_value')}
              </label>
              <Textarea
                id={`${formId}-edit-value`}
                aria-label={localize('com_ui_project_memory_value')}
                maxLength={10000}
                value={editValue}
                onChange={(event) => setEditValue(event.target.value)}
              />
              {editError && (
                <div role="alert" className="space-y-2 text-sm text-text-secondary">
                  <p>{localize('com_ui_memory_edit_error')}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const latest =
                        accessibleData?.items.find((item) => item.id === editing?.id) ??
                        archivedData?.items.find((item) => item.id === editing?.id);
                      if (!latest) return;
                      setEditing(latest);
                      setEditKey(latest.key);
                      setEditValue(latest.value);
                      setEditError(false);
                    }}
                  >
                    {localize('com_ui_memory_reload_original')}
                  </Button>
                </div>
              )}
            </div>
          }
          selection={
            <Button
              type="button"
              disabled={update.isLoading || !editKey.trim() || !editValue.trim()}
              onClick={() => {
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
                      onError: () => setEditError(true),
                    },
                  );
              }}
            >
              {localize('com_ui_save')}
            </Button>
          }
        />
      </OGDialog>
      <OGDialog
        open={linkConflict !== null}
        onOpenChange={(open) => !open && setLinkConflict(null)}
      >
        <OGDialogTemplate
          title={localize('com_ui_memory_link_conflict')}
          className="max-w-lg"
          main={
            <div className="space-y-3">
              <p>{localize('com_ui_memory_link_conflict_description')}</p>
              <p>{linkConflict?.keys.join(', ')}</p>
              <Button
                type="button"
                variant="outline"
                disabled={link.isLoading}
                onClick={() =>
                  addSelected({
                    conflictResolution: 'keep-local',
                    expectedUpdatedAt: linkConflict?.expectedUpdatedAt,
                  })
                }
              >
                {localize('com_ui_memory_keep_local')}
              </Button>
            </div>
          }
          selection={{
            selectText: localize('com_ui_memory_use_shared'),
            isLoading: link.isLoading,
            selectHandler: () =>
              addSelected({
                conflictResolution: 'use-shared',
                expectedUpdatedAt: linkConflict?.expectedUpdatedAt,
              }),
          }}
        />
      </OGDialog>
    </section>
  );
}
