import { convertSchema, convertToJsonSchema } from './schema-parser';

describe('schema-parser', () => {
  describe('convertSchema', () => {
    it('converts a simple string field', () => {
      const result = convertSchema({
        name: { type: 'string', description: 'User name' },
      });
      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string', description: 'User name' },
        },
        required: [],
      });
    });

    it('marks required fields', () => {
      const result = convertSchema({
        id: { type: 'string', required: true },
        status: { type: 'string' },
      });
      expect(result.required).toEqual(['id']);
    });

    it('converts number and boolean fields', () => {
      const result = convertSchema({
        count: { type: 'number', description: 'Item count' },
        active: { type: 'boolean' },
      });
      expect(result.properties).toEqual({
        count: { type: 'number', description: 'Item count' },
        active: { type: 'boolean' },
      });
    });

    it('handles enums', () => {
      const result = convertSchema({
        status: { type: 'string', enum: ['active', 'inactive'] },
      });
      expect(result.properties.status).toEqual({
        type: 'string',
        enum: ['active', 'inactive'],
      });
    });

    it('handles defaults', () => {
      const result = convertSchema({
        limit: { type: 'number', default: 10 },
      });
      expect(result.properties.limit).toEqual({
        type: 'number',
        default: 10,
      });
    });
  });

  describe('convertToJsonSchema', () => {
    it('returns a valid JSON schema object', () => {
      const result = convertToJsonSchema({
        query: { type: 'string', description: 'Search query', required: true },
      });
      expect(result.type).toBe('object');
      expect(result.properties.query).toBeDefined();
      expect(result.required).toContain('query');
    });
  });
});
