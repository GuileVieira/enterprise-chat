import { Types } from 'mongoose';
import { PrincipalType, ResourceType, SystemRoles } from 'librechat-data-provider';
import type { Model } from 'mongoose';
import type { IAgent, IUser } from '~/types';
import { getTenantId, getUserId, SYSTEM_TENANT_ID } from '~/config/tenantContext';
import { createAclEntryMethods } from '../aclEntry';

/** Global agents remain shared; only a scoped admin with a direct ACL may manage them. */
export async function hasGlobalAgentPermission(
  mongoose: typeof import('mongoose'),
  resourceId: string,
  permission: number,
): Promise<boolean> {
  const tenantId = getTenantId();
  const userId = getUserId();
  if (
    !tenantId ||
    tenantId === SYSTEM_TENANT_ID ||
    !userId ||
    !Types.ObjectId.isValid(resourceId)
  ) {
    return false;
  }
  const User = mongoose.models.User as Model<IUser>;
  const Agent = mongoose.models.Agent as Model<IAgent>;
  const admin = await User.exists({ _id: userId, role: SystemRoles.ADMIN });
  if (!admin || !(await Agent.exists({ _id: resourceId, tenantId: null }))) {
    return false;
  }
  return createAclEntryMethods(mongoose).hasPermission(
    [{ principalType: PrincipalType.USER, principalId: userId }],
    ResourceType.AGENT,
    resourceId,
    permission,
  );
}
