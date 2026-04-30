import type * as t from '~/types';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import mongoMeili from '~/models/plugins/mongoMeili';
import projectSchema from '~/schema/project';

export function createProjectModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(projectSchema);
  if (process.env.MEILI_HOST && process.env.MEILI_MASTER_KEY) {
    projectSchema.plugin(mongoMeili, {
      mongoose,
      host: process.env.MEILI_HOST,
      apiKey: process.env.MEILI_MASTER_KEY,
      indexName: 'projects',
      primaryKey: 'projectId',
    });
  }
  return mongoose.models.Project || mongoose.model<t.IProject>('Project', projectSchema);
}
