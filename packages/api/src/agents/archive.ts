import { z } from 'zod';
import JSZip from 'jszip';
import yauzl from 'yauzl';
import { assertSafeZipSize } from '../files/documents/zipSafety';

const MAX_COMPRESSED = 20 * 1024 * 1024;
const MAX_TOTAL = 50 * 1024 * 1024;
const MAX_ENTRY = 10 * 1024 * 1024;
const MAX_ENTRIES = 500;
const alias = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
const agentSchema = z
  .object({
    name: z.string().min(1).max(500),
    description: z.string().max(10000).optional(),
    provider: z.string().min(1).max(200),
    model: z.string().min(1).max(500),
    skills_enabled: z.boolean().optional(),
    skills_scope: z.enum(['all', 'none', 'selected']).optional(),
  })
  .strict();
const toolSchema = z
  .object({
    name: z.string().min(1).max(500),
    kind: z.enum(['builtin', 'mcp', 'action', 'function']),
    description: z.string().max(10000).optional(),
  })
  .strict();
const manifestSchema = z
  .object({
    formatVersion: z.literal(1),
    agent: agentSchema,
    skills: z.array(alias).max(MAX_ENTRIES),
    tools: z.array(alias).max(MAX_ENTRIES),
  })
  .strict();

export interface AgentArchive {
  agent: {
    name: string;
    description?: string;
    provider: string;
    model: string;
    skills_enabled?: boolean;
    skills_scope?: 'all' | 'none' | 'selected';
  };
  instructions: string;
  skills: Array<{ name: string; files: Array<{ path: string; data: Buffer }> }>;
  tools: Array<{
    name: string;
    kind: 'builtin' | 'mcp' | 'action' | 'function';
    description?: string;
  }>;
}

function slug(value: string): string {
  const result = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/, '');
  return alias.parse(result || 'agent');
}

function safePath(path: string): boolean {
  return (
    path.length <= 1024 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    path
      .split('/')
      .every((part) => part !== '' && part !== '.' && part !== '..' && !/[\p{Cc}:]/u.test(part))
  );
}

function collides(names: Set<string>, name: string): boolean {
  return [...names].some(
    (existing) =>
      existing === name || existing.startsWith(`${name}/`) || name.startsWith(`${existing}/`),
  );
}

/** Audit raw central-directory names before JSZip can normalize or merge them. */
function auditEntries(buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) {
        reject(error ?? new Error('Invalid ZIP'));
        return;
      }
      const names = new Set<string>();
      let count = 0;
      const fail = (err: Error) => {
        zip.close();
        reject(err);
      };
      zip.on('error', fail);
      zip.on('entry', (entry: yauzl.Entry) => {
        const directory = entry.fileName.endsWith('/');
        const name = directory ? entry.fileName.slice(0, -1) : entry.fileName;
        const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
        if (
          ++count > MAX_ENTRIES ||
          directory ||
          (entry.externalFileAttributes & 0x10) !== 0 ||
          (mode & 0xf000) === 0x4000 ||
          !safePath(name) ||
          collides(names, name) ||
          (mode & 0xf000) === 0xa000 ||
          (entry.generalPurposeBitFlag & 1) !== 0
        ) {
          fail(new Error('Unsafe ZIP entry'));
          return;
        }
        names.add(name);
        zip.readEntry();
      });
      zip.on('end', resolve);
      zip.readEntry();
    });
  });
}

