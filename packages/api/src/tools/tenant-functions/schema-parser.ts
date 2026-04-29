/**
 * @fileoverview Converts simple input schemas to JSON Schema for LLM consumption.
 *
 * Simple schema format:
 * {
 *   "adAccountId": { "type": "string", "description": "...", "required": true },
 *   "limit": { "type": "number", "description": "...", "default": 10 }
 * }
 */

import type { JsonSchemaType } from '@librechat/agents';

const typeMapping: Record<string, string> = {
  string: 'string',
  number: 'number',
  integer: 'integer',
  boolean: 'boolean',
  array: 'array',
  object: 'object',
};

/**
 * Converts a simple field definition to JSON Schema property.
 */
function convertField(key: string, def: Record<string, unknown>): Record<string, unknown> {
  const property: Record<string, unknown> = {};

  const jsonType = typeMapping[def.type as string] ?? 'string';
  property.type = jsonType;

  if (def.description) {
    property.description = def.description;
  }

  if (def.enum && Array.isArray(def.enum)) {
    property.enum = def.enum;
  }

  if (def.default !== undefined) {
    property.default = def.default;
  }

  if (jsonType === 'array' && def.items) {
    property.items = convertField(`${key}_item`, def.items as Record<string, unknown>);
  }

  if (jsonType === 'object' && def.properties) {
    property.properties = convertSchema(def.properties as Record<string, Record<string, unknown>>);
  }

  return property;
}

/**
 * Converts a simple schema object to JSON Schema.
 */
export function convertSchema(
  simpleSchema: Record<string, Record<string, unknown>>,
): { type: 'object'; properties: Record<string, unknown>; required: string[] } {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, def] of Object.entries(simpleSchema)) {
    properties[key] = convertField(key, def);
    if (def.required === true) {
      required.push(key);
    }
  }

  return { type: 'object', properties, required };
}

/**
 * Converts a simple input schema to the JsonSchemaType expected by the agent runtime.
 */
export function convertToJsonSchema(
  simpleSchema: Record<string, unknown>,
): JsonSchemaType {
  return convertSchema(simpleSchema as Record<string, Record<string, unknown>>) as JsonSchemaType;
}
