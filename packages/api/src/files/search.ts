import axios from 'axios';
import { z } from 'zod';
import type { TFile } from 'librechat-data-provider';
import { generateShortLivedToken } from '~/crypto/jwt';

export interface SearchFile {
  file_id: string;
  filename: string;
  projectId?: string;
  metadata?: TFile['metadata'];
  fromAgent?: boolean;
}

export const fileSearchArguments: z.ZodType<{ query: string }> = z
  .object({ query: z.string().trim().min(1).max(4000) })
  .strict();
export const FILE_SEARCH_LIMITS: {
  files: number;
  concurrency: number;
  deadlineMs: number;
  bytes: number;
} = { files: 50, concurrency: 5, deadlineMs: 30000, bytes: 1048576 };
const chunkSchema = z.tuple([
  z.object({
    page_content: z.string(),
    metadata: z
      .object({ source: z.string().optional(), page: z.unknown().optional() })
      .passthrough(),
  }),
  z.number().finite(),
]);
const responseSchema = z.array(chunkSchema).max(5);
export type SearchStatus = 'success' | 'empty' | 'no_files' | 'partial' | 'failed';
export type SearchFailure =
  | 'rag_auth'
  | 'unavailable'
  | 'timeout'
  | 'cancelled'
  | 'invalid_response'
  | 'response_limit';
export interface SearchSource {
  type: 'file';
  fileId: string;
  content: string;
  fileName: string;
  relevance: number;
  pages: number[];
  pageRelevance: { [page: string]: number };
  metadata?: { imageRag: NonNullable<NonNullable<TFile['metadata']>['imageRag']> };
}
export interface FileSearchResult {
  status: SearchStatus;
  indexStatus: 'index_status_unknown';
  sources: SearchSource[];
  failures: { fileId: string; code: SearchFailure }[];
  limits: typeof FILE_SEARCH_LIMITS;
}
export class FileSearchLimitError extends Error {}

/** Queries only server-authorized files. Fallbacks share one deadline and concurrency budget. */
export async function searchFiles(options: {
  userId: string;
  files: readonly SearchFile[];
  query: string;
  entityId?: string;
  signal?: AbortSignal;
  token?: string | null;
  legacyChat?: boolean;
}): Promise<FileSearchResult> {
  const { userId, entityId, signal } = options;
  const query = options.legacyChat
    ? z.string().parse(options.query)
    : fileSearchArguments.parse({ query: options.query }).query;
  const files = [...new Map(options.files.map((file) => [file.file_id, file])).values()];
  if (!options.legacyChat && files.length > FILE_SEARCH_LIMITS.files) {
    throw new FileSearchLimitError('File search scope exceeds 50 files');
  }
  const result: FileSearchResult = {
    status: files.length ? 'empty' : 'no_files',
    indexStatus: 'index_status_unknown',
    sources: [],
    failures: [],
    limits: { ...FILE_SEARCH_LIMITS },
  };
  if (!files.length) {
    return result;
  }
  let token: string | null | undefined;
  try {
    token = 'token' in options ? options.token : generateShortLivedToken(userId);
  } catch {
    token = null;
  }
  if (!token) {
    result.status = 'failed';
    result.failures = files.map((file) => ({ fileId: file.file_id, code: 'rag_auth' }));
    return result;
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) {
    controller.abort();
  }
  const deadline = Date.now() + FILE_SEARCH_LIMITS.deadlineMs;
  const timer = setTimeout(abort, FILE_SEARCH_LIMITS.deadlineMs);
  let abortFailure: SearchFailure | undefined;
  let cursor = 0;
  let responseBytes = 0;
  const chunks: (SearchSource & { distance: number })[] = [];
  const queryFile = async (file: SearchFile): Promise<void> => {
    const entities = [
      ...new Set([
        ...(file.projectId ? [file.projectId] : []),
        ...(entityId && (file.fromAgent || entityId === file.projectId) ? [entityId] : []),
        undefined,
      ]),
    ];
    let validEmpty = false;
    let failedAttempt = false;
    let failure: SearchFailure = 'unavailable';
    for (const candidate of entities) {
      if (controller.signal.aborted || Date.now() >= deadline) {
        failure = abortFailure ?? (signal?.aborted ? 'cancelled' : 'timeout');
        break;
      }
      const body: { file_id: string; query: string; k: number; entity_id?: string } = {
        file_id: file.file_id,
        query,
        k: 5,
      };
      if (
        candidate &&
        !(candidate === entityId && candidate !== file.projectId && !file.fromAgent)
      ) {
        body.entity_id = candidate;
      }
      try {
        const response = await axios.post<unknown>(`${process.env.RAG_API_URL}/query`, body, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          signal: controller.signal,
          timeout: Math.max(1, deadline - Date.now()),
          maxContentLength: FILE_SEARCH_LIMITS.bytes,
          maxBodyLength: FILE_SEARCH_LIMITS.bytes,
          maxRedirects: 0,
        });
        responseBytes += Buffer.byteLength(JSON.stringify(response.data) ?? '');
        if (responseBytes > FILE_SEARCH_LIMITS.bytes) {
          abortFailure = 'response_limit';
          controller.abort();
          failure = 'response_limit';
          failedAttempt = true;
          break;
        }
        const parsed = responseSchema.safeParse(response.data);
        if (!parsed.success) {
          failure = 'invalid_response';
          failedAttempt = true;
          continue;
        }
        if (!parsed.data.length) {
          validEmpty = true;
          continue;
        }
        for (const [document, distance] of parsed.data) {
          const page =
            typeof document.metadata.page === 'number' &&
            Number.isInteger(document.metadata.page) &&
            document.metadata.page >= 0
              ? (document.metadata.page as number) + 1
              : undefined;
          chunks.push({
            type: 'file',
            fileId: file.file_id,
            fileName:
              file.metadata?.imageRag?.sourceImageFileName ??
              (options.legacyChat ? document.metadata.source?.split('/').pop() : undefined) ??
              file.filename,
            content: document.page_content,
            relevance: 1 - distance,
            distance,
            pages: page ? [page] : [],
            pageRelevance: page ? { [page]: 1 - distance } : {},
            metadata: file.metadata?.imageRag
              ? {
                  imageRag: {
                    kind: file.metadata.imageRag.kind,
                    status: file.metadata.imageRag.status,
                    sourceImageFileName: file.metadata.imageRag.sourceImageFileName,
                    derivedTextFileId: file.file_id,
                  },
                }
              : undefined,
          });
        }
        return;
      } catch (error) {
        failedAttempt = true;
        failure = 'unavailable';
        if (
          controller.signal.aborted ||
          (axios.isAxiosError(error) && error.code === 'ECONNABORTED')
        ) {
          failure = abortFailure ?? (signal?.aborted ? 'cancelled' : 'timeout');
        } else if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) {
          failure = 'rag_auth';
        }
        if (failure === 'rag_auth') {
          break;
        }
      }
    }
    if (!validEmpty || failedAttempt || failure === 'timeout' || failure === 'cancelled') {
      result.failures.push({ fileId: file.file_id, code: failure });
    }
  };
  try {
    await Promise.all(
      Array.from({ length: Math.min(files.length, FILE_SEARCH_LIMITS.concurrency) }, async () => {
        while (cursor < files.length) {
          await queryFile(files[cursor++]);
        }
      }),
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  result.sources = chunks
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10)
    .map(({ distance: _distance, ...source }) => source);
  result.status = result.sources.length ? 'success' : 'empty';
  if (result.failures.length) {
    result.status = result.sources.length ? 'partial' : 'failed';
  }
  return result;
}
