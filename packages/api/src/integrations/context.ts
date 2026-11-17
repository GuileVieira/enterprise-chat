import { z } from 'zod';
import type { RequestHandler } from 'express';
import { MemoryScope } from 'librechat-data-provider';
import type { IntegrationReaders } from './reads';
import type { IntegrationContent } from './content';
import type { createIntegrationSkills } from './skills';
import { fingerprint, integrationHandler, invalid, IntegrationError } from './contracts';

const querySchema = z
  .object({
    projectId: z.string().min(1).max(512).optional(),
    include: z.string().optional(),
  })
  .strict();
const sections = new Set(['instructions', 'skills', 'project', 'prompts', 'memories', 'files']);
export function createIntegrationContext(
  readers: IntegrationReaders,
  skills: ReturnType<typeof createIntegrationSkills>,
  content: IntegrationContent,
): RequestHandler {
  return integrationHandler(async (req) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) throw invalid();
    const include = parsed.data.include?.split(',') ?? [...sections];
    if (
      include.some((section) => !sections.has(section)) ||
      new Set(include).size !== include.length
    )
      throw invalid();
    const source = await readers.agent(req, req.params.id);
    const project = parsed.data.projectId
      ? await readers.project(req, parsed.data.projectId)
      : undefined;
    const warnings: string[] = [];
    const selection = {
      agentId: source.id,
      projectId: project?.projectId,
      include: [...include].sort(),
    };
    const agent = readers.agentView(req, source);
    const result: {
      schemaVersion: number;
      selection: typeof selection;
      agent: typeof agent;
      project?: ReturnType<typeof readers.projectView>;
      skills?: Array<
        ReturnType<ReturnType<typeof createIntegrationSkills>['view']> & {
          complete: boolean;
          missingCount: number;
          references: Array<{ relativePath: string }>;
          missingReferences: string[];
        }
      >;
      prompts?: Awaited<ReturnType<IntegrationContent['projectPrompts']>>['items'];
      memories?: Array<{ id: string; key?: string; value?: string; source: string }>;
      files?: Array<{
        id: string;
        name: string;
        mimeType?: string;
        bytes?: number;
        indexStatus: string;
      }>;
      warnings: string[];
      complete: boolean;
    } = { schemaVersion: 1, selection, agent, warnings, complete: true };
    if (!include.includes('instructions')) result.agent = { ...agent, instructions: '' };
    if (project && include.includes('project')) result.project = readers.projectView(req, project);
    async function optional(operation: () => Promise<void>) {
      try {
        await operation();
      } catch (error) {
        if (!(error instanceof IntegrationError) || ![403, 404].includes(error.status)) throw error;
        warnings.push('An optional context section is unavailable');
        result.complete = false;
      }
    }
    if (include.includes('skills'))
      await optional(async () => {
        const selected = await skills.list(req, source);
        result.skills = [];
        for (const row of selected) {
          const inventory = await skills.inventory(req, String(row._id));
          result.skills.push({
            ...skills.view(row),
            complete: inventory.complete,
            missingCount: inventory.missingCount,
            references: inventory.files.map((file) => ({ relativePath: file.relativePath })),
            missingReferences: inventory.missingReferences,
          });
          if (!inventory.complete)
            warnings.push('A selected skill has unavailable file references');
        }
      });
    if (project && include.includes('prompts')) {
      const resolved = await content.projectPrompts(req, project.projectId);
      result.prompts = resolved.items;
      warnings.push(...resolved.warnings);
    }
    if (include.includes('memories'))
      await optional(async () => {
        const agentId = source.memory_scope === MemoryScope.agent ? source.id : undefined;
        result.memories = await content.personalMemories(req, agentId);
        if (project)
          result.memories.push(...(await content.projectMemories(req, project.projectId, agentId)));
        const unique = new Map(result.memories.map((memory) => [memory.id, memory]));
        result.memories = [...unique.values()];
      });
    if (include.includes('files'))
      result.files = (await readers.files(req, source, project?.projectId)).map((file) =>
        readers.fileView(req, file),
      );

    result.complete = result.complete && warnings.length === 0;
    if (Buffer.byteLength(JSON.stringify(result)) > 1024 * 1024)
      throw new IntegrationError(
        413,
        'context_too_large',
        'Context exceeds 1 MiB; select fewer sections',
      );
    return {
      ...result,
      contextFingerprint: fingerprint(result),
      fingerprintSemantics:
        'Safe projection and selection; not a transactional snapshot or authorization grant',
      limits: {
        maxBytes: 1024 * 1024,
        skillFiles: 'Retrieve through skill file routes',
        tools: 'Retrieve through agent tools route',
        truncated: false,
      },
    };
  });
}
