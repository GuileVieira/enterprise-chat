export interface LegacyCandidateRecord {
  id: string;
  userId: string;
  key: string;
}

export interface LegacyCandidateItem {
  key: string;
  status: 'resolved' | 'ambiguous' | 'inaccessible' | 'missing';
  candidates: Array<{ memoryId: string; authorId: string }>;
}

export function buildLegacyCandidateItems(
  keys: string[],
  owned: LegacyCandidateRecord[],
  tenantCounts: Array<{ key: string; count: number }>,
): LegacyCandidateItem[] {
  const grouped = new Map(keys.map((key) => [key, [] as LegacyCandidateItem['candidates']]));
  for (const memory of owned) {
    grouped.get(memory.key)?.push({ memoryId: memory.id, authorId: memory.userId });
  }
  const counts = new Map(tenantCounts.map((entry) => [entry.key, entry.count]));
  return keys.map((key) => {
    const candidates = grouped.get(key) ?? [];
    let status: LegacyCandidateItem['status'] = 'missing';
    if (candidates.length === 1) status = 'resolved';
    else if (candidates.length > 1) status = 'ambiguous';
    else if (counts.get(key)) status = 'inaccessible';
    return { key, status, candidates };
  });
}

export interface SharedContextMemory {
  id: string;
  key: string;
  tokenCount: number;
  status: 'active' | 'archived';
  filtered: boolean;
}

export interface SharedContextStatus {
  linked: number;
  available: number;
  archived: number;
  missing: number;
  filtered: number;
  omittedByLimit: number;
}

export function calculateSharedContextStatus(
  linkedIds: string[],
  memories: SharedContextMemory[],
  localKeys: Set<string>,
  tokenLimit?: number,
): SharedContextStatus {
  const ids = [...new Set(linkedIds)];
  const byId = new Map(memories.map((memory) => [memory.id, memory]));
  const result: SharedContextStatus = {
    linked: ids.length,
    available: 0,
    archived: 0,
    missing: 0,
    filtered: 0,
    omittedByLimit: 0,
  };
  let tokens = 0;
  for (const id of ids) {
    const memory = byId.get(id);
    if (!memory) {
      result.missing++;
      continue;
    }
    if (memory.status !== 'active') {
      result.archived++;
      continue;
    }
    if (memory.filtered) {
      result.filtered++;
      continue;
    }
    if (localKeys.has(memory.key)) continue;
    if (tokenLimit && tokens + memory.tokenCount > tokenLimit) {
      result.omittedByLimit++;
      continue;
    }
    tokens += memory.tokenCount;
    result.available++;
  }
  return result;
}
