import JSZip from 'jszip';

export interface SkillDirectory {
  name: string;
  path: string;
  files: Array<{ file: File; relativePath: string }>;
}

export function collectSkillDirectories(files: File[]): SkillDirectory[] {
  const entries = files
    .map((file) => ({
      file,
      path: file.webkitRelativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''),
    }))
    .filter(({ path }) => path !== '');
  const roots = new Set<string>();

  for (const { path } of entries) {
    const segments = path.split('/');
    if (segments.at(-1)?.toUpperCase() === 'SKILL.MD') {
      roots.add(segments.slice(0, -1).join('/'));
    }
  }

  const orderedRoots = [...roots].filter(Boolean).sort((a, b) => b.length - a.length);
  const directories = orderedRoots.map((root) => ({
    name: root.split('/').at(-1) ?? root,
    path: root,
    files: [] as SkillDirectory['files'],
  }));

  for (const entry of entries) {
    const directory = directories.find(
      ({ path }) => entry.path === path || entry.path.startsWith(`${path}/`),
    );
    if (!directory) continue;
    directory.files.push({
      file: entry.file,
      relativePath: entry.path.slice(directory.path.length + 1),
    });
  }

  return directories.sort((a, b) => a.path.localeCompare(b.path));
}

export async function createSkillArchive(directory: SkillDirectory): Promise<File> {
  const zip = new JSZip();
  for (const { file, relativePath } of directory.files) {
    zip.file(relativePath, file);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return new File([blob], `${directory.name}.skill`, { type: 'application/zip' });
}

export async function createSkillImportFile(directory: SkillDirectory): Promise<File> {
  const skillMd = directory.files.find(
    ({ relativePath }) => relativePath.toUpperCase() === 'SKILL.MD',
  );
  if (directory.files.length === 1 && skillMd) {
    return new File([skillMd.file], `${directory.name}.md`, { type: 'text/markdown' });
  }
  return createSkillArchive(directory);
}
