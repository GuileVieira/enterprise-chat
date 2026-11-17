import { validate } from '@cfworker/json-schema';
import { integrationInputSchema } from './schema';
it('strict nested JSON schema retains required, enum, integer, array and reference validation', () => {
  const schema = integrationInputSchema({
    type: 'object',
    properties: { payload: { $ref: '#/$defs/payload' } },
    required: ['payload'],
    $defs: {
      payload: {
        type: 'object',
        properties: {
          count: { type: 'integer' },
          state: { enum: ['active', 'paused'] },
          rows: { type: 'array', items: { type: 'integer' } },
        },
        required: ['count'],
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
