import { Blob as NodeBlob } from 'node:buffer';
import { runInThisContext } from 'node:vm';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import type { StoredMeetingRecording } from '../meetingStorage';
import {
  saveMeetingChunk,
  readMeetingChunk,
  deleteMeetingChunk,
  deleteMeetingChunks,
  saveMeetingRecording,
  listMeetingRecordings,
  expireMeetingRecordings,
  MAX_MEETING_STORAGE_BYTES,
  MEETING_RECORDING_RETENTION_MS,
} from '../meetingStorage';

const recording = (key: string, age = 0, projectId = 'project-1'): StoredMeetingRecording => ({
  key,
  projectId,
  meetingId: key,
  mimeType: 'audio/webm',
  duration: 10,
  recordedAt: new Date(Date.now() - age).toISOString(),
  totalChunks: 1,
});

const openDatabase = (version?: number) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('orqest-meeting-recorder', version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

async function setUsage(bytes: number) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('usage', 'readwrite');
    transaction.objectStore('usage').put(bytes, 'bytes');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

describe('meeting recording storage', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
    Object.defineProperty(globalThis, 'IDBKeyRange', { configurable: true, value: IDBKeyRange });
    Object.defineProperty(globalThis, 'Blob', { configurable: true, value: NodeBlob });
    Object.defineProperty(globalThis, 'structuredClone', {
      configurable: true,
      value: runInThisContext('structuredClone'),
    });
  });

  it('expires metadata and chunks at 24 hours across projects, preserving newer data', async () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    await saveMeetingRecording(recording('expired', MEETING_RECORDING_RETENTION_MS));
    await saveMeetingRecording(
      recording('foreign-expired', MEETING_RECORDING_RETENTION_MS, 'project-2'),
    );
    await saveMeetingRecording(recording('old', 1000));
    await saveMeetingRecording(recording('new'));
    await saveMeetingChunk('expired', 0, new Blob(['expired']));
    await saveMeetingChunk('foreign-expired', 0, new Blob(['expired']));
    await saveMeetingChunk('new', 0, new Blob(['keep']));

    await expect(expireMeetingRecordings()).resolves.toBe(
      now - 1000 + MEETING_RECORDING_RETENTION_MS,
    );
    expect((await listMeetingRecordings('project-1')).map((item) => item.key)).toEqual([
      'new',
      'old',
    ]);
    expect(await listMeetingRecordings('project-2')).toEqual([]);
    expect(await readMeetingChunk('expired', 0)).toBeUndefined();
    expect(await readMeetingChunk('foreign-expired', 0)).toBeUndefined();
    expect((await readMeetingChunk('new', 0))?.size).toBe(4);
  });

  it('enforces the shared byte limit atomically without deleting existing chunks', async () => {
    await saveMeetingChunk('kept', 0, new Blob(['keep']));
    await setUsage(MAX_MEETING_STORAGE_BYTES - 3);
    const results = await Promise.allSettled([
      saveMeetingChunk('first', 0, new Blob(['12'])),
      saveMeetingChunk('second', 0, new Blob(['34'])),
    ]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(results[1]).toMatchObject({ reason: { name: 'QuotaExceededError' } });
    expect(await readMeetingChunk('second', 0)).toBeUndefined();
    expect((await readMeetingChunk('kept', 0))?.size).toBe(4);
    await expect(saveMeetingChunk('first', 0, new Blob(['ab']))).resolves.toBeUndefined();
    await deleteMeetingChunk('first', 0);
    await expect(saveMeetingChunk('second', 0, new Blob(['34']))).resolves.toBeUndefined();
  });

  it('releases usage when expired recording chunks are removed', async () => {
    await saveMeetingRecording(recording('expired', MEETING_RECORDING_RETENTION_MS + 1));
    await saveMeetingChunk('expired', 0, new Blob(['12345']));
    await setUsage(MAX_MEETING_STORAGE_BYTES);
    await expireMeetingRecordings();
    await expect(saveMeetingChunk('new', 0, new Blob(['12345']))).resolves.toBeUndefined();
    await expect(saveMeetingChunk('new', 1, new Blob(['1']))).rejects.toMatchObject({
      name: 'QuotaExceededError',
    });
    await deleteMeetingChunks('new');
    await expect(saveMeetingChunk('new', 0, new Blob(['12345']))).resolves.toBeUndefined();
  });

  it('initializes byte accounting from existing version 2 chunks without changing them', async () => {
    const request = indexedDB.open('orqest-meeting-recorder', 2);
    await new Promise<void>((resolve, reject) => {
      request.onupgradeneeded = () => {
        request.result.createObjectStore('recordings', { keyPath: 'key' });
        request.result.createObjectStore('chunks').put(new Blob(['legacy']), 'legacy:00000000');
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    await saveMeetingChunk('new', 0, new Blob(['data']));
    expect((await readMeetingChunk('legacy', 0))?.size).toBe(6);
    const db = await openDatabase();
    const bytes = await new Promise<number>((resolve, reject) => {
      const usage = db.transaction('usage').objectStore('usage').get('bytes');
      usage.onsuccess = () => resolve(usage.result as number);
      usage.onerror = () => reject(usage.error);
    });
    db.close();
    expect(bytes).toBe(10);
  });
});
