import { apiBaseUrl } from 'librechat-data-provider';
import type { Artifact } from '~/common';

export type ShareLinkSearch = {
  artifactId?: string;
  artifactIndex?: number;
};

type SharedArtifacts = Record<string, Artifact | undefined> | null | undefined;

const getShareBase = (shareLinkBaseUrl?: string) => {
  if (!shareLinkBaseUrl) {
    return new URL(window.location.origin);
  }

  try {
    return new URL(shareLinkBaseUrl);
  } catch {
    return new URL(window.location.origin);
  }
};

const getShareUrl = (path: string, shareLinkBaseUrl?: string) => {
  const base = getShareBase(shareLinkBaseUrl);
  const basePath = base.pathname.replace(/\/$/, '');
  const normalizedPath = path.replace(/^\//, '');
  return new URL(`${basePath}/${normalizedPath}`, base.origin);
};

const applyShareSearch = (url: URL, search?: ShareLinkSearch) => {
  if (search?.artifactId) {
    url.searchParams.set('artifact', search.artifactId);
  }
  if (typeof search?.artifactIndex === 'number') {
    url.searchParams.set('artifactIndex', search.artifactIndex.toString());
  }
  return url.toString();
};

export const findShareArtifactId = (
  artifacts: SharedArtifacts,
  artifactId: string | null,
  artifactIndexParam?: string | null,
) => {
  if (!artifacts) {
    return null;
  }

  const artifactIndex = artifactIndexParam != null ? Number(artifactIndexParam) : null;
  let targetId = artifactId && artifacts[artifactId] ? artifactId : null;

  if (!targetId && artifactId) {
    const stableKey = artifactId.split('_').slice(0, -1).join('_');
    const match = Object.entries(artifacts).find(([candidateId]) => {
      return stableKey.length > 0 && candidateId.startsWith(`${stableKey}_`);
    });
    targetId = match?.[0] ?? null;
  }

  if (!targetId && Number.isInteger(artifactIndex)) {
    const match = Object.entries(artifacts).find(([, artifact]) => {
      return artifact?.index === artifactIndex;
    });
    targetId = match?.[0] ?? null;
  }

  return targetId;
};

export const buildShareLinkUrl = (
  shareId: string,
  search?: ShareLinkSearch,
  shareLinkBaseUrl?: string,
): string => {
  const baseURL = apiBaseUrl();
  return applyShareSearch(getShareUrl(`${baseURL}/share/${shareId}`, shareLinkBaseUrl), search);
};

export const buildTenantShareLinkUrl = (
  shareId: string,
  search?: ShareLinkSearch,
  shareLinkBaseUrl?: string,
): string => {
  const baseURL = apiBaseUrl();
  return applyShareSearch(
    getShareUrl(`${baseURL}/share/tenant/${shareId}`, shareLinkBaseUrl),
    search,
  );
};
