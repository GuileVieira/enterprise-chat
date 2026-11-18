import { encodeAgentArchive } from './archive';
import {
  agentArchiveSkillsEqual,
  importAgentArchive,
  previewAgentArchive,
} from './archiveTransfer';
import type { AgentArchive } from './archive';

const bundle: AgentArchive = {
  agent: { name: 'Agent', provider: 'openAI', model: 'gpt-5', skills_scope: 'selected' },
  instructions: 'Instructions',
  skills: [
    { name: 'first', files: [{ path: 'SKILL.md', data: Buffer.from('first') }] },
    { name: 'second', files: [{ path: 'SKILL.md', data: Buffer.from('second') }] },
  ],
  tools: [{ name: 'private-mcp', kind: 'mcp' }],
};

describe('agent archive transfer', () => {
  it('compares exact skill content independent of file order and rejects duplicates', () => {
    const skill = {
      name: 'skill',
      files: [
        { path: 'SKILL.md', data: Buffer.from('instructions') },
        { path: 'references/a.md', data: Buffer.from('reference') },
      ],
    };
    expect(agentArchiveSkillsEqual(skill, { ...skill, files: [...skill.files].reverse() })).toBe(
      true,
    );
    expect(agentArchiveSkillsEqual(skill, { ...skill, name: 'other' })).toBe(false);
    expect(
      agentArchiveSkillsEqual(skill, {
        ...skill,
        files: [skill.files[0], { ...skill.files[1], data: Buffer.from('changed') }],
      }),
    ).toBe(false);
    expect(
      agentArchiveSkillsEqual(skill, { ...skill, files: [skill.files[0], skill.files[0]] }),
    ).toBe(false);
  });

  it('previews declarations and never activates an external tool', async () => {
    const preview = previewAgentArchive(bundle, {
      tools: [],
      warnings: ['Tool unavailable: private-mcp'],
    });
    expect(preview).toMatchObject({ skills: ['first', 'second'], tools: ['private-mcp'] });
    expect(preview.warnings).toHaveLength(1);
    const createAgent = jest.fn().mockResolvedValue({ id: 'new-agent' });
    const result = await importAgentArchive(await encodeAgentArchive(bundle), {
      createSkill: jest.fn().mockResolvedValueOnce('fresh-1').mockResolvedValueOnce('fresh-2'),
      deleteSkill: jest.fn(),
      resolveTools: jest.fn().mockResolvedValue({ tools: ['private-mcp'], warnings: [] }),
      createAgent,
    });
    expect(result).toEqual({ id: 'new-agent' });
    expect(createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        skills: ['fresh-1', 'fresh-2'],
        tools: [],
        skills_scope: 'selected',
      }),
    );
  });

  it('warns that all skills come from the destination catalog', () => {
    const preview = previewAgentArchive(
      { ...bundle, agent: { ...bundle.agent, skills_scope: 'all' } },
      { tools: [], warnings: [] },
    );
    expect(preview.warnings).toEqual(['All skills scope uses the destination catalog.']);
  });

  it('preserves selected empty scope and explicitly resolved builtin tools', async () => {
    const createAgent = jest.fn().mockResolvedValue({ id: 'new-agent' });
    const empty: AgentArchive = {
      ...bundle,
      skills: [],
      tools: [{ name: 'web_search', kind: 'builtin' }],
    };
    await importAgentArchive(await encodeAgentArchive(empty), {
      createSkill: jest.fn(),
      deleteSkill: jest.fn(),
      resolveTools: jest.fn().mockResolvedValue({ tools: ['web_search'], warnings: [] }),
      createAgent,
    });
    expect(createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        skills: [],
        skills_scope: 'selected',
        tools: ['web_search'],
      }),
    );
  });

  it('rolls back earlier skills when a later skill fails', async () => {
    const deleteSkill = jest.fn().mockResolvedValue(undefined);
    const createAgent = jest.fn();
    await expect(
      importAgentArchive(await encodeAgentArchive(bundle), {
        createSkill: jest
          .fn()
          .mockResolvedValueOnce('fresh-1')
          .mockRejectedValueOnce(new Error('invalid skill')),
        deleteSkill,
        resolveTools: jest.fn().mockResolvedValue({ tools: [], warnings: [] }),
        createAgent,
      }),
    ).rejects.toThrow('invalid skill');
    expect(deleteSkill).toHaveBeenCalledWith('fresh-1');
    expect(createAgent).not.toHaveBeenCalled();
  });

  it('removes every created skill when agent creation fails', async () => {
    const deleteSkill = jest.fn().mockResolvedValue(undefined);
    await expect(
      importAgentArchive(await encodeAgentArchive(bundle), {
        createSkill: jest.fn().mockResolvedValueOnce('fresh-1').mockResolvedValueOnce('fresh-2'),
        deleteSkill,
        resolveTools: jest.fn().mockResolvedValue({ tools: [], warnings: [] }),
        createAgent: jest.fn().mockRejectedValue(new Error('failed')),
      }),
    ).rejects.toThrow('failed');
    expect(deleteSkill.mock.calls).toEqual([['fresh-1'], ['fresh-2']]);
  });
});
