import mongoose from 'mongoose';
import type { Response } from 'express';
import type { IProject } from '@librechat/data-schemas';

import { isScalarString } from './shared';
import type { AuthenticatedRequest } from './sharedRouteHandlers';

type LifecycleRequest = AuthenticatedRequest & {
  user: AuthenticatedRequest['user'] & { role?: string };
  params: AuthenticatedRequest['params'] & {
    id?: string;
    projectId?: string;
    userId?: string;
  };
  body: { userId?: unknown };
};

interface ProjectRecord extends IProject {
  _id: mongoose.Types.ObjectId;
}

interface ProjectSummary {
  _id: mongoose.Types.ObjectId;
  projectId: string;
  name?: string;
}

interface TenantUserRecord {
  _id: mongoose.Types.ObjectId;
  name?: string;
}

interface ProjectPermissionInput {
  userId: string;
  role?: string;
  resourceType: string;
  resourceId: mongoose.Types.ObjectId;
  requiredPermission: number;
}

interface ProjectOwnerGrantInput {
  principalType: string;
  principalId: mongoose.Types.ObjectId;
  resourceType: string;
  resourceId: mongoose.Types.ObjectId;
  accessRoleId: string;
  grantedBy: string;
}

export interface SharedMemoryLifecycleDependencies {
  projectFor(req: AuthenticatedRequest, permission: number): Promise<ProjectRecord | null>;
  checkPermission(input: ProjectPermissionInput): Promise<boolean>;
  grantPermission(input: ProjectOwnerGrantInput): Promise<unknown>;
  projectViewPermission: number;
  projectEditPermission: number;
  resourceTypeProject: string;
  principalTypeUser: string;
  projectOwnerAccessRoleId: string;
}

export interface SharedMemoryLifecycleHandlers {
  selfDeletionImpact(req: LifecycleRequest, res: Response): Promise<void>;
  userDeletionImpact(req: LifecycleRequest, res: Response): Promise<void>;
  projectDeletionImpact(req: LifecycleRequest, res: Response): Promise<void>;
  reassignOwner(req: LifecycleRequest, res: Response): Promise<void>;
  consumers(req: LifecycleRequest, res: Response): Promise<void>;
}

const validObjectId = (value: unknown): value is string =>
  isScalarString(value, 24) && mongoose.isObjectIdOrHexString(value);

const isTenantManager = (role: string | undefined): boolean =>
  ['ADMIN', 'OWNER'].includes(String(role).toUpperCase());

