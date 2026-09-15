import React, { memo } from 'react';
import { Robot } from '@phosphor-icons/react';
import { ProviderIcon } from '@librechat/client';
import type { TModelSpec, TEndpointsConfig } from 'librechat-data-provider';
import { EntityEndpointMark, isEntityEndpoint } from '~/components/Endpoints/EntityEndpointMark';
import { URLIcon } from '~/components/Endpoints/URLIcon';
import { useProviderIcon } from '~/hooks/Endpoint';
import { getModelSpecIconURL } from '~/utils';

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? 'A').toUpperCase();
}

function LabeledAgentAvatar({ name }: { name: string }) {
  return (
    <div
      role="img"
      aria-label={name}
      title={name}
      className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-1 ring-white/10"
    >
      {name ? getInitials(name) : <Robot size={14} aria-hidden="true" />}
    </div>
  );
}

interface SpecIconProps {
  currentSpec: TModelSpec;
  endpointsConfig: TEndpointsConfig;
  /** Avatar of the agent this spec targets, used when the spec defines no icon of its own. */
  agentAvatarURL?: string;
}

const SpecIcon: React.FC<SpecIconProps> = ({ currentSpec, endpointsConfig, agentAvatarURL }) => {
  const explicitIconURL = currentSpec.iconURL || currentSpec.preset?.iconURL;
  const iconURL = getModelSpecIconURL(currentSpec, agentAvatarURL);
  const endpoint = currentSpec.preset?.endpoint;
  const { provider, imageURL } = useProviderIcon({ endpoint, endpointsConfig, iconURL });
  const { provider: fallbackProvider } = useProviderIcon({ endpoint, endpointsConfig });

  if (!explicitIconURL && !agentAvatarURL) {
    return <LabeledAgentAvatar name={currentSpec.label || currentSpec.name} />;
  }

  if (imageURL) {
    return (
      <URLIcon
        iconURL={imageURL}
        altName={currentSpec.name}
        containerStyle={{ width: 20, height: 20 }}
        className="icon-md shrink-0 overflow-hidden rounded-full"
        provider={fallbackProvider}
      />
    );
  }

  if (isEntityEndpoint(iconURL || endpoint)) {
    return <EntityEndpointMark endpoint={iconURL || endpoint} />;
  }

  return (
    <ProviderIcon
      provider={provider}
      model={currentSpec.preset?.model}
      size={20}
      className="icon-md shrink-0"
    />
  );
};

export default memo(SpecIcon);
