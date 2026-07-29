import type { Model, Types } from 'mongoose';
import { PrincipalType, ResourceType, PermissionBits } from 'librechat-data-provider';
import logger from '~/config/winston';
import { getTenantId } from '~/config/tenantContext';
import type { IProject } from '~/types';

export interface ProjectDeps {
  removeAllPermissions: (params: { resourceType: string; resourceId: unknown }) => Promise<void>;
  grantPermission: (
    principalType: string,
    principalId: string | Types.ObjectId | null,
    resourceType: string,
    resourceId: string | Types.ObjectId,
    permBits: number,
    grantedBy: string | Types.ObjectId,
  ) => Promise<unknown>;
}

export function createProjectMethods(mongoose: typeof import('mongoose'), deps?: ProjectDeps) {
  async function getProjects() {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      return await Project.find({}).sort({ updatedAt: -1 }).lean();
    } catch (error) {
      logger.error('[getProjects] Error getting projects', error);
      throw new Error('Error getting projects');
    }
  }

  async function getProjectById(projectId: string) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      return await Project.findOne({ projectId }).lean();
    } catch (error) {
      logger.error('[getProjectById] Error getting project', error);
      throw new Error('Error getting project');
    }
  }

  async function findProjectById(projectId: string) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      return await Project.findOne({ projectId }).lean();
    } catch (error) {
      logger.error('[findProjectById] Error finding project', error);
      throw new Error('Error finding project');
    }
  }

  async function createProject(
    user: string,
    data: {
      name: string;
      description?: string;
      endpoint?: string;
      model?: string;
      instructions?: string;
      memories?: IProject['memories'];
      memoryKeys?: string[];
      promptSnippets?: IProject['promptSnippets'];
      promptGroupIds?: string[];
      fileIds?: string[];
      metaAds?: IProject['metaAds'];
      iconURL?: string;
    },
  ) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      const projectId = crypto.randomUUID();
      const tenantId = getTenantId();
      const project = new Project({
        projectId,
        user,
        ...(tenantId && { tenantId }),
        ...data,
      });
      await project.save();

      if (deps?.grantPermission) {
        await deps.grantPermission(
          PrincipalType.USER,
          user,
          ResourceType.PROJECT,
          project._id,
          PermissionBits.VIEW | PermissionBits.EDIT | PermissionBits.DELETE | PermissionBits.SHARE,
          user,
        );
        if (tenantId) {
          await deps.grantPermission(
            PrincipalType.TENANT,
            tenantId,
            ResourceType.PROJECT,
            project._id,
            PermissionBits.VIEW | PermissionBits.EDIT,
            user,
          );
        }
      }

      return project.toObject();
    } catch (error) {
      logger.error('[createProject] Error creating project', error);
      throw new Error('Error creating project');
    }
  }

  async function updateProject(
    projectId: string,
    data: Partial<Omit<IProject, 'projectId' | 'user' | 'tenantId'>>,
  ) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      return await Project.findOneAndUpdate(
        { projectId },
        { $set: data },
        { new: true, lean: true },
      );
    } catch (error) {
      logger.error('[updateProject] Error updating project', error);
      throw new Error('Error updating project');
    }
  }

  async function deleteProject(projectId: string) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      const Conversation = mongoose.models.Conversation;

      const deleted = await Project.findOneAndDelete({ projectId }).lean();
      if (!deleted) {
        return null;
      }

      await Conversation.updateMany({ projectId }, { $unset: { projectId: 1 } });

      if (deps?.removeAllPermissions) {
        await deps.removeAllPermissions({
          resourceType: ResourceType.PROJECT,
          resourceId: deleted._id,
        });
      }

      return deleted;
    } catch (error) {
      logger.error('[deleteProject] Error deleting project', error);
      throw new Error('Error deleting project');
    }
  }

  async function archiveProject(projectId: string, isArchived: boolean) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      return await Project.findOneAndUpdate(
        { projectId },
        { isArchived },
        { new: true, lean: true },
      );
    } catch (error) {
      logger.error('[archiveProject] Error archiving project', error);
      throw new Error('Error archiving project');
    }
  }

  async function addProjectFileId(projectId: string, fileId: string) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      return await Project.findOneAndUpdate(
        { projectId },
        { $addToSet: { fileIds: fileId } },
        { new: true, lean: true },
      );
    } catch (error) {
      logger.error('[addProjectFileId] Error adding file to project', error);
      throw new Error('Error adding file to project');
    }
  }

  async function removeProjectFileId(projectId: string, fileId: string) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      return await Project.findOneAndUpdate(
        { projectId },
        { $pull: { fileIds: fileId } },
        { new: true, lean: true },
      );
    } catch (error) {
      logger.error('[removeProjectFileId] Error removing file from project', error);
      throw new Error('Error removing file from project');
    }
  }

  return {
    getProjects,
    getProjectById,
    findProjectById,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    addProjectFileId,
    removeProjectFileId,
  };
}

export type ProjectMethods = ReturnType<typeof createProjectMethods>;
