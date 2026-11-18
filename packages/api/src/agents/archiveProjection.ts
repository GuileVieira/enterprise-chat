import {
  Tools,
  Constants,
  isActionTool,
  actionDelimiter,
  splitMCPToolKey,
  resolveAgentSkillsScope,
} from 'librechat-data-provider';
import type { IAgent } from '@librechat/data-schemas';
import type { AgentArchive } from './archive';

type ArchiveSource = Pick<
  IAgent,
  | 'name'
  | 'description'
  | 'provider'
  | 'model'
  | 'instructions'
  | 'skills'
  | 'skills_enabled'
  | 'skills_scope'
  | 'tools'
  | 'actions'
>;

/** Portable tool references never carry connector hosts, registrations or tenant-function IDs. */
export function projectAgentArchive(
  source: ArchiveSource,
  skills: AgentArchive['skills'],
): AgentArchive {
  if (!source.name || !source.provider || !source.model) {
    throw new Error('Agent requires a name, provider and model before export');
  }
  const tools: AgentArchive['tools'] = [];
  const names = new Set<string>();
  const builtinNames = new Set<string>([Tools.file_search, Tools.web_search, Tools.execute_code]);
  const add = (name: string, kind: AgentArchive['tools'][number]['kind']) => {
    let alias = name;
    for (
      let suffix = 2;
      names.has(alias) || (kind !== 'builtin' && builtinNames.has(alias));
      suffix++
    ) {
      alias = `${name}-${suffix}`;
    }
    names.add(alias);
    tools.push({ name: alias, kind });
  };
  for (const name of new Set(source.tools ?? [])) {
    if (builtinNames.has(name)) {
      add(name, 'builtin');
    } else if (isActionTool(name)) {
      add(name.split(actionDelimiter)[0] || `custom-action-${tools.length + 1}`, 'action');
    } else if (name.includes(Constants.mcp_delimiter)) {
      add(splitMCPToolKey(name)[0] || `custom-mcp-${tools.length + 1}`, 'mcp');
    } else {
      add(`custom-function-${tools.length + 1}`, 'function');
    }
  }
  for (let index = 0; index < (source.actions?.length ?? 0); index++) {
    add(`custom-action-${index + 1}`, 'action');
  }
  return {
    agent: {
      name: source.name,
      description: source.description ?? '',
      provider: source.provider,
      model: source.model,
      skills_enabled: source.skills_enabled === true,
      skills_scope: resolveAgentSkillsScope(
        source.skills,
        source.skills_enabled,
        source.skills_scope,
      ),
    },
    instructions: source.instructions ?? '',
    skills,
    tools,
  };
}
