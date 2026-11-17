import { keyResourceIds } from './resources';
import { Types } from 'mongoose';
import {
  PermissionBits,
  PermissionTypes,
  ResourceType,
  SkillsScope,
  resolveAgentSkillsScope,
} from 'librechat-data-provider';
import type { RequestHandler } from 'express';
import type { IAgent } from '@librechat/data-schemas';
import type { SkillsHandlersDeps } from '../skills/handlers';
import type { IntegrationReaders } from './reads';
import type { IntegrationRequest } from './contracts';
import { getDeploymentSkillById, getDeploymentSkillIds } from '../skills/deployment';
import { resolveSkillActive } from '../agents/skills';
import { resolveDefaultActiveOnShare, toSkillStatesRecord } from '../skills/skillStates';
import { resolveSkillFilePathParam } from '../skills/path';
import { assertSkillFileContentAllowed } from '../skills/protection';
import { extractSkillContent } from '../protection/adapters/submissions';
import { inspectContentWithTraversal } from '../protection/runtime';
import {
  IntegrationError,
  assertQuery,
  forbidden,
  integrationHandler,
  invalid,
  notFound,
  paginate,
} from './contracts';

export interface IntegrationSkillDeps
  extends Pick<
    SkillsHandlersDeps,
    | 'getSkillById'
    | 'listSkillsByAccess'
    | 'listSkillFiles'
    | 'getSkillFileByPath'
    | 'findAccessibleResources'
  > {
  skillsCapability: (req: IntegrationRequest) => Promise<boolean>;
  readSkillFile: (
    req: IntegrationRequest,
    file: NonNullable<Awaited<ReturnType<SkillsHandlersDeps['getSkillFileByPath']>>>,
  ) => Promise<Buffer | null>;
}
export function skillReferencePaths(body: string, references: unknown): string[] {
  const paths = new Set<string>();
  const add = (value: string) => {
    const path = value.split('#')[0];
    if ((path.includes('/') || /\.[a-z0-9]+$/i.test(path)) && resolveSkillFilePathParam(path))
      paths.add(path);
  };
  for (const match of body.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) add(match[1]);
  let visited = 0;
  const visit = (value: unknown, depth = 0): void => {
    if (++visited > 1000 || depth > 5) return;
    if (typeof value === 'string') add(value);
    else if (Array.isArray(value)) for (const item of value) visit(item, depth + 1);
    else if (value && typeof value === 'object')
      for (const item of Object.values(value)) visit(item, depth + 1);
  };
  visit(references);
  return [...paths].sort();
}
type IntegrationSkill = NonNullable<Awaited<ReturnType<SkillsHandlersDeps['getSkillById']>>>;
export interface IntegrationSkillView {
  id: string;
  name: string;
  description: string;
  body: string;
  version: number;
  frontmatter: object;
  frontmatterProjection: string;
  source: string;
  fileCount: number;
  alwaysApply: boolean;
  disableModelInvocation: boolean;
  userInvocable: boolean;
  allowedTools: string[];
  updatedAt?: Date;
}
export interface IntegrationSkillInventory {
  files: Array<{ relativePath: string; filename: string; mimeType: string; bytes: number }>;
  declaredReferences: string[];
  missingReferences: string[];
  referenceCoverage: string;
  complete: boolean;
  missingCount: number;
}
export interface IntegrationSkills {
  skill(req: IntegrationRequest, id: string): Promise<IntegrationSkill>;
  list(req: IntegrationRequest, agent?: IAgent): Promise<IntegrationSkill[]>;
  view(skill: IntegrationSkill): IntegrationSkillView;
  file(req: IntegrationRequest, id: string, path: string): Promise<object>;
  inventory(req: IntegrationRequest, id: string): Promise<IntegrationSkillInventory>;
  effectiveTools(req: IntegrationRequest, agent: IAgent): Promise<IAgent>;
  handlers: { [name in 'skills' | 'skill' | 'skillFiles' | 'skillFile']: RequestHandler };
}
export function createIntegrationSkills(
  deps: IntegrationSkillDeps,
  readers: IntegrationReaders,
): IntegrationSkills {
  async function skill(req: IntegrationRequest, id: string) {
    await readers.feature(req, PermissionTypes.SKILLS);
    if (!Types.ObjectId.isValid(id)) throw notFound();
    const row = await deps.getSkillById(id);
    const deployment = getDeploymentSkillById(id);
    if (!row || (!deployment && row.tenantId !== req.user.tenantId)) throw notFound();
    if (
      !deployment &&
      !(await readers.canManage(req, ResourceType.SKILL)) &&
      !(await readers.allowed(req, ResourceType.SKILL, row._id, PermissionBits.VIEW))
    )
      throw notFound();
    if (keyResourceIds(req, 'agentIds')) {
      const agents = await readers.scopedAgents(req);
      const assigned = agents.some((agent) => {
        const scope = resolveAgentSkillsScope(
          agent.skills,
          agent.skills_enabled,
          agent.skills_scope,
        );
        return (
          scope === SkillsScope.all ||
          (scope === SkillsScope.selected && agent.skills?.includes(id))
        );
      });
      if (!assigned) throw notFound();
    }
    const inspection = inspectContentWithTraversal(() => extractSkillContent(row), {
      filters: req.config?.filters,
    });
    if (inspection.finding || inspection.traversalError) throw forbidden();
    return row;
  }
  async function list(req: IntegrationRequest, agent?: IAgent) {
    const scope = agent
      ? resolveAgentSkillsScope(agent.skills, agent.skills_enabled, agent.skills_scope)
      : SkillsScope.all;
    if (scope === SkillsScope.none || (agent && !(await deps.skillsCapability(req)))) return [];
    await readers.feature(req, PermissionTypes.SKILLS);
    const ids = await deps.findAccessibleResources({
      userId: req.user.id,
      role: req.user.role,
      resourceType: ResourceType.SKILL,
      requiredPermissions: PermissionBits.VIEW,
    });
    const accessible = [...new Set([...ids.map(String), ...getDeploymentSkillIds().map(String)])]
      .filter((id) => scope !== SkillsScope.selected || agent?.skills?.includes(id))
      .map((id) => new Types.ObjectId(id));
    const rows: Array<Awaited<ReturnType<typeof skill>>> = [];
    const manageTenantId =
      !agent && (await readers.canManage(req, ResourceType.SKILL)) ? req.user.tenantId : undefined;
    let cursor: string | null | undefined;
    do {
      const result = await deps.listSkillsByAccess({
        accessibleIds: accessible,
        manageTenantId,
        limit: 100,
        cursor,
      });
      for (const summary of result.skills) {
        let row: Awaited<ReturnType<typeof skill>>;
        try {
          row = await skill(req, String(summary._id));
        } catch (error) {
          if (error instanceof IntegrationError && error.status === 404) continue;
          throw error;
        }
        const active = resolveSkillActive({
          skill: { ...row, deployment: !!getDeploymentSkillById(String(row._id)) },
          userId: req.user.id,
          skillStates: toSkillStatesRecord(req.user.skillStates),
          defaultActiveOnShare: resolveDefaultActiveOnShare(req.config?.interfaceConfig?.skills),
        });
        if (!agent || (active && (row.disableModelInvocation !== true || row.alwaysApply)))
          rows.push(row);
      }
      cursor = result.has_more ? result.after : null;
      if (result.has_more && !cursor) throw new Error('Skill pagination returned no boundary');
      if (rows.length > 1000)
        throw new IntegrationError(
          413,
          'scope_too_large',
          'Accessible skill scope exceeds 1000 records',
        );
    } while (cursor);
    return rows;
  }
  function view(row: Awaited<ReturnType<typeof skill>>) {
    const fm = row.frontmatter ?? {};
    const frontmatter = {
      name: row.name,
      description: row.description,
      ...(typeof fm['argument-hint'] === 'string' ? { 'argument-hint': fm['argument-hint'] } : {}),
      ...(typeof fm['when-to-use'] === 'string' ? { 'when-to-use': fm['when-to-use'] } : {}),
      ...(typeof fm.license === 'string' ? { license: fm.license } : {}),
      ...(typeof fm.compatibility === 'string' ? { compatibility: fm.compatibility } : {}),
      disableModelInvocation: row.disableModelInvocation === true,
      userInvocable: row.userInvocable !== false,
      alwaysApply: row.alwaysApply === true,
      allowedTools: row.allowedTools ?? [],
    };
    return {
      id: String(row._id),
      name: row.name,
      description: row.description,
      body: row.body,
      version: row.version,
      frontmatter,
      frontmatterProjection: 'approved_instruction_fields',
      source: getDeploymentSkillById(String(row._id)) ? 'deployment' : row.source,
      fileCount: row.fileCount,
      alwaysApply: row.alwaysApply === true,
      disableModelInvocation: row.disableModelInvocation === true,
      userInvocable: row.userInvocable !== false,
      allowedTools: row.allowedTools ?? [],
      updatedAt: row.updatedAt,
    };
  }
  async function file(req: IntegrationRequest, id: string, path: string) {
    const row = await skill(req, id);
    const relativePath = resolveSkillFilePathParam(path);
    if (!relativePath) throw invalid();
    if (relativePath === 'SKILL.md')
      return {
        relativePath,
        filename: relativePath,
        mimeType: 'text/markdown',
        bytes: Buffer.byteLength(row.body),
        content: row.body,
        complete: true,
        isBinary: false,
        representation: 'body_only',
        frontmatter: view(row).frontmatter,
      };
    const record = await deps.getSkillFileByPath(id, relativePath);
    if (!record || (record.tenantId && record.tenantId !== req.user.tenantId)) throw notFound();
    const base = {
      relativePath,
      filename: record.filename,
      mimeType: record.mimeType,
      bytes: record.bytes,
    };
    if (record.isBinary === true)
      return { ...base, isBinary: true, complete: false, unavailableReason: 'binary' };
    if (record.bytes > 512 * 1024)
      return { ...base, isBinary: false, complete: false, unavailableReason: 'text_too_large' };
    const buffer =
      record.content !== undefined
        ? Buffer.from(record.content)
        : await deps.readSkillFile(req, record);
    if (!buffer) return { ...base, complete: false, unavailableReason: 'storage_unavailable' };
    if (buffer.includes(0))
      return { ...base, isBinary: true, complete: false, unavailableReason: 'binary' };
    if (buffer.length > 512 * 1024)
      return { ...base, complete: false, unavailableReason: 'text_too_large' };
    assertSkillFileContentAllowed(req.config?.filters, {
      buffer,
      originalName: record.filename,
      relativePath,
    });
    return { ...base, content: buffer.toString('utf8'), isBinary: false, complete: true };
  }
  async function inventory(req: IntegrationRequest, id: string) {
    const row = await skill(req, id);
    const records = await deps.listSkillFiles(id);
    const files = records
      .filter((record) => !record.tenantId || record.tenantId === req.user.tenantId)
      .map((record) => ({
        relativePath: record.relativePath,
        filename: record.filename,
        mimeType: record.mimeType,
        bytes: record.bytes,
      }));
    const known = new Set(['SKILL.md', ...files.map((file) => file.relativePath)]);
    const declaredReferences = skillReferencePaths(row.body, row.frontmatter?.references);
    const missingReferences = declaredReferences.filter((path) => !known.has(path));
    return {
      files,
      declaredReferences,
      missingReferences,
      referenceCoverage: 'markdown_file_links_and_safe_frontmatter_paths',
      complete: files.length === row.fileCount && missingReferences.length === 0,
      missingCount: Math.max(0, row.fileCount - files.length),
    };
  }
  async function effectiveTools(req: IntegrationRequest, agent: IAgent): Promise<IAgent> {
    let rows: Awaited<ReturnType<typeof list>>;
    try {
      rows = await list(req, agent);
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 403) return agent;
      throw error;
    }
    return {
      ...agent,
      tools: [
        ...new Set([
          ...(agent.tools ?? []),
          ...rows.filter((row) => row.alwaysApply).flatMap((row) => row.allowedTools ?? []),
        ]),
      ],
    } as IAgent;
  }
  return {
    skill,
    list,
    view,
    file,
    inventory,
    effectiveTools,
    handlers: {
      skills: integrationHandler(async (req) => {
        assertQuery(req);
        return paginate(
          req,
          (await list(req)).map((row) => {
            const { body: _body, frontmatter: _frontmatter, ...summary } = view(row);
            return summary;
          }),
          (row) => row.id,
        );
      }),
      skill: integrationHandler(async (req) => {
        const row = await skill(req, req.params.id);
        const contents = await inventory(req, req.params.id);
        return {
          ...view(row),
          references: contents.files,
          declaredReferences: contents.declaredReferences,
          missingReferences: contents.missingReferences,
          referenceCoverage: contents.referenceCoverage,
          completeProjection: 'body_inventory_and_file_references',
          complete: contents.complete,
          completeness: {
            body: true,
            inventory: contents.complete,
            textFiles: 'retrieve_separately',
            missingCount: contents.missingCount,
            missingReferences: contents.missingReferences,
          },
        };
      }),
      skillFiles: integrationHandler(async (req) => {
        assertQuery(req);
        const contents = await inventory(req, req.params.id);
        return {
          ...paginate(req, contents.files, (row) => row.relativePath),
          complete: contents.complete,
          missingCount: contents.missingCount,
        };
      }),
      skillFile: integrationHandler(async (req) => {
        if (Object.keys(req.query).length) throw invalid();
        return file(req, req.params.id, req.params.relativePath);
      }),
    },
  };
}
