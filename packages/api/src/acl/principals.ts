import { getTenantId, runAsSystem, SYSTEM_TENANT_ID } from '@librechat/data-schemas';
import { PrincipalType, ResourceType, SystemRoles } from 'librechat-data-provider';
import type { TPrincipal } from 'librechat-data-provider';
import type { AllMethods } from '@librechat/data-schemas';
import type { PipelineStage } from 'mongoose';

/** Route callers must authorize SHARE on the exact resource before listing its grants. */
export async function getResourcePermissionEntries({
  resourceType,
  userRole,
  pipeline,
  aggregateAclEntries,
}: {
  resourceType: ResourceType;
  userRole: string;
  pipeline: PipelineStage[];
  aggregateAclEntries: AllMethods['aggregateAclEntries'];
}): Promise<Awaited<ReturnType<AllMethods['aggregateAclEntries']>>> {
  const tenantId = getTenantId();
  const canListSharedTenants =
    userRole === SystemRoles.ADMIN &&
    (resourceType === ResourceType.AGENT || resourceType === ResourceType.PROMPTGROUP);
  if (!canListSharedTenants || !tenantId || tenantId === SYSTEM_TENANT_ID) {
    return aggregateAclEntries(pipeline);
  }
  // Tenant grants live in the destination tenant; other principals stay request-scoped.
  return runAsSystem(async () =>
    aggregateAclEntries([
      { $match: { $or: [{ tenantId }, { principalType: PrincipalType.TENANT }] } },
      ...pipeline,
    ]),
  );
}

export interface DirectoryPrincipalUser {
  id: string;
}

export interface DirectoryPrincipalUserData {
  name?: string;
  email: string;
  emailVerified: false;
  provider: 'openid';
  idOnTheSource: string;
}

export interface DirectoryPrincipalUserMethods {
  findUserBySourceId: (idOnTheSource: string) => Promise<DirectoryPrincipalUser | null>;
  findUserByEmail: (email: string) => Promise<DirectoryPrincipalUser | null>;
  createUser: (user: DirectoryPrincipalUserData) => Promise<string>;
}

type DirectoryPrincipal = Pick<TPrincipal, 'name' | 'email' | 'idOnTheSource'>;

export const ensureDirectoryPrincipalUser = async (
  principal: DirectoryPrincipal,
  methods: DirectoryPrincipalUserMethods,
): Promise<string> => {
  if (!principal.email || !principal.idOnTheSource) {
    throw new Error('Directory user principals must have email and idOnTheSource');
  }

  const userBySourceId = await methods.findUserBySourceId(principal.idOnTheSource);
  if (userBySourceId) {
    return userBySourceId.id;
  }

  const userByEmail = await methods.findUserByEmail(principal.email);
  if (userByEmail) {
    return userByEmail.id;
  }

  return methods.createUser({
    name: principal.name,
    email: principal.email.toLowerCase(),
    emailVerified: false,
    provider: 'openid',
    idOnTheSource: principal.idOnTheSource,
  });
};
