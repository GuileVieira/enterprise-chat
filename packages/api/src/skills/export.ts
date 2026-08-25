import JSZip from 'jszip';
import yaml from 'js-yaml';
import { ResourceType, PermissionBits } from 'librechat-data-provider';
import { logger } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { Types } from 'mongoose';
import type { ISkill, ISkillFile } from '@librechat/data-schemas';
import type { ServerRequest, StrategyFunctions } from '~/types';

const MAX_EXPORT_SKILLS = 50;
const MAX_EXPORT_BYTES = 500 * 1024 * 1024;

export interface ExportSkillsDeps {
  getSkillById: (id: string | Types.ObjectId) => Promise<(ISkill & { _id: Types.ObjectId }) | null>;
  listSkillFiles: (
    skillId: string | Types.ObjectId,
  ) => Promise<Array<ISkillFile & { _id: Types.ObjectId }>>;
  findAccessibleResources: (params: {
    userId: string;
    role?: string | null;
    resourceType: string;
    requiredPermissions: number;
  }) => Promise<Types.ObjectId[]>;
  findPubliclyAccessibleResources: (params: {
    resourceType: string;
    requiredPermissions: number;
  }) => Promise<Types.ObjectId[]>;
  getStrategyFunctions: (source: string) => Partial<StrategyFunctions>;
  isValidObjectIdString: (value: unknown) => boolean;
}

function buildSkillMarkdown(skill: ISkill): string {
  const raw = skill.body.replace(/^\uFEFF/, '');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  let existing: Record<string, unknown> = {};
  if (match) {
    try {
      const parsed = yaml.load(match[1]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>;
      }
    } catch {
      existing = {};
    }
  }

  const frontmatter: Record<string, unknown> = {
    ...existing,
    ...(skill.frontmatter ?? {}),
    name: skill.name,
    description: skill.description,
  };
  if (skill.alwaysApply === true || 'always-apply' in frontmatter) {
    frontmatter['always-apply'] = skill.alwaysApply === true;
  }

  const body = match ? raw.slice(match[0].length) : raw;
  return `---\n${yaml.dump(frontmatter, { lineWidth: -1, noRefs: true }).trimEnd()}\n---\n\n${body}`;
}

async function readFile(
  req: ServerRequest,
  file: ISkillFile,
  getStrategyFunctions: ExportSkillsDeps['getStrategyFunctions'],
  remainingBytes: number,
): Promise<Buffer> {
  if (file.content != null && file.isBinary !== true) {
    const buffer = Buffer.from(file.content, 'utf-8');
    if (buffer.length > remainingBytes) {
      throw new Error('EXPORT_TOO_LARGE');
    }
    return buffer;
  }

  const strategy = getStrategyFunctions(file.source);
  if (!strategy.getDownloadStream) {
    throw new Error(`EXPORT_UNSUPPORTED_SOURCE:${file.relativePath}`);
  }

  const stream = await strategy.getDownloadStream(req, file.storageKey || file.filepath);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const raw of stream) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    size += chunk.length;
    if (size > remainingBytes) {
      if ('destroy' in stream && typeof stream.destroy === 'function') {
        stream.destroy();
      }
      throw new Error('EXPORT_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createExportSkillsHandler(deps: ExportSkillsDeps) {
  return async function exportSkillsHandler(req: ServerRequest, res: Response) {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const ids = String(req.query.ids ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length === 0 || uniqueIds.length > MAX_EXPORT_SKILLS) {
        return res.status(400).json({ error: `Select between 1 and ${MAX_EXPORT_SKILLS} skills` });
      }
      if (uniqueIds.some((id) => !deps.isValidObjectIdString(id))) {
        return res.status(400).json({ error: 'Invalid skill id' });
      }

      const [accessibleIds, publicIds] = await Promise.all([
        deps.findAccessibleResources({
          userId: user.id,
          role: user.role,
          resourceType: ResourceType.SKILL,
          requiredPermissions: PermissionBits.VIEW,
        }),
        deps.findPubliclyAccessibleResources({
          resourceType: ResourceType.SKILL,
          requiredPermissions: PermissionBits.VIEW,
        }),
      ]);
      const allowed = new Set([...accessibleIds, ...publicIds].map((id) => id.toString()));
      if (uniqueIds.some((id) => !allowed.has(id))) {
        return res.status(403).json({ error: 'Access denied to one or more skills' });
      }

      const skills = await Promise.all(uniqueIds.map((id) => deps.getSkillById(id)));
      if (skills.some((skill) => !skill)) {
        return res.status(404).json({ error: 'One or more skills were not found' });
      }

      const zip = new JSZip();
      const multiple = skills.length > 1;
      let totalBytes = 0;
      const usedNames = new Set<string>();

      for (const skill of skills as Array<ISkill & { _id: Types.ObjectId }>) {
        let folderName = skill.name;
        if (usedNames.has(folderName)) {
          folderName = `${folderName}-${skill._id.toString().slice(-6)}`;
        }
        usedNames.add(folderName);
        const root = multiple ? zip.folder(folderName) : zip;
        if (!root) {
          throw new Error('EXPORT_ARCHIVE_ERROR');
        }

        const markdown = buildSkillMarkdown(skill);
        totalBytes += Buffer.byteLength(markdown, 'utf-8');
        if (totalBytes > MAX_EXPORT_BYTES) {
          throw new Error('EXPORT_TOO_LARGE');
        }
        root.file('SKILL.md', markdown);

        const files = await deps.listSkillFiles(skill._id);
        for (const file of files) {
          const buffer = await readFile(
            req,
            file,
            deps.getStrategyFunctions,
            MAX_EXPORT_BYTES - totalBytes,
          );
          totalBytes += buffer.length;
          root.file(file.relativePath, buffer);
        }
      }

      const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const filename = multiple ? 'skills-export.zip' : `${skills[0]?.name ?? 'skill'}.skill`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(200).send(archive);
    } catch (error) {
      if (error instanceof Error && error.message === 'EXPORT_TOO_LARGE') {
        return res.status(413).json({ error: 'Skill export exceeds the 500 MB limit' });
      }
      if (error instanceof Error && error.message.startsWith('EXPORT_UNSUPPORTED_SOURCE:')) {
        return res
          .status(501)
          .json({ error: 'A skill file cannot be downloaded from its storage' });
      }
      logger.error('[GET /skills/export] Error exporting skills', error);
      return res.status(500).json({ error: 'Error exporting skills' });
    }
  };
}

export const exportSkillsLimits = {
  maxSkills: MAX_EXPORT_SKILLS,
  maxBytes: MAX_EXPORT_BYTES,
};
