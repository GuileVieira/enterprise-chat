import { Constants, EModelEndpoint } from 'librechat-data-provider';
import { buildAgentSwitchTemplate } from './useSelectAgent';

describe('buildAgentSwitchTemplate', () => {
  it('preserves an existing project conversation when switching agents', () => {
    const template = buildAgentSwitchTemplate({
      template: {
        endpoint: EModelEndpoint.agents,
        agent_id: 'agent-2',
        conversationId: Constants.NEW_CONVO as string,
      },
      conversation: {
        conversationId: 'conversation-1',
        projectId: 'project-1',
      },
    });

    expect(template).toMatchObject({
      endpoint: EModelEndpoint.agents,
      agent_id: 'agent-2',
      conversationId: 'conversation-1',
      projectId: 'project-1',
    });
  });

  it('keeps new conversations new when switching agents', () => {
    const template = buildAgentSwitchTemplate({
      template: {
        endpoint: EModelEndpoint.agents,
        agent_id: 'agent-1',
      },
      conversation: {
        conversationId: Constants.NEW_CONVO as string,
      },
    });

    expect(template.conversationId).toBe(Constants.NEW_CONVO);
    expect(template.projectId).toBeUndefined();
  });

  it('does not treat search as an existing conversation', () => {
    const template = buildAgentSwitchTemplate({
      template: {
        endpoint: EModelEndpoint.agents,
        agent_id: 'agent-1',
      },
      conversation: {
        conversationId: 'search',
        projectId: 'project-1',
      },
    });

    expect(template.conversationId).toBe(Constants.NEW_CONVO);
    expect(template.projectId).toBe('project-1');
  });

  it('does not overwrite an explicit project in the template', () => {
    const template = buildAgentSwitchTemplate({
      template: {
        endpoint: EModelEndpoint.agents,
        agent_id: 'agent-1',
        projectId: 'target-project',
      },
      conversation: {
        conversationId: 'conversation-1',
        projectId: 'current-project',
      },
    });

    expect(template.projectId).toBe('target-project');
  });
});
