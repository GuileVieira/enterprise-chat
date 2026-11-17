import { validate } from '@cfworker/json-schema';
import type { Schema } from '@cfworker/json-schema';
import { integrationInputSchema } from './schema';
it('strict nested JSON schema retains required, enum, integer, array and reference validation', () => {
  const schema = integrationInputSchema({
    type: 'object',
    properties: { payload: { $ref: '#/$defs/payload' } },
    required: ['payload'],
    additionalProperties: false,
    $defs: {
      payload: {
        type: 'object',
        properties: {
          count: { type: 'integer' },
          state: { enum: ['active', 'paused'] },
          rows: { type: 'array', items: { type: 'integer' } },
        },
        required: ['count'],
        additionalProperties: false,
      },
    },
  });
  expect(validate({ payload: { count: 1, state: 'active', rows: [1] } }, schema).valid).toBe(true);
  for (const payload of [
    { count: 1, extra: true },
    { count: 1.2 },
    { state: 'active' },
    { count: 1, state: 'other' },
    { count: 1, rows: ['1'] },
  ]) {
    expect(validate({ payload }, schema).valid).toBe(false);
  }
});
const additionalPropertyRules: Array<Schema['additionalProperties']> = [
  undefined,
  true,
  false,
  { type: 'string' },
];
it.each(additionalPropertyRules)(
  'preserves declared additionalProperties semantics: %j',
  (additionalProperties) => {
    const original: Schema = {
      type: 'object',
      properties: { a: { type: 'string' } },
      ...(additionalProperties === undefined ? {} : { additionalProperties }),
    };
    const normalized = integrationInputSchema(original);
    expect(normalized).toEqual(original);
    for (const input of [{ a: 'x' }, { a: 'x', extra: 'y' }, { a: 'x', extra: 1 }]) {
      expect(validate(input, normalized).valid).toBe(validate(input, original).valid);
    }
  },
);
it('preserves composed object validation, including nested references and sibling properties', () => {
  const composed: Schema = {
    type: 'object',
    properties: { label: { type: 'string' } },
    allOf: [
      { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
      { type: 'object', properties: { b: { type: 'string' } }, required: ['b'] },
    ],
  };
  const original: Schema = {
    type: 'object',
    properties: { payload: { $ref: '#/$defs/composed' } },
    required: ['payload'],
    $defs: { composed },
  };
  for (const schema of [composed, original]) {
    const normalized = integrationInputSchema(schema);
    for (const payload of [
      { a: 'x', b: 'y' },
      { a: 'x', b: 'y', label: 'test', extra: true },
      { a: 'x' },
      { a: 1, b: 'y' },
    ]) {
      const input = schema === original ? { payload } : payload;
      expect(validate(input, normalized).valid).toBe(validate(input, schema).valid);
    }
  }
});
it('unknown/cyclic/external references never weaken to an unconstrained object', () => {
  for (const schema of [
    { type: 'object', properties: { payload: { $ref: '#/$defs/missing' } } },
    {
      type: 'object',
      $defs: { cyclic: { $ref: '#/$defs/cyclic' } },
      properties: { payload: { $ref: '#/$defs/cyclic' } },
    },
    { type: 'object', properties: { payload: { $ref: 'https://external.test/schema' } } },
  ]) {
    expect(() => integrationInputSchema(schema)).toThrow();
  }
});
it('deep/large schemas stop at explicit traversal bound', () => {
  let schema: object = { type: 'string' };
  for (let i = 0; i < 35; i++) {
    schema = { type: 'array', items: schema };
  }
  expect(() => integrationInputSchema(schema)).toThrow('traversal limits');
});
