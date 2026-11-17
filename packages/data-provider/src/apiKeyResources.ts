import { z } from 'zod';

const resourceIds = z.array(z.string().trim().min(1).max(512)).max(2000);
export const apiKeyResourcesSchema = z
  .object({
    agentIds: resourceIds.optional(),
    projectIds: resourceIds.optional(),
  })
  .strict();

/** Omitted category grants all authorized resources; an empty array grants none. */
export type TApiKeyResources = z.infer<typeof apiKeyResourcesSchema>;
