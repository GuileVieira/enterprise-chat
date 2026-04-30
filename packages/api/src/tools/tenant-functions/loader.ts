/**
 * @fileoverview Loads tenant function definitions for the agent runtime.
 */

import type { JsonSchemaType } from '@librechat/agents';
import type { TenantFunctionMethods } from '@librechat/data-schemas';
import { convertToJsonSchema } from './schema-parser';
import type { TenantFunctionDefinition } from './types';

export interface TenantFunctionLoaderDeps {
  getTenantFunctions: TenantFunctionMethods['getTenantFunctions'];
}

/**
 * Loads tenant function definitions matching the requested tool names.
 */
export async function getTenantFunctionDefinitions(
  deps: TenantFunctionLoaderDeps,
  tenantId: string,
  toolNames: string[],
): Promise<TenantFunctionDefinition[]> {
  const functions = await deps.getTenantFunctions({ tenantId, isActive: true });
  const toolNameSet = new Set(toolNames);

  const definitions: TenantFunctionDefinition[] = [];

  for (const fn of functions) {
    if (!toolNameSet.has(fn.id)) {
      continue;
    }

    const parameters = convertToJsonSchema(fn.inputSchema);

    const fullDescription = fn.details
      ? `${fn.description}\n\nDetails:\n${fn.details}`
      : fn.description;

    definitions.push({
      name: fn.id,
      description: fullDescription,
      parameters,
    });
  }

  return definitions;
}
