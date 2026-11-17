import type { Schema } from '@cfworker/json-schema';

/** Preserve JSON Schema validation semantics; reject unsupported references instead of weakening them. */
export function integrationInputSchema(input: object): Schema {
  const root = input as Schema;
  let nodes = 0;
  const schemaMaps = new Set([
    'properties',
    'patternProperties',
    '$defs',
    'definitions',
    'dependentSchemas',
  ]);
  const schemaChildren = new Set([
    'items',
    'additionalItems',
    'additionalProperties',
    'unevaluatedProperties',
    'unevaluatedItems',
    'contains',
    'not',
    'if',
    'then',
    'else',
    'propertyNames',
  ]);
  const schemaArrays = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);
  const visit = (value: Schema | boolean, depth: number, refs: Set<string>): Schema | boolean => {
    if (++nodes > 5000 || depth > 30) {
      throw new Error('Tool schema exceeds traversal limits');
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid tool schema');
    }
    if (value.$ref) {
      if (!value.$ref.startsWith('#/') || refs.has(value.$ref)) {
        throw new Error('Unsupported tool schema reference');
      }
      let target: unknown = root;
      for (const raw of value.$ref.slice(2).split('/')) {
        const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
        if (
          !target ||
          typeof target !== 'object' ||
          !Object.prototype.hasOwnProperty.call(target, key)
        ) {
          throw new Error('Unresolved tool schema reference');
        }
        target = (target as { [key: string]: unknown })[key];
      }
      visit(target as Schema, depth + 1, new Set([...refs, value.$ref]));
    }
    const next: { [key: string]: unknown } = { ...value };
    for (const [key, child] of Object.entries(value)) {
      if (schemaMaps.has(key) && child && typeof child === 'object' && !Array.isArray(child)) {
        next[key] = Object.fromEntries(
          Object.entries(child).map(([name, definition]) => [
            name,
            visit(definition as Schema, depth + 1, refs),
          ]),
        );
      } else if (schemaChildren.has(key) && child !== undefined) {
        next[key] = Array.isArray(child)
          ? child.map((item) => visit(item, depth + 1, refs))
          : visit(child as Schema, depth + 1, refs);
      } else if (schemaArrays.has(key) && Array.isArray(child)) {
        next[key] = child.map((item) => visit(item, depth + 1, refs));
      }
    }
    return next as Schema;
  };
  return visit(root, 0, new Set()) as Schema;
}
