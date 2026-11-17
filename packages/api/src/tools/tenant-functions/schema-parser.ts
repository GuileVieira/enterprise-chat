/**
 * @fileoverview Converts simple input schemas to JSON Schema for LLM consumption.
 *
 * Simple schema format:
 * {
 *   "adAccountId": { "type": "string", "description": "...", "required": true },
 *   "limit": { "type": "number", "description": "...", "default": 10 }
 * }
 */

import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import type { JsonSchemaType } from '@librechat/agents';

const typeMapping: Record<string, string> = {
  string: 'string',
  number: 'number',
  float: 'number',
  integer: 'integer',
  boolean: 'boolean',
  array: 'array',
  object: 'object',
};

/**
 * Converts a simple field definition to JSON Schema property.
 */
function convertField(
  key: string,
  def: Record<string, unknown>,
  strict: boolean,
): Record<string, unknown> {
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
    property.items = convertField(`${key}_item`, def.items as Record<string, unknown>, strict);
  }

  if (jsonType === 'object' && def.properties) {
    const nestedSchema = convertSchema(
      def.properties as Record<string, Record<string, unknown>>,
      strict,
    );
    property.properties = nestedSchema.properties;
    if (strict) {
      property.additionalProperties = false;
    }
    if (nestedSchema.required.length > 0) {
      property.required = nestedSchema.required;
    }
  }

  return property;
}

/**
 * Converts a simple schema object to JSON Schema.
 */
export function convertSchema(
  simpleSchema: Record<string, Record<string, unknown>>,
  strict = false,
): {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties?: false;
} {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, def] of Object.entries(simpleSchema)) {
    properties[key] = convertField(key, def, strict);
    if (def.required === true && def.default === undefined) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required,
    ...(strict ? { additionalProperties: false as const } : {}),
  };
}

/**
 * Converts a simple input schema to the JsonSchemaType expected by the agent runtime.
 */
export function convertToJsonSchema(
  simpleSchema: Record<string, unknown>,
  strict = false,
): JsonSchemaType {
  return convertSchema(
    simpleSchema as Record<string, Record<string, unknown>>,
    strict,
  ) as JsonSchemaType;
}

/** Shared validator for chat and integrations; unknown fields never reach upstream. */
export function buildTenantFunctionZodSchema(
  simpleSchema: Record<string, unknown>,
  strict = false,
): z.ZodObject<z.ZodRawShape> {
  const buildField = (input: unknown): z.ZodType<unknown> => {
    const def = fieldSchema.parse(input);
    let validator: z.ZodType<unknown>;
    switch (def.type) {
      case 'string':
        validator = z.string();
        break;
      case 'number':
      case 'float':
        validator = z.number().finite();
        break;
      case 'integer':
        validator = z.number().int();
        break;
      case 'boolean':
        validator = z.boolean();
        break;
      case 'array':
        validator = z.array(def.items ? buildField(def.items) : z.unknown());
        break;
      case 'object':
        validator = def.properties
          ? buildTenantFunctionZodSchema(def.properties, strict)
          : z.record(z.unknown());
        break;
      default:
        throw new Error('Unsupported tenant function field type');
    }
    if (def.enum?.length) {
      validator = validator.refine(
        (value) => def.enum!.some((item) => isDeepStrictEqual(item, value)),
        'Value outside enum',
      );
    }
    if (def.description) {
      validator = validator.describe(def.description);
    }
    if (def.default !== undefined) {
      validator = validator.default(validator.parse(def.default));
    } else if (!def.required) {
      validator = validator.optional();
    }
    return validator;
  };
  const shape: z.ZodRawShape = {};
  for (const [key, value] of Object.entries(simpleSchema)) {
    shape[key] = buildField(value);
  }
  return strict ? z.object(shape).strict() : z.object(shape);
}

interface TenantFieldDefinition {
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  items?: unknown;
  properties?: Record<string, unknown>;
}
const fieldSchema: z.ZodType<TenantFieldDefinition> = z.object({
  type: z.enum(['string', 'number', 'float', 'integer', 'boolean', 'array', 'object']),
  description: z.string().optional(),
  required: z.boolean().optional(),
  default: z.unknown().optional(),
  enum: z.array(z.unknown()).optional(),
  items: z.unknown().optional(),
  properties: z.record(z.unknown()).optional(),
});
