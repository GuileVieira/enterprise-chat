import { collectSkillDirectories, createSkillArchive } from './skillDirectory';

function directoryFile(path: string, content: string): File {
  const file = new File([content], path.split('/').at(-1));
  Object.defineProperty(file, 'webkitRelativePath', { value: path });
  return file;
}

describe('skillDirectory', () => {
  it('separates skills and preserves auxiliary file paths', async () => {
    const directories = collectSkillDirectories([
      directoryFile('skills/meta-ads/SKILL.md', '# Meta Ads'),
      directoryFile('skills/meta-ads/references/events.md', '# Events'),
      directoryFile('skills/copy/SKILL.md', '# Copy'),
      directoryFile('skills/README.md', '# Parent'),
    ]);

    expect(directories.map(({ name }) => name)).toEqual(['copy', 'meta-ads']);
    expect(directories[1].files.map(({ relativePath }) => relativePath)).toEqual([
      'SKILL.md',
      'references/events.md',
    ]);

    const archive = await createSkillArchive(directories[1]);
    expect(archive.name).toBe('meta-ads.skill');
    expect(archive.size).toBeGreaterThan(0);
  });

  it('ignores folders without SKILL.md', () => {
    expect(
      collectSkillDirectories([directoryFile('skills/incomplete/reference.md', '# Missing')]),
    ).toEqual([]);
  });
});
