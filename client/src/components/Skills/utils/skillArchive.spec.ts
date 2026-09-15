import JSZip from 'jszip';
import { splitSkillArchive } from './skillArchive';

async function archive(entries: Record<string, string | Uint8Array>, name = 'skills.zip') {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) {
    zip.file(path, content);
  }
  return new File([await zip.generateAsync({ type: 'blob' })], name, {
    type: 'application/zip',
  });
}

describe('splitSkillArchive', () => {
  it('passes markdown and an ordinary root archive through unchanged', async () => {
    const markdown = new File(['---\nname: direct\n---'], 'SKILL.md');
    const rootArchive = await archive({ 'SKILL.md': 'root', 'references/guide.md': 'guide' });

    await expect(splitSkillArchive(markdown)).resolves.toEqual([markdown]);
    await expect(splitSkillArchive(rootArchive)).resolves.toEqual([rootArchive]);
  });

  it('splits many nested skills while preserving each root-relative tree', async () => {
    const entries: Record<string, string> = { 'README.md': 'outside' };
    for (let index = 0; index < 40; index++) {
      const root = `bundle/team-${index}/skill-${index}`;
      entries[`${root}/${index % 2 ? 'skill.md' : 'SKILL.md'}`] = `skill ${index}`;
      entries[`${root}/assets/icon-${index}.svg`] = `<svg>${index}</svg>`;
      entries[`${root}/evals/case-${index}.json`] = `{ "case": ${index} }`;
      entries[`${root}/references/guide-${index}.md`] = `guide ${index}`;
    }

    const files = await splitSkillArchive(await archive(entries));
    expect(files).toHaveLength(40);

    const first = await JSZip.loadAsync(files[0]);
    expect(await first.file('SKILL.md')?.async('string')).toBe('skill 0');
    expect(await first.file('assets/icon-0.svg')?.async('string')).toBe('<svg>0</svg>');
    expect(await first.file('evals/case-0.json')?.async('string')).toBe('{ "case": 0 }');
    expect(await first.file('references/guide-0.md')?.async('string')).toBe('guide 0');
    expect(first.file('README.md')).toBeNull();
    expect(first.file('bundle/team-1/skill-1/SKILL.md')).toBeNull();
  });

  it('repackages one wrapped skill and excludes files outside its root', async () => {
    const input = await archive({
      'export/wrapper/my-skill/SKILL.md': 'body',
      'export/wrapper/my-skill/assets/logo.txt': 'logo',
      'export/wrapper/notes.txt': 'outside',
    });

    const [file] = await splitSkillArchive(input);
    const zip = await JSZip.loadAsync(file);
    expect(file.name).toBe('my-skill.skill');
    expect(await zip.file('SKILL.md')?.async('string')).toBe('body');
    expect(await zip.file('assets/logo.txt')?.async('string')).toBe('logo');
    expect(zip.file('notes.txt')).toBeNull();
  });

  it('assigns nested skill files to their nearest skill root', async () => {
    const files = await splitSkillArchive(
      await archive({
        'SKILL.md': 'parent',
        'parent.txt': 'parent asset',
        'children/child/SKILL.md': 'child',
        'children/child/assets/child.txt': 'child asset',
      }),
    );

    const root = await JSZip.loadAsync(files.find((file) => file.name === 'skills.skill')!);
    const child = await JSZip.loadAsync(files.find((file) => file.name === 'child.skill')!);
    expect(root.file('parent.txt')).not.toBeNull();
    expect(root.file('children/child/SKILL.md')).toBeNull();
    expect(child.file('assets/child.txt')).not.toBeNull();
  });

  it('rejects traversal paths, too many entries, oversized files, and missing manifests', async () => {
    const traversal = await archive({ '../escape/SKILL.md': 'bad' });
    const tooManyEntries: Record<string, string> = { 'SKILL.md': 'root' };
    for (let index = 0; index < 500; index++) {
      tooManyEntries[`assets/${index}.txt`] = '';
    }

    const cases = [
      traversal,
      await archive(tooManyEntries),
      await archive({
        'nested/SKILL.md': 'root',
        'nested/large.bin': new Uint8Array(10 * 1024 * 1024 + 1),
      }),
      await archive({ 'README.md': 'no skill here' }),
    ];
    for (const input of cases) {
      await expect(splitSkillArchive(input)).rejects.toThrow('com_ui_create_skill_upload_error');
    }
  });
});
