import logger from '~/utils/logger';

interface MeetingDiagnostic {
  projectId: string;
  meetingId?: string;
  stage: 'capture' | 'storage' | 'chunk_upload' | 'transcription_submit' | 'resume' | 'discard';
  outcome: 'started' | 'accepted' | 'failed' | 'retrying';
  chunkIndex?: number;
  attempt?: number;
  captureCall?: boolean;
  audioBitsPerSecond?: number;
}

export function logMeetingOperation(context: MeetingDiagnostic, error?: unknown): void {
  const value = error && typeof error === 'object' ? error : undefined;
  const response = value && 'response' in value ? value.response : undefined;
  const status =
    response && typeof response === 'object' && 'status' in response ? response.status : undefined;
  const name =
    value && 'name' in value && typeof value.name === 'string'
      ? value.name.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 80)
      : undefined;
  const stack = value && 'stack' in value && typeof value.stack === 'string' ? value.stack : '';
  const sourceFrames = stack
    .split('\n')
    .slice(1, 9)
    .flatMap((frame) => {
      const source = frame.match(/([^/\\()\s?#]+\.[cm]?[jt]sx?):(\d+):(\d+)/);
      return source
        ? [{ file: source[1].slice(0, 100), line: Number(source[2]), column: Number(source[3]) }]
        : [];
    });
  try {
    const level = context.outcome === 'failed' ? 'error' : 'info';
    logger[level]('projectMeetings', {
      event_name: 'meeting.browser.operation',
      timestamp: new Date().toISOString(),
      ...context,
      statusCode: typeof status === 'number' && Number.isFinite(status) ? status : undefined,
      errorType: name,
      sourceFrames,
      sourceMapping: sourceFrames.length ? 'generated-only' : undefined,
    });
  } catch {
    // Diagnostic failures must not interrupt recording or recovery.
  }
}
