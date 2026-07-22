import { useMemo } from 'react';
import { useGetPromptGroup } from '~/data-provider';
import { useLocalize } from '~/hooks';

interface ProjectPromptGroupsProps {
  promptGroupIds: string[];
}

function PromptGroupCard({ groupId }: { groupId: string }) {
  const localize = useLocalize();
  const groupQuery = useGetPromptGroup(groupId);
  const group = groupQuery.data;

  if (groupQuery.isLoading) {
    return (
      <div className="rounded-lg border border-border-light bg-surface-secondary p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-border-light" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="rounded-lg border border-border-light bg-surface-secondary p-4 text-sm text-text-secondary">
        {localize('com_ui_project_prompt_group_not_found')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-light bg-surface-secondary p-4 transition-colors hover:bg-surface-tertiary">
      <div className="text-sm font-medium text-text-primary">{group.name}</div>
      {group.oneliner ? (
        <div className="mt-1 text-xs text-text-secondary">{group.oneliner}</div>
      ) : null}
      {group.category ? (
        <div className="mt-2 inline-block rounded bg-surface-tertiary px-2 py-0.5 text-xs text-text-secondary">
          {group.category}
        </div>
      ) : null}
    </div>
  );
}

export default function ProjectPromptGroups({ promptGroupIds }: ProjectPromptGroupsProps) {
  const localize = useLocalize();

  const uniqueIds = useMemo(() => {
    return [...new Set(promptGroupIds)];
  }, [promptGroupIds]);

  if (uniqueIds.length === 0) {
    return <div className="text-text-secondary">{localize('com_ui_project_no_prompt_groups')}</div>;
  }

  return (
    <div className="space-y-3">
      {uniqueIds.map((id) => (
        <PromptGroupCard key={id} groupId={id} />
      ))}
    </div>
  );
}
