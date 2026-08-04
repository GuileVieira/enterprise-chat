const DB_NAME = 'orqest-meeting-recorder';
const STORE_NAME = 'chunks';
const RECORDINGS_STORE = 'recordings';

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
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
      if (!request.result.objectStoreNames.contains(RECORDINGS_STORE)) {
        request.result.createObjectStore(RECORDINGS_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export async function saveMeetingChunk(key: string, index: number, chunk: Blob) {
  const db = await openChunkStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(chunk, `${key}:${String(index).padStart(8, '0')}`);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

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

export async function deleteMeetingChunk(key: string, index: number) {
  const db = await openChunkStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(`${key}:${String(index).padStart(8, '0')}`);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

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

export async function listMeetingRecordings(projectId: string) {
  const db = await openChunkStore();
  const recordings = await new Promise<StoredMeetingRecording[]>((resolve, reject) => {
    const request = db.transaction(RECORDINGS_STORE).objectStore(RECORDINGS_STORE).getAll();
    request.onsuccess = () =>
      resolve(
        (request.result as StoredMeetingRecording[]).filter((item) => item.projectId === projectId),
      );
    request.onerror = () => reject(request.error);
  });
  db.close();
  return recordings;
}

export async function deleteMeetingChunks(key: string) {
  const db = await openChunkStore();
  const range = IDBKeyRange.bound(`${key}:`, `${key}:\uffff`);
  const transaction = db.transaction([STORE_NAME, RECORDINGS_STORE], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
    const request = store.getAllKeys(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  keys.forEach((item) => store.delete(item));
  transaction.objectStore(RECORDINGS_STORE).delete(key);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
