import { buildTenantFunctionZodSchema, convertToJsonSchema } from './schema-parser';
it('shared tenant schema enforces nested required, enum, integer, arrays, extras and defaults', () => {
  const input = {
    id: { type: 'integer', required: true },
    limit: { type: 'integer', default: 10 },
    state: { type: 'string', enum: ['active', 'paused'] },
    nested: {
      type: 'object',
      required: true,
      properties: { name: { type: 'string', required: true } },
    },
    rows: { type: 'array', items: { type: 'integer' } },
  };
  const validator = buildTenantFunctionZodSchema(input, true);
  expect(validator.parse({ id: 1, nested: { name: 'n' } })).toEqual({
    id: 1,
    limit: 10,
    nested: { name: 'n' },
  });
  for (const value of [
    { id: 1.2, nested: { name: 'n' } },
    { nested: { name: 'n' } },
    { id: 1, state: 'other', nested: { name: 'n' } },
    { id: 1, nested: {} },
    { id: 1, nested: { name: 'n', extra: true } },
    { id: 1, nested: { name: 'n' }, rows: ['1'] },
    { id: 1, nested: { name: 'n' }, extra: true },
  ]) {
    expect(validator.safeParse(value).success).toBe(false);
  }
  expect(convertToJsonSchema(input, true)).toMatchObject({
    additionalProperties: false,
    properties: { nested: { additionalProperties: false }, limit: { default: 10 } },
  });
});

it('preserves chat free-form objects and arrays and strips legacy extras', () => {
  const schema = {
    payload: { type: 'object' },
    rows: { type: 'array' },
    count: { type: 'integer', required: true, default: 2 },
  };
  expect(
    buildTenantFunctionZodSchema(schema).parse({
      payload: { free: 'value' },
      rows: [1, { nested: true }],
      extra: 1,
    }),
  ).toEqual({ payload: { free: 'value' }, rows: [1, { nested: true }], count: 2 });
  expect(convertToJsonSchema(schema).required).not.toContain('count');
});
