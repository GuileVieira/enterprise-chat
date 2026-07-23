const DB_NAME = 'orqest-meeting-recorder';
const STORE_NAME = 'chunks';

const openChunkStore = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
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

export async function readMeetingChunks(key: string) {
  const db = await openChunkStore();
  const range = IDBKeyRange.bound(`${key}:`, `${key}:\uffff`);
  const chunks = await new Promise<Blob[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return chunks;
}

export async function deleteMeetingChunks(key: string) {
  const db = await openChunkStore();
  const range = IDBKeyRange.bound(`${key}:`, `${key}:\uffff`);
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
    const request = store.getAllKeys(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  keys.forEach((item) => store.delete(item));
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
