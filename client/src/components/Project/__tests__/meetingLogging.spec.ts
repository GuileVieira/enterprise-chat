import logger from '~/utils/logger';
import { logMeetingOperation } from '../meetingLogging';

jest.mock('~/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn() },
}));

describe('meeting browser diagnostics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('projects only safe error fields and excludes payloads and credentials', () => {
    const error = Object.assign(new Error('secret transcript token=secret'), {
      response: { status: 404, data: { audio: 'secret-audio', transcript: 'secret-words' } },
      config: { headers: { Authorization: 'secret-token' } },
    });
    error.stack =
      'Error: secret-message\n at upload (https://secret-host/assets/hooks.hash.js:12:34)\n secret-token';
    logMeetingOperation(
      {
        projectId: 'p',
        meetingId: 'm',
        stage: 'chunk_upload',
        outcome: 'failed',
        attempt: 1,
        chunkIndex: 2629,
      },
      error,
    );
    expect(logger.error).toHaveBeenCalledWith(
      'projectMeetings',
      expect.objectContaining({
        event_name: 'meeting.browser.operation',
        statusCode: 404,
        errorType: 'Error',
        sourceFrames: [{ file: 'hooks.hash.js', line: 12, column: 34 }],
        sourceMapping: 'generated-only',
        projectId: 'p',
        meetingId: 'm',
        chunkIndex: 2629,
        attempt: 1,
      }),
    );
    expect(JSON.stringify((logger.error as jest.Mock).mock.calls)).not.toContain('secret');
  });

  it('does not let logger failure change the recording operation', () => {
    (logger.error as jest.Mock).mockImplementationOnce(() => {
      throw new Error('sink');
    });
    expect(() =>
      logMeetingOperation(
        { projectId: 'p', stage: 'storage', outcome: 'failed' },
        new DOMException('Full', 'QuotaExceededError'),
      ),
    ).not.toThrow();
  });
});
