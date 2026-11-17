import axios from 'axios';
import { searchFiles, FILE_SEARCH_LIMITS } from './search';
import type { SearchFile } from './search';

jest.mock('axios');
const post = jest.mocked(axios.post);
const chunk = (content: string, distance = 0.2, page = 0) => [
  { page_content: content, metadata: { source: '/private/storage/a.pdf', page } },
  distance,
];
const file: SearchFile = { file_id: 'file-a', filename: 'a.pdf', fromAgent: true };
beforeEach(() => {
  post.mockReset();
});
it('keeps scope immutable, agent-first fallback, scores and one-based pages', async () => {
  post
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: [chunk('found', 0.1, 2)] });
  const result = await searchFiles({
    userId: 'owner',
    token: 'server-token',
    files: Object.freeze([Object.freeze(file)]),
    entityId: 'agent-a',
    query: 'find text',
  });
  expect(post.mock.calls.map((call) => call[1])).toEqual([
    { file_id: 'file-a', entity_id: 'agent-a', query: 'find text', k: 5 },
    { file_id: 'file-a', query: 'find text', k: 5 },
  ]);
  expect(result.sources[0]).toMatchObject({ relevance: 0.9, pages: [3], fileName: 'a.pdf' });
  expect(JSON.stringify(result)).not.toContain('/private');
});
it('empty response never asserts absent index', async () => {
  post.mockResolvedValue({ data: [] });
  const result = await searchFiles({ userId: 'u', token: 't', files: [file], query: 'empty' });
  expect(result).toMatchObject({ status: 'empty', indexStatus: 'index_status_unknown' });
});
it('auth failures after empty fallback are explicit', async () => {
  post.mockResolvedValueOnce({ data: [] }).mockRejectedValueOnce(new Error('network'));
  const result = await searchFiles({
    userId: 'u',
    token: 't',
    files: [file],
    entityId: 'agent',
    query: 'empty',
  });
  expect(result.status).toBe('failed');
  expect(result.failures).toEqual([{ fileId: 'file-a', code: 'unavailable' }]);
});
it('bounded scope rejects before network and strict arguments reject extras', async () => {
  await expect(
    searchFiles({
      userId: 'u',
      token: 't',
      files: Array.from({ length: 51 }, (_, i) => ({ ...file, file_id: `${i}` })),
      query: 'query',
    }),
  ).rejects.toThrow('50 files');
  expect(post).not.toHaveBeenCalled();
});
it('top ten globally and max five concurrent file queries', async () => {
  let active = 0;
  let peak = 0;
  post.mockImplementation(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    return { data: Array.from({ length: 5 }, (_, i) => chunk(`chunk-${i}`, i / 10)) };
  });
  const result = await searchFiles({
    userId: 'u',
    token: 't',
    files: Array.from({ length: 8 }, (_, i) => ({ ...file, file_id: `${i}` })),
    query: 'query',
  });
  expect(peak).toBe(FILE_SEARCH_LIMITS.concurrency);
  expect(result.sources).toHaveLength(10);
  expect(result.sources.map((source) => source.relevance)).toEqual(
    [...result.sources.map((source) => source.relevance)].sort((a, b) => b - a),
  );
});
it('partial success preserves good sources; cancellation skips provider', async () => {
  post.mockImplementation(async (_url, body) =>
    (body as { file_id: string }).file_id === 'file-a'
      ? { data: [chunk('good')] }
      : Promise.reject(new Error('down')),
  );
  const result = await searchFiles({
    userId: 'u',
    token: 't',
    files: [file, { ...file, file_id: 'file-b' }],
    query: 'query',
  });
  expect(result.status).toBe('partial');
  const controller = new AbortController();
  controller.abort();
  const cancelled = await searchFiles({
    userId: 'u',
    token: 't',
    files: [file],
    query: 'query',
    signal: controller.signal,
  });
  expect(cancelled.failures[0].code).toBe('cancelled');
});
it('query/envelope fields stay strict; no-files makes no provider request', async () => {
  const { fileSearchArguments } = await import('./search');
  for (const extra of ['entity_id', 'file_ids', 'projectFileIds', 'resourceFiles', 'url', 'k']) {
    expect(fileSearchArguments.safeParse({ query: 'q', [extra]: 'attacker' }).success).toBe(false);
  }
  expect(fileSearchArguments.safeParse({ query: 'x'.repeat(4001) }).success).toBe(false);
  const result = await searchFiles({ userId: 'u', token: 't', files: [], query: 'q' });
  expect(result.status).toBe('no_files');
  expect(post).not.toHaveBeenCalled();
});
it('RAG authentication errors are provider failures, never client credentials or absent-index inference', async () => {
  post.mockRejectedValue({ isAxiosError: true, response: { status: 401 } });
  jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
  const result = await searchFiles({ userId: 'u', token: 't', files: [file], query: 'q' });
  expect(result).toMatchObject({
    status: 'failed',
    indexStatus: 'index_status_unknown',
    failures: [{ code: 'rag_auth' }],
  });
});
it('project precedes agent; duplicate ownership queries eliminated', async () => {
  post.mockResolvedValue({ data: [] });
  await searchFiles({
    userId: 'u',
    token: 't',
    files: [{ ...file, fromAgent: false, projectId: 'project' }],
    entityId: 'agent',
    query: 'q',
  });
  expect(post.mock.calls.map((call) => call[1])).toEqual([
    { file_id: 'file-a', entity_id: 'project', query: 'q', k: 5 },
    { file_id: 'file-a', query: 'q', k: 5 },
  ]);
});
it('fallbacks share total deadline instead of getting a new timeout each', async () => {
  jest.useFakeTimers();
  post.mockImplementation(
    async (_url, _body, config) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve({ data: [] }), 20000);
        config?.signal?.addEventListener?.(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new Error('aborted'));
          },
          { once: true },
        );
      }),
  );
  const running = searchFiles({
    userId: 'u',
    token: 't',
    files: [{ ...file, projectId: 'project' }],
    entityId: 'agent',
    query: 'q',
  });
  await jest.advanceTimersByTimeAsync(30000);
  const result = await running;
  expect(result.failures).toEqual([{ fileId: 'file-a', code: 'timeout' }]);
  expect(post.mock.calls.map((call) => call[2]?.timeout)).toEqual([30000, 10000]);
  jest.useRealTimers();
});
it('response limit and malformed chunks stay explicit', async () => {
  post.mockResolvedValue({ data: [chunk('x'.repeat(FILE_SEARCH_LIMITS.bytes + 1))] });
  const tooLarge = await searchFiles({
    userId: 'u',
    token: 't',
    files: [file, { ...file, file_id: 'file-b' }],
    query: 'q',
  });
  expect(tooLarge.failures.every((failure) => failure.code === 'response_limit')).toBe(true);
  post.mockResolvedValue({ data: [['malformed', 0.3]] });
  const malformed = await searchFiles({ userId: 'u', token: 't', files: [file], query: 'q' });
  expect(malformed.failures[0].code).toBe('invalid_response');
});
it('legacy chat preserves accepted large scope/query while shared transport limits remain', async () => {
  post.mockResolvedValue({ data: [] });
  const result = await searchFiles({
    userId: 'u',
    token: 't',
    legacyChat: true,
    files: Array.from({ length: 51 }, (_, i) => ({ ...file, file_id: `legacy-${i}` })),
    query: 'x'.repeat(4001),
  });
  expect(result.status).toBe('empty');
  expect(post).toHaveBeenCalledTimes(51);
});
