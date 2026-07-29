import type { TSubmission } from './types';
import createPayload from './createPayload';
import { EModelEndpoint } from './schemas';

const messageId = '00000000-0000-0000-0000-000000000001';
const parentMessageId = '00000000-0000-0000-0000-000000000000';

describe('createPayload', () => {
  const createSubmission = (projectId?: string): TSubmission =>
    ({
      messages: [],
      isTemporary: false,
      conversation: {
        projectId,
        conversationId: null,
        endpoint: EModelEndpoint.agents,
      },
      endpointOption: {
        endpoint: EModelEndpoint.agents,
        model: 'test-model',
      },
      userMessage: {
        text: 'resume o anexo',
        messageId,
        parentMessageId,
        conversationId: null,
        isCreatedByUser: true,
      },
    }) as unknown as TSubmission;

  it('includes the active project id in the request payload', () => {
    const { payload } = createPayload(createSubmission('project-123'));

    expect(payload.projectId).toBe('project-123');
  });

  it('clears stale project ids when the conversation has no active project', () => {
    const submission = createSubmission();
    (submission.endpointOption as typeof submission.endpointOption & { projectId?: string }).projectId =
      'stale-project';

    const { payload } = createPayload(submission);

    expect(payload.projectId).toBeUndefined();
  });
});
