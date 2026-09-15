import JSZip from 'jszip';

const ERROR_KEY = 'com_ui_create_skill_upload_error';
const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_DECOMPRESSED_BYTES = 500 * 1024 * 1024;
const MAX_ENTRIES = 5000;
const MAX_SKILL_ENTRIES = 500;
const MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024;

type ZipStream = {
  on(event: 'data', listener: (chunk: Uint8Array) => void): ZipStream;
  on(event: 'error', listener: () => void): ZipStream;
  on(event: 'end', listener: () => void): ZipStream;
  pause(): ZipStream;
  resume(): ZipStream;
};

type SizedZipObject = JSZip.JSZipObject & {
  unsafeOriginalName?: string;
  _data?: { uncompressedSize?: number };
  internalStream(type: 'uint8array'): ZipStream;
};

function fail(): never {
  throw new Error(ERROR_KEY);
}

function assertSafePath(path: string): void {
  if (
    !path ||
    path.includes('\\') ||
    path.includes('\0') ||
    path.startsWith('/') ||
    /^[A-Za-z]:/.test(path) ||
    path.split('/').some((part) => part === '..')
  ) {
    fail();
  }
}

function skillRoot(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  if (parts.at(-1)?.toLowerCase() !== 'skill.md') {
    return null;
  }
  return parts.slice(0, -1).join('/');
}

function belongsToRoot(path: string, root: string, allRoots: string[]): boolean {
  if (root && path !== root && !path.startsWith(`${root}/`)) {
    return false;
  }
  if (!root && allRoots.some((candidate) => candidate && path.startsWith(`${candidate}/`))) {
    return false;
  }
  return !allRoots.some(
    (candidate) =>
      candidate !== root &&
      candidate.length > root.length &&
      (!root || candidate.startsWith(`${root}/`)) &&
      (path === candidate || path.startsWith(`${candidate}/`)),
  );
}

function archiveName(file: File, root: string): string {
  const stem = file.name.replace(/\.(?:zip|skill)$/i, '') || 'skill';
  return `${root.split('/').filter(Boolean).at(-1) ?? stem}.skill`;
}

function readEntry(entry: SizedZipObject, remainingBytes: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    let settled = false;
    const stream = entry.internalStream('uint8array');
    const rejectOnce = () => {
      if (settled) return;
      settled = true;
      stream.pause();
      reject(new Error(ERROR_KEY));
    };
    stream.on('data', (chunk: Uint8Array) => {
      size += chunk.byteLength;
      if (size > MAX_SINGLE_FILE_BYTES || size > remainingBytes) {
        rejectOnce();
        return;
      }
      chunks.push(chunk);
    });
    stream.on('error', rejectOnce);
    stream.on('end', () => {
      if (settled) return;
      settled = true;
      const result = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
      }
      resolve(result);
    });
    stream.resume();
  });
}

export async function splitSkillArchive(file: File, maxZipBytes = MAX_ZIP_BYTES): Promise<File[]> {
  if (/\.md$/i.test(file.name)) {
    return [file];
  }
  if (!/\.(?:zip|skill)$/i.test(file.name) || file.size > maxZipBytes) {
    fail();
  }

  let source: JSZip;
  try {
    source = await JSZip.loadAsync(file);
  } catch {
    fail();
  }

  const entries = Object.values(source.files) as SizedZipObject[];
  if (entries.length > MAX_ENTRIES) {
    fail();
  }

  let declaredBytes = 0;
  for (const entry of entries) {
    assertSafePath(entry.name);
    if (entry.unsafeOriginalName) {
      assertSafePath(entry.unsafeOriginalName);
    }
    if (!entry.dir) {
      const size = entry._data?.uncompressedSize;
      if (typeof size === 'number') {
        if (size > MAX_SINGLE_FILE_BYTES) {
          fail();
        }
        declaredBytes += size;
        if (declaredBytes > MAX_DECOMPRESSED_BYTES) {
          fail();
        }
      }
    }
  }

  const roots = entries
    .filter((entry) => !entry.dir)
    .map((entry) => skillRoot(entry.name))
    .filter((root): root is string => root !== null)
    .filter((root, index, values) => values.indexOf(root) === index);
  if (roots.length === 0) {
    fail();
  }
  if (
    roots.some((root) => {
      const count = entries.filter(
        (entry) => !entry.dir && belongsToRoot(entry.name, root, roots),
      ).length;
      return count > MAX_SKILL_ENTRIES;
    })
  ) {
    fail();
  }
  const shouldRepack = roots.length !== 1 || roots[0] !== '';
  let actualBytes = 0;
  const extracted = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (entry.dir) continue;
    const bytes = await readEntry(entry, MAX_DECOMPRESSED_BYTES - actualBytes);
    actualBytes += bytes.byteLength;
    if (shouldRepack && roots.some((root) => belongsToRoot(entry.name, root, roots))) {
      extracted.set(entry.name, bytes);
    }
  }
  if (!shouldRepack) {
    return [file];
  }

  const results: File[] = [];
  for (const root of roots) {
    const output = new JSZip();
    let outputEntries = 0;
    for (const entry of entries) {
      if (entry.dir || !belongsToRoot(entry.name, root, roots)) {
        continue;
      }
      const bytes = extracted.get(entry.name);
      if (!bytes) fail();
      if (++outputEntries > MAX_SKILL_ENTRIES) {
        fail();
      }
      const sourcePath = root ? entry.name.slice(root.length + 1) : entry.name;
      const relativePath = sourcePath.toLowerCase() === 'skill.md' ? 'SKILL.md' : sourcePath;
      output.file(relativePath, bytes);
    }
    const blob = await output.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    results.push(new File([blob], archiveName(file, root), { type: 'application/zip' }));
  }
  return results;
}
