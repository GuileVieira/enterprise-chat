import { Constants, isParamEndpoint } from 'librechat-data-provider';
import type { TConversation, TPreset } from 'librechat-data-provider';

export function prepareNewConvoTemplate({
  template,
  preset,
}: {
  template: Partial<TConversation>;
  preset?: Partial<TPreset>;
}): Partial<TConversation> {
  const presetProjectId = (preset as Partial<TConversation> | undefined)?.projectId;
  const projectId = template.projectId ?? presetProjectId;
  const templateConvoId = template.conversationId ?? '';
  const paramEndpoint =
    isParamEndpoint(template.endpoint ?? '', template.endpointType ?? '') === true ||
    isParamEndpoint(preset?.endpoint ?? '', preset?.endpointType ?? '');

  if (paramEndpoint !== true || !templateConvoId || templateConvoId !== Constants.NEW_CONVO) {
    if (projectId && !template.projectId) {
      return {
        ...template,
        projectId,
      };
    }
    return template;
  }

  const nextTemplate: Partial<TConversation> = {
    endpoint: template.endpoint,
  };

  if (template.agent_id) {
    nextTemplate.agent_id = template.agent_id;
  }
  if (template.assistant_id) {
    nextTemplate.assistant_id = template.assistant_id;
  }
  if (template.model) {
    nextTemplate.model = template.model;
  }
  if (template.spec) {
    nextTemplate.spec = template.spec;
  }
  if (template.iconURL) {
    nextTemplate.iconURL = template.iconURL;
  }
  if (template.modelLabel) {
    nextTemplate.modelLabel = template.modelLabel;
  }
  if (projectId) {
    nextTemplate.projectId = projectId;
  }

  return nextTemplate;
}