export async function encodeAgentArchive(bundle: AgentArchive): Promise<Buffer> {
  const agent = agentSchema.parse(bundle.agent);
  if (typeof bundle.instructions !== 'string') {
    throw new Error('Invalid instructions');
  }
  const root = slug(agent.name);
  const zip = new JSZip();
  const skills: string[] = [];
  const tools: string[] = [];
  const paths = new Set<string>();
  let totalBytes = 0;
  const add = (path: string, data: Buffer | string) => {
    const size = Buffer.byteLength(data);
    totalBytes += size;
    if (
      !safePath(path) ||
      collides(paths, path) ||
      paths.size >= MAX_ENTRIES ||
      size > MAX_ENTRY ||
      totalBytes > MAX_TOTAL
    ) {
      throw new Error('Duplicate, unsafe or oversized archive entry');
    }
    paths.add(path);
    zip.file(path, data, { createFolders: false });
  };
  add(`${root}/instructions.md`, bundle.instructions);
  for (const skill of bundle.skills) {
    const name = alias.parse(skill.name);
    if (skills.includes(name) || !skill.files.some((file) => file.path === 'SKILL.md')) {
      throw new Error('Invalid skill');
    }
    skills.push(name);
    for (const file of skill.files) {
      if (!Buffer.isBuffer(file.data) || !safePath(file.path)) {
        throw new Error('Invalid skill file');
      }
      add(`${root}/skills/${name}/${file.path}`, file.data);
    }
  }
  const toolNames = new Set<string>();
  for (const item of bundle.tools) {
    const tool = toolSchema.parse(item);
    if (toolNames.has(tool.name)) {
      throw new Error('Duplicate tool name');
    }
    toolNames.add(tool.name);
    const base = slug(tool.name);
    let name = base;
    let suffix = 2;
    while (tools.includes(name)) {
      name = `${base.slice(0, 95)}-${suffix++}`;
    }
    tools.push(name);
    add(`${root}/tools/${name}.json`, JSON.stringify(tool));
  }
  add(`${root}/agent.json`, JSON.stringify({ formatVersion: 1, agent, skills, tools }));
  const result = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  await decodeAgentArchive(result);
  return result;
}

export async function decodeAgentArchive(buffer: Buffer): Promise<AgentArchive> {
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_COMPRESSED) {
    throw new Error('Archive too large');
  }
  await auditEntries(buffer);
  await assertSafeZipSize(buffer, { maxTotalBytes: MAX_TOTAL, maxEntryBytes: MAX_ENTRY });
  const zip = await JSZip.loadAsync(buffer, { checkCRC32: true, createFolders: false });
  const files = Object.values(zip.files).filter((file) => !file.dir);
  if (files.some((file) => file.unsafeOriginalName !== file.name)) {
    throw new Error('Unsafe ZIP entry');
  }
  const manifests = files.filter((file) => /^[^/]+\/agent\.json$/.test(file.name));
  if (manifests.length !== 1) {
    throw new Error('Invalid agent manifest');
  }
  const root = manifests[0].name.split('/')[0];
  alias.parse(root);
  const decodeText = async (file: JSZip.JSZipObject): Promise<string> =>
    new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      await file.async('uint8array'),
    );
  const manifest = manifestSchema.parse(JSON.parse(await decodeText(manifests[0])));
  if (
    new Set(manifest.skills).size !== manifest.skills.length ||
    new Set(manifest.tools).size !== manifest.tools.length
  ) {
    throw new Error('Duplicate archive alias');
  }
  const instructionsFile = zip.file(`${root}/instructions.md`);
  if (!instructionsFile) {
    throw new Error('Missing instructions');
  }
  const allowed = new Set([`${root}/agent.json`, `${root}/instructions.md`]);
  const skills: AgentArchive['skills'] = [];
  for (const name of manifest.skills) {
    const prefix = `${root}/skills/${name}/`;
    const matching = files.filter((file) => file.name.startsWith(prefix));
    if (!matching.some((file) => file.name === `${prefix}SKILL.md`)) {
      throw new Error('Missing SKILL.md');
    }
    const skillFiles = await Promise.all(
      matching.map(async (file) => {
        allowed.add(file.name);
        return { path: file.name.slice(prefix.length), data: await file.async('nodebuffer') };
      }),
    );
    skills.push({ name, files: skillFiles });
  }
  const tools: AgentArchive['tools'] = [];
  for (const name of manifest.tools) {
    const path = `${root}/tools/${name}.json`;
    const file = zip.file(path);
    if (!file) {
      throw new Error('Missing tool');
    }
    allowed.add(path);
    const tool = toolSchema.parse(JSON.parse(await decodeText(file)));
    if (tools.some((existing) => existing.name === tool.name)) {
      throw new Error('Duplicate tool name');
    }
    tools.push(tool);
  }
  if (files.some((file) => !allowed.has(file.name))) {
    throw new Error('Unexpected archive file');
  }
  return {
    agent: manifest.agent,
    instructions: await decodeText(instructionsFile),
    skills,
    tools,
  };
}
