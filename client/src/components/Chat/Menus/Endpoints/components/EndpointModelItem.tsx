import React from 'react';
import { VisuallyHidden } from '@ariakit/react';
import {
  CheckCircle as CheckCircle2,
  GlobeHemisphereWest as EarthIcon,
  PushPin as Pin,
  PushPinSlash as PinOff,
} from '@phosphor-icons/react';
import { isAgentsEndpoint, isAssistantsEndpoint } from 'librechat-data-provider';
import type { Endpoint } from '~/common';
import { useFavorites, useLocalize, useIsActiveItem } from '~/hooks';
import { useModelSelectorContext } from '../ModelSelectorContext';
import { CustomMenuItem as MenuItem } from '../CustomMenu';
import { cn } from '~/utils';

interface EndpointModelItemProps {
  modelId: string | null;
  endpoint: Endpoint;
}

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

export function AgentModelAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-lg px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-1 ring-white/10',
        getColorClass(name),
        className,
      )}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}

export function EndpointModelItem({ modelId, endpoint }: EndpointModelItemProps) {
  const localize = useLocalize();
  const { handleSelectModel, selectedValues } = useModelSelectorContext();
  const {
    endpoint: selectedEndpoint,
    model: selectedModel,
    modelSpec: selectedSpec,
  } = selectedValues;
  const isSelected =
    !selectedSpec && selectedEndpoint === endpoint.value && selectedModel === modelId;
  const { isFavoriteModel, toggleFavoriteModel, isFavoriteAgent, toggleFavoriteAgent } =
    useFavorites();

  const { ref: itemRef, isActive } = useIsActiveItem<HTMLDivElement>();

  let isGlobal = false;
  let modelName = modelId;
  const avatarUrl = endpoint?.modelIcons?.[modelId ?? ''] || null;

  // Use custom names if available
  if (endpoint && modelId && isAgentsEndpoint(endpoint.value) && endpoint.agentNames?.[modelId]) {
    modelName = endpoint.agentNames[modelId];

    const modelInfo = endpoint?.models?.find((m) => m.name === modelId);
    isGlobal = modelInfo?.isGlobal ?? false;
  } else if (
    endpoint &&
    modelId &&
    isAssistantsEndpoint(endpoint.value) &&
    endpoint.assistantNames?.[modelId]
  ) {
    modelName = endpoint.assistantNames[modelId];
  }

  const isAgent = isAgentsEndpoint(endpoint.value);
  const isFavorite = isAgent
    ? isFavoriteAgent(modelId ?? '')
    : isFavoriteModel(modelId ?? '', endpoint.value);

  const handleFavoriteToggle = () => {
    if (!modelId) {
      return;
    }

    if (isAgent) {
      toggleFavoriteAgent(modelId);
    } else {
      toggleFavoriteModel({ model: modelId, endpoint: endpoint.value });
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleFavoriteToggle();
  };

  const renderAvatar = () => {
    const isAgentOrAssistant =
      isAgentsEndpoint(endpoint.value) || isAssistantsEndpoint(endpoint.value);
    const showEndpointIcon = isAgentOrAssistant && endpoint.icon;

    const getContent = () => {
      if (avatarUrl) {
        return <img src={avatarUrl} alt={modelName ?? ''} className="h-full w-full object-cover" />;
      }
      if (isAgent) {
        return <AgentModelAvatar name={modelName ?? modelId ?? 'Agent'} />;
      }
      if (showEndpointIcon) {
        return endpoint.icon;
      }
      return null;
    };

    const content = getContent();
    if (!content) {
      return null;
    }

    return (
      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
        {content}
      </div>
    );
  };

  return (
    <MenuItem
      ref={itemRef}
      onClick={() => handleSelectModel(endpoint, modelId ?? '')}
      aria-selected={isSelected || undefined}
      className="group flex w-full cursor-pointer items-center justify-between rounded-lg px-2 text-sm"
    >
      <div className="flex w-full min-w-0 items-center gap-2 px-1 py-1">
        {renderAvatar()}
        <span className="truncate">{modelName}</span>
        {isGlobal && <EarthIcon className="ml-1 size-4 text-surface-submit" />}
      </div>
      <button
        type="button"
        tabIndex={isActive ? 0 : -1}
        onClick={handleFavoriteClick}
        aria-label={isFavorite ? localize('com_ui_unpin') : localize('com_ui_pin')}
        className={cn(
          'rounded-md p-1 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-primary',
          isFavorite
            ? 'visible'
            : 'invisible group-focus-within:visible group-hover:visible group-data-[active-item]:visible',
        )}
      >
        {isFavorite ? (
          <PinOff className="h-4 w-4 text-text-secondary" aria-hidden="true" />
        ) : (
          <Pin className="h-4 w-4 text-text-secondary" aria-hidden="true" />
        )}
      </button>
      {isSelected && (
        <>
          <CheckCircle2 className="size-4 shrink-0 text-text-primary" aria-hidden="true" />
          <VisuallyHidden>{localize('com_a11y_selected')}</VisuallyHidden>
        </>
      )}
    </MenuItem>
  );
}

export function renderEndpointModels(
  endpoint: Endpoint | null,
  models: Array<{ name: string; isGlobal?: boolean }>,
  filteredModels?: string[],
  endpointIndex?: number,
) {
  const modelsToRender = filteredModels || models.map((model) => model.name);
  const indexSuffix = endpointIndex != null ? `-${endpointIndex}` : '';

  return modelsToRender.map(
    (modelId, modelIndex) =>
      endpoint && (
        <EndpointModelItem
          key={`${endpoint.value}${indexSuffix}-${modelId}-${modelIndex}`}
          modelId={modelId}
          endpoint={endpoint}
        />
      ),
  );
}
