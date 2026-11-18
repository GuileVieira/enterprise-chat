import JSZip from 'jszip';
import { decodeAgentArchive, encodeAgentArchive } from './archive';
import type { AgentArchive } from './archive';

const bundle: AgentArchive = {
  agent: { name: 'My agent', provider: 'openAI', model: 'gpt-test', skills_enabled: true },
  instructions: 'Keep this literal: API_KEY=example and ../anything',
  skills: [
    {
      name: 'my-skill',
      files: [
        { path: 'SKILL.md', data: Buffer.from('skill') },
        { path: 'references/example.txt', data: Buffer.from('resource') },
      ],
    },
  ],
  tools: [{ name: 'Search Web', kind: 'builtin', description: 'Search' }],
};

async function archive(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content, { createFolders: false });
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('agent archive', () => {
  it('round trips instructions, skills, resources and tool metadata', async () => {
    expect(await decodeAgentArchive(await encodeAgentArchive(bundle))).toEqual(bundle);
  });

  it('rejects unknown versions, secret fields and foreign references', async () => {
    for (const agent of [
      { ...bundle.agent, secret: 'token' },
      { ...bundle.agent, id: 'foreign' },
    ]) {
      await expect(encodeAgentArchive({ ...bundle, agent })).rejects.toThrow();
    }
    const data = await archive({
      'agent/agent.json': JSON.stringify({
        formatVersion: 2,
        agent: bundle.agent,
        skills: [],
        tools: [],
      }),
      'agent/instructions.md': '',
    });
    await expect(decodeAgentArchive(data)).rejects.toThrow();
  });

  it('rejects traversal and unexpected files', async () => {
    const manifest = JSON.stringify({
      formatVersion: 1,
      agent: bundle.agent,
      skills: [],
      tools: [],
    });
    for (const path of ['agent/../secret', 'agent/extra.json']) {
      const data = await archive({
        'agent/agent.json': manifest,
        'agent/instructions.md': '',
        [path]: 'x',
      });
      await expect(decodeAgentArchive(data)).rejects.toThrow();
    }
  });

  it('rejects invalid CRC', async () => {
    const data = await archive({ 'agent/agent.json': 'bad' });
    const offset = data.indexOf(Buffer.from('bad'));
    data[offset] ^= 1;
    await expect(decodeAgentArchive(data)).rejects.toThrow();
  });
  it('preserves unicode agent names, selected scope, binary files and colliding tool slugs', async () => {
    const input: AgentArchive = {
      ...bundle,
      agent: { ...bundle.agent, name: '🤖', skills_scope: 'selected' },
      skills: [
        {
          name: 'my-skill',
          files: [
            { path: 'SKILL.md', data: Buffer.from('skill') },
            { path: 'image.bin', data: Buffer.from([0, 255, 128]) },
          ],
        },
      ],
      tools: [
        { name: 'A B', kind: 'builtin' },
        { name: 'A-B', kind: 'mcp' },
      ],
    };
    expect(await decodeAgentArchive(await encodeAgentArchive(input))).toEqual(input);
    await expect(
      encodeAgentArchive({ ...input, tools: [input.tools[0], input.tools[0]] }),
    ).rejects.toThrow();
    expect(await decodeAgentArchive(await encodeAgentArchive({ ...input, skills: [] }))).toEqual({
      ...input,
      skills: [],
    });
  });

  it('rejects duplicate central-directory names and symlinks', async () => {
    const duplicate = await archive({ 'agent/a.txt': 'a', 'agent/b.txt': 'b' });
    const oldName = Buffer.from('agent/b.txt');
    const newName = Buffer.from('agent/a.txt');
    let offset = duplicate.indexOf(oldName);
    while (offset !== -1) {
      newName.copy(duplicate, offset);
      offset = duplicate.indexOf(oldName, offset + oldName.length);
    }
    await expect(decodeAgentArchive(duplicate)).rejects.toThrow();
    const zip = new JSZip();
    zip.file('agent/link', 'target', { unixPermissions: 0o120777, createFolders: false });
    await expect(
      decodeAgentArchive(await zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' })),
    ).rejects.toThrow();
  });

  it('rejects oversized content, invalid UTF-8 and control characters', async () => {
    const oversized = { ...bundle, instructions: 'a'.repeat(10 * 1024 * 1024 + 1) };
    await expect(encodeAgentArchive(oversized)).rejects.toThrow();
    const bomb = new JSZip();
    bomb.file('agent/instructions.md', oversized.instructions, { createFolders: false });
    const compressed = await bomb.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await expect(decodeAgentArchive(compressed)).rejects.toThrow();
    const central = compressed.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    compressed.writeUInt32LE(1, central + 24);
    await expect(decodeAgentArchive(compressed)).rejects.toThrow();
    const manifest = JSON.stringify({
      formatVersion: 1,
      agent: bundle.agent,
      skills: [],
      tools: [],
    });
    const zip = new JSZip();
    zip.file('agent/agent.json', manifest, { createFolders: false });
    zip.file('agent/instructions.md', Buffer.from([0xff]), { createFolders: false });
    await expect(
      decodeAgentArchive(await zip.generateAsync({ type: 'nodebuffer' })),
    ).rejects.toThrow();
    const control = await archive({
      'agent/agent.json': manifest,
      'agent/instructions.md': '',
      'agent/\u0001': 'x',
    });
    await expect(decodeAgentArchive(control)).rejects.toThrow();
  });
  it('preserves an instruction BOM and handles truncated slugs', async () => {
    const input = {
      ...bundle,
      agent: { ...bundle.agent, name: `${'a'.repeat(99)} b` },
      instructions: '\uFEFFliteral',
    };
    expect(await decodeAgentArchive(await encodeAgentArchive(input))).toEqual(input);
  });

  it('rejects directory entries and file ancestor collisions', async () => {
    const zip = new JSZip();
    zip.file('agent/directory/', 'hidden data', { dir: true, createFolders: false });
    await expect(
      decodeAgentArchive(await zip.generateAsync({ type: 'nodebuffer' })),
    ).rejects.toThrow();
    for (const files of [
      { 'agent/a': 'a', 'agent/a/b': 'b' },
      { 'agent/a/b': 'b', 'agent/a': 'a' },
    ]) {
      await expect(decodeAgentArchive(await archive(files))).rejects.toThrow();
    }
    await expect(
      encodeAgentArchive({
        ...bundle,
        skills: [
          {
            name: 'skill',
            files: [
              { path: 'SKILL.md', data: Buffer.from('skill') },
              { path: 'references', data: Buffer.from('file') },
              { path: 'references/file', data: Buffer.from('file') },
            ],
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('rejects duplicate tool names under different aliases', async () => {
    const manifest = JSON.stringify({
      formatVersion: 1,
      agent: bundle.agent,
      skills: [],
      tools: ['first', 'second'],
    });
    const tool = JSON.stringify({ name: 'same', kind: 'builtin' });
    const data = await archive({
      'agent/agent.json': manifest,
      'agent/instructions.md': '',
      'agent/tools/first.json': tool,
      'agent/tools/second.json': tool,
    });
    await expect(decodeAgentArchive(data)).rejects.toThrow('Duplicate tool name');
  });
});
