const DB_NAME = 'orqest-meeting-recorder';
const STORE_NAME = 'chunks';
const RECORDINGS_STORE = 'recordings';
const USAGE_STORE = 'usage';
export const MEETING_RECORDING_RETENTION_MS = 24 * 60 * 60 * 1000;
export const MAX_MEETING_STORAGE_BYTES = 2 * 1024 * 1024 * 1024;

export interface StoredMeetingRecording {
  key: string;
  meetingId: string;
  projectId: string;
  mimeType: string;
  duration: number;
  recordedAt: string;
  totalChunks: number;
}

const openChunkStore = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
      if (!request.result.objectStoreNames.contains(RECORDINGS_STORE)) {
        request.result.createObjectStore(RECORDINGS_STORE, { keyPath: 'key' });
      }
      if (!request.result.objectStoreNames.contains(USAGE_STORE)) {
        request.result.createObjectStore(USAGE_STORE);
        const transaction = request.transaction;
        if (!transaction) {
          return;
        }
        let bytes = 0;
        const cursor = transaction.objectStore(STORE_NAME).openCursor();
        cursor.onsuccess = () => {
          if (cursor.result) {
            bytes += (cursor.result.value as Blob).size;
            cursor.result.continue();
          } else {
            transaction.objectStore(USAGE_STORE).put(bytes, 'bytes');
          }
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

async function writeMeetingChunk(key: string, index: number, chunk?: Blob) {
  const db = await openChunkStore();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, USAGE_STORE], 'readwrite');
      const chunks = transaction.objectStore(STORE_NAME);
      const usage = transaction.objectStore(USAGE_STORE);
      const chunkKey = `${key}:${String(index).padStart(8, '0')}`;
      const previous = chunks.get(chunkKey);
      let failure: DOMException | null = null;
      previous.onsuccess = () => {
        const storedBytes = usage.get('bytes');
        storedBytes.onsuccess = () => {
          const previousChunk = previous.result as Blob | undefined;
          const bytes = Math.max(
            0,
            ((storedBytes.result as number | undefined) ?? 0) -
              (previousChunk?.size ?? 0) +
              (chunk?.size ?? 0),
          );
          if (chunk && bytes > MAX_MEETING_STORAGE_BYTES) {
            failure = new DOMException(
              'Meeting recording storage limit reached',
              'QuotaExceededError',
            );
            transaction.abort();
            return;
          }
          if (chunk) {
            chunks.put(chunk, chunkKey);
          } else {
            chunks.delete(chunkKey);
          }
          usage.put(bytes, 'bytes');
        };
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(failure ?? transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export const saveMeetingChunk = (key: string, index: number, chunk: Blob) =>
  writeMeetingChunk(key, index, chunk);

export async function readMeetingChunk(key: string, index: number) {
  const db = await openChunkStore();
  const chunk = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME)
      .objectStore(STORE_NAME)
      .get(`${key}:${String(index).padStart(8, '0')}`);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return chunk;
}

export async function listMeetingChunkIndexes(key: string) {
  const db = await openChunkStore();
  const range = IDBKeyRange.bound(`${key}:`, `${key}:\uffff`);
  const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAllKeys(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return keys.map((item) => Number(String(item).slice(key.length + 1)));
}

export const deleteMeetingChunk = (key: string, index: number) => writeMeetingChunk(key, index);

export async function saveMeetingRecording(recording: StoredMeetingRecording) {
  const db = await openChunkStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(RECORDINGS_STORE, 'readwrite');
    transaction.objectStore(RECORDINGS_STORE).put(recording);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function readMeetingRecordings() {
  const db = await openChunkStore();
  const recordings = await new Promise<StoredMeetingRecording[]>((resolve, reject) => {
    const request = db.transaction(RECORDINGS_STORE).objectStore(RECORDINGS_STORE).getAll();
    request.onsuccess = () => resolve(request.result as StoredMeetingRecording[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return recordings;
}

export async function listMeetingRecordings(projectId: string) {
  const recordings = await readMeetingRecordings();
  return recordings
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
}

export async function expireMeetingRecordings() {
  const recordings = await readMeetingRecordings();
  const now = Date.now();
  let nextExpiry: number | null = null;
  for (const recording of recordings) {
    const expiresAt = Date.parse(recording.recordedAt) + MEETING_RECORDING_RETENTION_MS;
    if (!Number.isFinite(expiresAt)) {
      // Preserve audio when its recording date cannot establish that it expired.
      continue;
    }
    if (expiresAt <= now) {
      await deleteMeetingChunks(recording.key);
    } else {
      nextExpiry = Math.min(nextExpiry ?? expiresAt, expiresAt);
    }
  }
  return nextExpiry;
}

export async function deleteMeetingChunks(key: string) {
  const db = await openChunkStore();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, RECORDINGS_STORE, USAGE_STORE], 'readwrite');
      const usage = transaction.objectStore(USAGE_STORE);
      const storedBytes = usage.get('bytes');
      storedBytes.onsuccess = () => {
        let removedBytes = 0;
        const range = IDBKeyRange.bound(`${key}:`, `${key}:\uffff`);
        const cursor = transaction.objectStore(STORE_NAME).openCursor(range);
        cursor.onsuccess = () => {
          if (cursor.result) {
            removedBytes += (cursor.result.value as Blob).size;
            cursor.result.delete();
            cursor.result.continue();
          } else {
            usage.put(
              Math.max(0, ((storedBytes.result as number | undefined) ?? 0) - removedBytes),
              'bytes',
            );
            transaction.objectStore(RECORDINGS_STORE).delete(key);
          }
        };
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
