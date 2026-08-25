import { Readable } from 'stream';
import JSZip from 'jszip';
import { Types } from 'mongoose';
import type { Response } from 'express';
import type { ISkill, ISkillFile } from '@librechat/data-schemas';
import type { ServerRequest } from '~/types';
import { createExportSkillsHandler } from './export';

function createResponse() {
  const response = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    payload: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
  return response;
}

function makeSkill(id: Types.ObjectId, name: string): ISkill & { _id: Types.ObjectId } {
  return {
    _id: id,
    name,
    description: `${name} description`,
    body: '# Instructions\n\nUse this skill.',
    frontmatter: {},
    author: new Types.ObjectId(),
    authorName: 'Owner',
    version: 1,
    source: 'inline',
    fileCount: 1,
    alwaysApply: false,
  } as unknown as ISkill & { _id: Types.ObjectId };
}

describe('createExportSkillsHandler', () => {
  it('exports one skill as a directly importable .skill archive', async () => {
    const skillId = new Types.ObjectId();
    const handler = createExportSkillsHandler({
      getSkillById: jest.fn(async () => makeSkill(skillId, 'meta-ads')),
      listSkillFiles: jest.fn(async () => []),
      findAccessibleResources: jest.fn(async () => [skillId]),
      findPubliclyAccessibleResources: jest.fn(async () => []),
      getStrategyFunctions: jest.fn(),
      isValidObjectIdString: (value) => Types.ObjectId.isValid(String(value)),
    });
    const req = {
      user: { id: new Types.ObjectId().toString(), role: 'USER' },
      query: { ids: skillId.toString() },
    } as unknown as ServerRequest;
    const res = createResponse();

    await handler(req, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="meta-ads.skill"');
    const zip = await JSZip.loadAsync(res.payload as Buffer);
    expect(zip.file('SKILL.md')).not.toBeNull();
    expect(zip.file('meta-ads/SKILL.md')).toBeNull();
  });

  it('exports selected skills in separate folders and preserves nested file paths', async () => {
    const firstId = new Types.ObjectId();
    const secondId = new Types.ObjectId();
    const skills = new Map([
      [firstId.toString(), makeSkill(firstId, 'meta-ads')],
      [secondId.toString(), makeSkill(secondId, 'analytics')],
    ]);
    const nestedFile = {
      _id: new Types.ObjectId(),
      skillId: firstId,
      relativePath: 'references/funnels/metrics.md',
      filepath: '/stored/metrics.md',
      source: 'local',
    } as unknown as ISkillFile & { _id: Types.ObjectId };
    const handler = createExportSkillsHandler({
      getSkillById: jest.fn(async (id) => skills.get(id.toString()) ?? null),
      listSkillFiles: jest.fn(async (id) =>
        id.toString() === firstId.toString() ? [nestedFile] : [],
      ),
      findAccessibleResources: jest.fn(async () => [firstId, secondId]),
      findPubliclyAccessibleResources: jest.fn(async () => []),
      getStrategyFunctions: jest.fn(() => ({
        getDownloadStream: jest.fn(async () => Readable.from([Buffer.from('# Metrics')])) as never,
      })),
      isValidObjectIdString: (value) => Types.ObjectId.isValid(String(value)),
    });
    const req = {
      user: { id: new Types.ObjectId().toString(), role: 'USER' },
      query: { ids: `${firstId},${secondId}` },
    } as unknown as ServerRequest;
    const res = createResponse();

    await handler(req, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="skills-export.zip"');
    const zip = await JSZip.loadAsync(res.payload as Buffer);
    expect(await zip.file('meta-ads/SKILL.md')?.async('string')).toContain('name: meta-ads');
    expect(await zip.file('meta-ads/references/funnels/metrics.md')?.async('string')).toBe(
      '# Metrics',
    );
    expect(zip.file('analytics/SKILL.md')).not.toBeNull();
  });

  it('rejects the whole export when any selected skill is inaccessible', async () => {
    const allowedId = new Types.ObjectId();
    const deniedId = new Types.ObjectId();
    const getSkillById = jest.fn();
    const handler = createExportSkillsHandler({
      getSkillById,
      listSkillFiles: jest.fn(),
      findAccessibleResources: jest.fn(async () => [allowedId]),
      findPubliclyAccessibleResources: jest.fn(async () => []),
      getStrategyFunctions: jest.fn(),
      isValidObjectIdString: (value) => Types.ObjectId.isValid(String(value)),
    });
    const req = {
      user: { id: new Types.ObjectId().toString(), role: 'USER' },
      query: { ids: `${allowedId},${deniedId}` },
    } as unknown as ServerRequest;
    const res = createResponse();

    await handler(req, res as unknown as Response);

    expect(res.statusCode).toBe(403);
    expect(getSkillById).not.toHaveBeenCalled();
  });
});
