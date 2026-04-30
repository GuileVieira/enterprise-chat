import type { Model } from 'mongoose';
import logger from '~/config/winston';
import type { IProject } from '~/types';

export function createProjectMethods(mongoose: typeof import('mongoose')) {
  async function getProjects(user: string) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      return await Project.find({ user }).sort({ updatedAt: -1 }).lean();
    } catch (error) {
      logger.error('[getProjects] Error getting projects', error);
      throw new Error('Error getting projects');
    }
  }

  async function getProjectById(user: string, projectId: string) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      return await Project.findOne({ user, projectId }).lean();
    } catch (error) {
      logger.error('[getProjectById] Error getting project', error);
      throw new Error('Error getting project');
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
      iconURL?: string;
    },
  ) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      const projectId = crypto.randomUUID();
      const project = new Project({
        projectId,
        user,
        ...data,
      });
      await project.save();
      return project.toObject();
    } catch (error) {
      logger.error('[createProject] Error creating project', error);
      throw new Error('Error creating project');
    }
  }

  async function updateProject(
    user: string,
    projectId: string,
    data: Partial<Omit<IProject, 'projectId' | 'user' | 'tenantId'>>,
  ) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      return await Project.findOneAndUpdate(
        { user, projectId },
        { $set: data },
        { new: true, lean: true },
      );
    } catch (error) {
      logger.error('[updateProject] Error updating project', error);
      throw new Error('Error updating project');
    }
  }

  async function deleteProject(user: string, projectId: string) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      const Conversation = mongoose.models.Conversation;

      const deleted = await Project.findOneAndDelete({ user, projectId }).lean();
      if (!deleted) {
        return null;
      }

      await Conversation.updateMany({ user, projectId }, { $unset: { projectId: 1 } });

      return deleted;
    } catch (error) {
      logger.error('[deleteProject] Error deleting project', error);
      throw new Error('Error deleting project');
    }
  }

  async function archiveProject(user: string, projectId: string, isArchived: boolean) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      return await Project.findOneAndUpdate(
        { user, projectId },
        { isArchived },
        { new: true, lean: true },
      );
    } catch (error) {
      logger.error('[archiveProject] Error archiving project', error);
      throw new Error('Error archiving project');
    }
  }

  async function addProjectFileId(user: string, projectId: string, fileId: string) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      return await Project.findOneAndUpdate(
        { user, projectId },
        { $addToSet: { fileIds: fileId } },
        { new: true, lean: true },
      );
    } catch (error) {
      logger.error('[addProjectFileId] Error adding file to project', error);
      throw new Error('Error adding file to project');
    }
  }

  async function removeProjectFileId(user: string, projectId: string, fileId: string) {
    try {
      const Project = mongoose.models.Project as Model<IProject>;
      return await Project.findOneAndUpdate(
        { user, projectId },
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
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    addProjectFileId,
    removeProjectFileId,
  };
}

export type ProjectMethods = ReturnType<typeof createProjectMethods>;