export function createSharedMemoryLifecycleHandlers(
  deps: SharedMemoryLifecycleDependencies,
): SharedMemoryLifecycleHandlers {
  const deletionImpact = async (
    req: LifecycleRequest,
    res: Response,
    requestedUserId: unknown,
  ): Promise<void> => {
    if (!validObjectId(requestedUserId)) {
      res.status(400).json({ error: 'Invalid user ID.' });
      return;
    }
    if (requestedUserId !== req.user.id && !isTenantManager(req.user.role)) {
      res.status(403).json({ error: 'Permission denied.' });
      return;
    }
    const user = await mongoose.models.User.findOne({
      _id: requestedUserId,
      tenantId: req.user.tenantId,
    })
      .select('_id')
      .lean<TenantUserRecord>();
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const [personalCount, sharedAuthoredCount, projects, candidates] = await Promise.all([
      mongoose.models.MemoryEntry.countDocuments({ userId: user._id, tenantId: req.user.tenantId }),
      mongoose.models.SharedMemory.countDocuments({
        authorId: user._id,
        tenantId: req.user.tenantId,
      }),
      mongoose.models.Project.find({ user: String(user._id), tenantId: req.user.tenantId })
        .select('projectId name')
        .lean<ProjectSummary[]>(),
      mongoose.models.User.find({
        _id: { $ne: user._id },
        tenantId: req.user.tenantId,
        disabled: { $ne: true },
        role: { $in: ['ADMIN', 'OWNER'] },
      })
        .select('_id name')
        .lean<TenantUserRecord[]>(),
    ]);
    res.json({
      personalCount,
      sharedAuthoredCount,
      sharedPreserved: true,
      projectsNeedingOwner: projects.map((project) => ({
        projectId: project.projectId,
        name: project.name,
      })),
      projectOwnerCandidates: projects.length
        ? candidates.map((candidate) => ({ userId: String(candidate._id), name: candidate.name }))
        : [],
    });
  };

  const selfDeletionImpact = async (req: LifecycleRequest, res: Response): Promise<void> =>
    deletionImpact(req, res, req.user.id);

  const userDeletionImpact = async (req: LifecycleRequest, res: Response): Promise<void> =>
    deletionImpact(req, res, req.params.userId);

  const projectDeletionImpact = async (req: LifecycleRequest, res: Response): Promise<void> => {
    const project = await deps.projectFor(req, deps.projectViewPermission);
    if (!project) {
      res.status(403).json({ error: 'Project view permission required.' });
      return;
    }
    res.json({
      localMemoryCount: project.memories?.length || 0,
      sharedLinkCount: project.sharedMemoryIds?.length || 0,
      legacyMemoryKeyCount: project.memoryKeys?.length || 0,
    });
  };

  const reassignOwner = async (req: LifecycleRequest, res: Response): Promise<void> => {
    if (!isTenantManager(req.user.role)) {
      res.status(403).json({ error: 'Tenant management permission required.' });
      return;
    }
    const project = await deps.projectFor(req, deps.projectEditPermission);
    if (!project) {
      res.status(403).json({ error: 'Project edit permission required.' });
      return;
    }
    if (String(req.body.userId) === String(project.user)) {
      res.status(400).json({ error: 'Select a different owner.' });
      return;
    }
    if (!validObjectId(req.body.userId)) {
      res.status(400).json({ error: 'Invalid owner.' });
      return;
    }
    const owner = await mongoose.models.User.findOne({
      _id: req.body.userId,
      tenantId: req.user.tenantId,
      disabled: { $ne: true },
      role: { $in: ['ADMIN', 'OWNER'] },
    })
      .select('_id')
      .lean<TenantUserRecord>();
    if (!owner) {
      res.status(400).json({ error: 'New owner must belong to this tenant.' });
      return;
    }
    await deps.grantPermission({
      principalType: deps.principalTypeUser,
      principalId: owner._id,
      resourceType: deps.resourceTypeProject,
      resourceId: project._id,
      accessRoleId: deps.projectOwnerAccessRoleId,
      grantedBy: req.user.id,
    });
    await mongoose.models.Project.updateOne(
      { _id: project._id, tenantId: req.user.tenantId },
      { $set: { user: String(owner._id) } },
    );
    res.status(204).end();
  };

  const consumers = async (req: LifecycleRequest, res: Response): Promise<void> => {
    if (!validObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid memory ID.' });
      return;
    }
    const memory = await mongoose.models.SharedMemory.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    })
      .select('_id')
      .lean<{ _id: mongoose.Types.ObjectId }>();
    if (!memory) {
      res.status(404).json({ error: 'Memory not found.' });
      return;
    }
    const projects = await mongoose.models.Project.find({
      tenantId: req.user.tenantId,
      sharedMemoryIds: String(memory._id),
    })
      .select('_id projectId name')
      .lean<ProjectSummary[]>();
    const visible: Array<{ projectId: string; name?: string }> = [];
    for (const project of projects) {
      const allowed = await deps.checkPermission({
        userId: req.user.id,
        role: req.user.role,
        resourceType: deps.resourceTypeProject,
        resourceId: project._id,
        requiredPermission: deps.projectViewPermission,
      });
      if (allowed) {
        visible.push({ projectId: project.projectId, name: project.name });
      }
    }
    res.json({
      total: projects.length,
      visible,
      hiddenCount: projects.length - visible.length,
    });
  };

  return {
    selfDeletionImpact,
    userDeletionImpact,
    projectDeletionImpact,
    reassignOwner,
    consumers,
  };
}
