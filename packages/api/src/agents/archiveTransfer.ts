import type { AgentArchive } from './archive';
import { decodeAgentArchive } from './archive';

export interface AgentArchiveTransferDeps<T> {
  createSkill: (skill: AgentArchive['skills'][number]) => Promise<string>;
  deleteSkill: (id: string) => Promise<void>;
  resolveTools: (tools: AgentArchive['tools']) => Promise<ResolvedArchiveTools>;
  createAgent: (
    data: AgentArchive['agent'] & {
      instructions: string;
      skills: string[];
      tools: string[];
    },
  ) => Promise<T>;
}

export interface ResolvedArchiveTools {
  tools: string[];
  warnings: string[];
}

/** Compare portable skill bytes without relying on archive entry order. */
export function agentArchiveSkillsEqual(
  left: AgentArchive['skills'][number],
  right: AgentArchive['skills'][number],
): boolean {
  if (left.name !== right.name || left.files.length !== right.files.length) {
    return false;
  }
  const files = new Map(left.files.map((file) => [file.path, file.data]));
  if (files.size !== left.files.length || !files.has('SKILL.md')) {
    return false;
  }
  const seen = new Set<string>();
  return right.files.every((file) => {
    if (seen.has(file.path)) {
      return false;
    }
    seen.add(file.path);
    return files.get(file.path)?.equals(file.data) === true;
  });
}

/** External bindings and credentials are never replayed. */
export function previewAgentArchive(
  bundle: AgentArchive,
  resolved: ResolvedArchiveTools,
): {
  name: string;
  skills: string[];
  tools: string[];
  warnings: string[];
} {
  return {
    name: bundle.agent.name,
    skills: bundle.skills.map((skill) => skill.name),
    tools: bundle.tools.map((tool) => tool.name),
    warnings: [
      ...(bundle.agent.skills_scope === 'all'
        ? ['All skills scope uses the destination catalog.']
        : []),
      ...resolved.warnings,
    ],
  };
}

/** The caller supplies authenticated, tenant-scoped skill creation and compensating deletion. */
export async function importAgentArchive<T>(
  bytes: Buffer,
  deps: AgentArchiveTransferDeps<T>,
): Promise<T> {
  const bundle = await decodeAgentArchive(bytes);
  const created: string[] = [];
  const resolved = await deps.resolveTools(bundle.tools);
  const builtinNames = new Set(
    bundle.tools.filter((tool) => tool.kind === 'builtin').map((tool) => tool.name),
  );
  const safeTools = resolved.tools.filter((tool) => builtinNames.has(tool));
  try {
    for (const skill of bundle.skills) {
      created.push(await deps.createSkill(skill));
    }
    return await deps.createAgent({
      ...bundle.agent,
      instructions: bundle.instructions,
      skills: created,
      tools: safeTools,
    });
  } catch (error) {
    const results = await Promise.allSettled(created.map((id) => deps.deleteSkill(id)));
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      const rollbackError = new Error('Agent import rollback failed');
      Object.assign(rollbackError, { importError: error, rollbackCause: failure.reason });
      throw rollbackError;
    }
    throw error;
  }
}
