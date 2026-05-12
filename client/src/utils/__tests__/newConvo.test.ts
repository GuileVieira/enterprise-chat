import { Constants, EModelEndpoint } from 'librechat-data-provider';
import { prepareNewConvoTemplate } from '../newConvo';

describe('prepareNewConvoTemplate', () => {
  it('keeps project and agent identity when starting a new param-endpoint conversation', () => {
    const template = prepareNewConvoTemplate({
      template: {
        endpoint: EModelEndpoint.agents,
        conversationId: Constants.NEW_CONVO as string,
        agent_id: 'agent-1',
        projectId: 'project-1',
      },
      preset: {
        endpoint: EModelEndpoint.agents,
        agent_id: 'agent-1',
      },
    });

    expect(template).toEqual({
      endpoint: EModelEndpoint.agents,
      agent_id: 'agent-1',
      projectId: 'project-1',
    });
  });

  it('keeps agent identity when starting a new param-endpoint conversation without a project', () => {
    const template = prepareNewConvoTemplate({
      template: {
        endpoint: EModelEndpoint.agents,
        conversationId: Constants.NEW_CONVO as string,
        agent_id: 'agent-1',
      },
      preset: {
        endpoint: EModelEndpoint.agents,
        agent_id: 'agent-1',
      },
    });

    expect(template).toEqual({
      endpoint: EModelEndpoint.agents,
      agent_id: 'agent-1',
    });
  });

  it('keeps assistant identity and model when starting a new assistants conversation', () => {
    const template = prepareNewConvoTemplate({
      template: {
        endpoint: EModelEndpoint.assistants,
        conversationId: Constants.NEW_CONVO as string,
        assistant_id: 'assistant-1',
        model: 'gpt-4.1',
        projectId: 'project-1',
      },
      preset: {
        endpoint: EModelEndpoint.assistants,
        assistant_id: 'assistant-1',
        model: 'gpt-4.1',
      },
    });

    expect(template).toEqual({
      endpoint: EModelEndpoint.assistants,
      conversationId: Constants.NEW_CONVO,
      assistant_id: 'assistant-1',
      model: 'gpt-4.1',
      projectId: 'project-1',
    });
  });

  it('does not trim templates for existing conversations', () => {
    const input = {
      endpoint: EModelEndpoint.agents,
      conversationId: 'conversation-1',
      agent_id: 'agent-1',
      projectId: 'project-1',
    };

    expect(
      prepareNewConvoTemplate({
        template: input,
        preset: {
          endpoint: EModelEndpoint.agents,
          agent_id: 'agent-1',
        },
      }),
    ).toBe(input);
  });

  it('copies projectId from preset when the template omits it', () => {
    const template = prepareNewConvoTemplate({
      template: {
        endpoint: EModelEndpoint.agents,
      },
      preset: {
        endpoint: EModelEndpoint.agents,
        projectId: 'project-1',
      } as never,
    });

    expect(template).toEqual({
      endpoint: EModelEndpoint.agents,
      projectId: 'project-1',
    });
  });
});
