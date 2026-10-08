import type { SharedMemoryImportPreviewItem } from 'librechat-data-provider';

export const SHARED_MEMORY_IMPORT_MAX_ITEMS = 500;
export const SHARED_MEMORY_MAX_VALUE_LENGTH = 10000;

export interface PortableMemory {
  ref: string;
  key: string;
  value: string;
}

export function isSharedMemoryKey(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 1000 && /^[a-z_]+$/.test(value);
}

export function isScalarString(value: unknown, max = 256): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

export function validateSharedMemoryImportRequest(
  body: unknown,
  requireOperationId: boolean,
): boolean {
  if (!isPlainObject(body) || (requireOperationId && !isScalarString(body.operationId, 128)))
    return false;
  if (
    typeof body.format !== 'string' ||
    !['json', 'csv'].includes(body.format) ||
    typeof body.content !== 'string'
  )
    return false;
  const destination = body.destination;
  if (
    !isPlainObject(destination) ||
    typeof destination.type !== 'string' ||
    !['library', 'project', 'personal'].includes(destination.type)
  )
    return false;
  if (destination.type === 'project' && !isScalarString(destination.projectId)) return false;
  if (
    destination.type === 'personal' &&
    destination.agentId != null &&
    !isScalarString(destination.agentId)
  )
    return false;
  if (
    body.selectedRefs != null &&
    (!Array.isArray(body.selectedRefs) ||
      body.selectedRefs.some((ref) => !isScalarString(ref, 128)))
  )
    return false;
  if (body.decisions != null) {
    if (!isPlainObject(body.decisions)) return false;
    for (const [ref, rawDecision] of Object.entries(body.decisions)) {
      if (
        !isScalarString(ref, 128) ||
        !isPlainObject(rawDecision) ||
        typeof rawDecision.action !== 'string' ||
        !['skip', 'replace', 'copy'].includes(rawDecision.action)
      )
        return false;
      if (rawDecision.copyKey != null && !isSharedMemoryKey(rawDecision.copyKey)) return false;
      if (
        rawDecision.expectedVersion != null &&
        (!Number.isInteger(rawDecision.expectedVersion) || Number(rawDecision.expectedVersion) < 0)
      )
        return false;
      if (
        rawDecision.expectedUpdatedAt != null &&
        (!isScalarString(rawDecision.expectedUpdatedAt) ||
          Number.isNaN(Date.parse(rawDecision.expectedUpdatedAt)))
      )
        return false;
    }
  }
  return true;
}

export function parseMemoryCsv(input: string): PortableMemory[] {
  input = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted && char === '"' && input[i + 1] === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      if (!quoted && field.length > 0) throw new Error('CSV contains a malformed quote.');
      quoted = !quoted;
      closedQuote = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(field);
      field = '';
      closedQuote = false;
      if (char === '\n') {
        rows.push(row);
        row = [];
      }
    } else if (char === '\r' && !quoted && input[i + 1] === '\n') {
      continue;
    } else if (closedQuote) {
      throw new Error('CSV contains characters after a closing quote.');
    } else if (char !== '\r' || quoted) {
      field += char;
    }
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field.');
  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  const [header, ...data] = rows;
  if (!header || header.length !== 2 || header[0] !== 'key' || header[1] !== 'value') {
    throw new Error('CSV header must be key,value.');
  }
  if (data.some((columns) => columns.length !== 2))
    throw new Error('CSV rows must contain key and value.');
  return data.map(([key = '', value = ''], index) => ({ ref: `row_${index + 2}`, key, value }));
}

export function parseMemoryImport(body: { format?: unknown; content?: unknown }): PortableMemory[] {
  if (
    typeof body.format !== 'string' ||
    !['json', 'csv'].includes(body.format) ||
    typeof body.content !== 'string'
  ) {
    throw new Error('Invalid import request.');
  }
  let raw: unknown;
  if (body.format === 'csv') raw = parseMemoryCsv(body.content);
  else {
    const parsed = JSON.parse(body.content) as {
      format?: unknown;
      version?: unknown;
      items?: unknown;
    };
    if (
      parsed.format !== 'orqest-memories' ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.items)
    ) {
      throw new Error('Unsupported memory package.');
    }
    raw = parsed.items;
  }
  const items = raw as Array<{ ref?: unknown; key?: unknown; value?: unknown } | null>;
  if (items.length > SHARED_MEMORY_IMPORT_MAX_ITEMS) {
    throw new Error(`Import exceeds ${SHARED_MEMORY_IMPORT_MAX_ITEMS} items.`);
  }
  const refs = new Set<string>();
  return items.map((item, index) => {
    const ref = item?.ref ?? `item_${index + 1}`;
    if (!isScalarString(ref, 128)) throw new Error('Invalid import ref.');
    if (refs.has(ref)) throw new Error(`Duplicate import ref: ${ref}.`);
    refs.add(ref);
    return {
      ref,
      key: typeof item?.key === 'string' ? item.key : '',
      value: typeof item?.value === 'string' ? item.value : '',
    };
  });
}

export function classifyMemoryImport(
  items: PortableMemory[],
  existing: Map<string, SharedMemoryImportPreviewItem['existing']>,
): SharedMemoryImportPreviewItem[] {
  const seen = new Set<string>();
  return items.map((item) => {
    const current = existing.get(item.key);
    let status: SharedMemoryImportPreviewItem['status'] = 'new';
    let error: string | undefined;
    if (
      !isSharedMemoryKey(item.key) ||
      !item.value.trim() ||
      item.value.length > SHARED_MEMORY_MAX_VALUE_LENGTH
    ) {
      status = 'invalid';
      error = 'Invalid key or value.';
    } else if (seen.has(item.key)) {
      status = 'invalid';
      error = 'Duplicate key in import.';
    } else if (current) {
      status = current.value === item.value ? 'identical' : 'conflict';
    }
    seen.add(item.key);
    return { ...item, status, error, existing: current };
  });
}

export function escapeMemoryCsvCell(value: string): string {
  const safe = /^\s*[=+\-@]|^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
