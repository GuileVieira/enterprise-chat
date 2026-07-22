import { useMemo, memo } from 'react';
import { getEndpointField, isAgentsEndpoint } from 'librechat-data-provider';
import type { Assistant, Agent } from 'librechat-data-provider';
import type { TMessageIcon } from '~/common';
import ConvoIconURL from '~/components/Endpoints/ConvoIconURL';
import { useGetEndpointsQuery } from '~/data-provider';
import Icon from '~/components/Endpoints/Icon';
import { cn, getIconEndpoint } from '~/utils';

type MessageIconProps = {
  iconData?: TMessageIcon;
  assistant?: Assistant;
  agent?: Agent;
};

const AGENT_AVATAR_COLORS = [
  'bg-emerald-700',
  'bg-amber-600',
  'bg-rose-700',
  'bg-sky-700',
  'bg-violet-700',
  'bg-cyan-700',
];

const SPEC_COLOR_CLASSES: Record<string, string> = {
  padrao: 'bg-emerald-700',
  padrão: 'bg-emerald-700',
  avancado: 'bg-amber-600',
  avançado: 'bg-amber-600',
  especialista: 'bg-rose-700',
};

function getInitials(name: string) {
  const cleanName = name
    .replace(/\([^)]*\)/g, '')
    .replace(/^agente\s+/i, '')
    .trim();
  const words = cleanName.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return 'AG';
  }
  return (words[0]?.[0] ?? 'A').toUpperCase();
}

function getSpecColorClass(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^agente\s+/, '')
    .split(/\s|\(/)[0];
  return SPEC_COLOR_CLASSES[normalized];
}

function getColorClass(seed: string) {
  const specColorClass = getSpecColorClass(seed);
  if (specColorClass) {
    return specColorClass;
  }

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AGENT_AVATAR_COLORS[hash % AGENT_AVATAR_COLORS.length];
}

function AgentMessageAvatar({
  name,
  avatar,
  providerIcon,
}: {
  name: string;
  avatar: string;
  providerIcon?: string;
}) {
  const initials = getInitials(name);
  const colorClass = getColorClass(name || initials);
  const title = name || 'Agent';

  return (
    <div className="relative h-full w-full" title={title}>
      <div
        className={cn(
          'flex h-full w-full items-center justify-center overflow-hidden rounded-lg text-[10px] font-semibold leading-none text-white shadow-sm ring-1 ring-white/10',
          avatar ? 'bg-surface-secondary' : colorClass,
        )}
      >
        {avatar ? (
          <img src={avatar} alt={title} className="h-full w-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {providerIcon && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-surface-primary bg-surface-primary shadow-sm">
          <img
            src={providerIcon}
            alt=""
            aria-hidden="true"
            className="h-2.5 w-2.5 object-contain"
          />
        </span>
      )}
    </div>
  );
}

/**
 * Compares only the fields MessageIcon actually renders.
 * `agent.id` / `assistant.id` are intentionally omitted because
 * this component renders display properties only, not identity-derived content.
 */
export function arePropsEqual(prev: MessageIconProps, next: MessageIconProps): boolean {
  const checks: [unknown, unknown][] = [
    [prev.iconData?.endpoint, next.iconData?.endpoint],
    [prev.iconData?.model, next.iconData?.model],
    [prev.iconData?.iconURL, next.iconData?.iconURL],
    [prev.iconData?.modelLabel, next.iconData?.modelLabel],
    [prev.iconData?.isCreatedByUser, next.iconData?.isCreatedByUser],
    [prev.agent?.name, next.agent?.name],
    [prev.agent?.avatar?.filepath, next.agent?.avatar?.filepath],
    [prev.assistant?.name, next.assistant?.name],
    [prev.assistant?.metadata?.avatar, next.assistant?.metadata?.avatar],
  ];

  for (const [prevVal, nextVal] of checks) {
    if (prevVal !== nextVal) {
      return false;
    }
  }
  return true;
}

const MessageIcon = memo(({ iconData, assistant, agent }: MessageIconProps) => {
  const { data: endpointsConfig } = useGetEndpointsQuery();

  const agentName = agent?.name ?? '';
  const agentAvatar = agent?.avatar?.filepath ?? '';
  const assistantName = assistant?.name ?? '';
  const assistantAvatar = assistant?.metadata?.avatar ?? '';
  let avatarURL = '';
  if (assistant) {
    avatarURL = assistantAvatar;
  } else if (agent) {
    avatarURL = agentAvatar;
  }

  const iconURL = iconData?.iconURL;
  const endpoint = useMemo(
    () => getIconEndpoint({ endpointsConfig, iconURL, endpoint: iconData?.endpoint }),
    [endpointsConfig, iconURL, iconData?.endpoint],
  );

  const endpointIconURL = useMemo(
    () => getEndpointField(endpointsConfig, endpoint, 'iconURL'),
    [endpointsConfig, endpoint],
  );

  if (iconData?.isCreatedByUser !== true && (agent || isAgentsEndpoint(iconData?.endpoint))) {
    const displayName =
      iconData?.avatarLabel || agentName || iconData?.modelLabel || iconData?.model || '';
    const providerIcon =
      iconURL != null && (iconURL.includes('http') || iconURL.startsWith('/images/'))
        ? iconURL
        : endpointIconURL;
    return (
      <AgentMessageAvatar name={displayName} avatar={agentAvatar} providerIcon={providerIcon} />
    );
  }

  if (
    iconData?.isCreatedByUser !== true &&
    !assistant &&
    (iconData?.avatarLabel || (iconData?.modelLabel && iconData.modelLabel !== iconData.model))
  ) {
    const displayName = iconData.avatarLabel || iconData.modelLabel || '';
    const providerIcon =
      iconURL != null && (iconURL.includes('http') || iconURL.startsWith('/images/'))
        ? iconURL
        : endpointIconURL;
    return <AgentMessageAvatar name={displayName} avatar={avatarURL} providerIcon={providerIcon} />;
  }

  if (iconData?.isCreatedByUser !== true && iconURL != null && iconURL.includes('http')) {
    return (
      <ConvoIconURL
        iconURL={iconURL}
        modelLabel={iconData?.modelLabel}
        context="message"
        assistantAvatar={assistantAvatar}
        agentAvatar={agentAvatar}
        endpointIconURL={endpointIconURL}
        assistantName={assistantName}
        agentName={agentName}
      />
    );
  }

  return (
    <Icon
      isCreatedByUser={iconData?.isCreatedByUser ?? false}
      endpoint={endpoint}
      iconURL={avatarURL || endpointIconURL}
      model={iconData?.model}
      assistantName={assistantName}
      agentName={agentName}
      size={28.8}
    />
  );
}, arePropsEqual);

MessageIcon.displayName = 'MessageIcon';

export default MessageIcon;
