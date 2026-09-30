import {
  classifyMemoryImport,
  escapeMemoryCsvCell,
  parseMemoryCsv,
  parseMemoryImport,
} from './shared';

describe('shared memory portability', () => {
  it('parses quoted CSV with commas, quotes, newlines, and unicode', () => {
    expect(parseMemoryCsv('key,value\ntom,"Olá, ""time""\nsegunda linha"')).toEqual([
      { ref: 'row_2', key: 'tom', value: 'Olá, "time"\nsegunda linha' },
    ]);
  });

  it('rejects duplicate package keys and classifies content conflicts', () => {
    const items = parseMemoryImport({
      format: 'json',
      content: JSON.stringify({
        format: 'orqest-memories',
        version: 1,
        items: [
          { ref: 'a', key: 'tone', value: 'new' },
          { ref: 'b', key: 'tone', value: 'again' },
        ],
      }),
    });
    const result = classifyMemoryImport(
      items,
      new Map([
        [
          'tone',
          { id: '1', key: 'tone', value: 'old', tokenCount: 1, version: 2, updatedAt: 'now' },
        ],
      ]),
    );
    expect(result.map((item) => item.status)).toEqual(['conflict', 'invalid']);
  });

  it('neutralizes spreadsheet formulas without changing JSON content', () => {
    expect(escapeMemoryCsvCell('=cmd()')).toBe('"\'=cmd()"');
  });

  it.each([
    [
      { format: 'json', content: '{"format":"orqest-memories","version":1,"items":[null]}' },
      undefined,
    ],
    [
      {
        format: 'json',
        content:
          '{"format":"orqest-memories","version":1,"items":[{"ref":"x","key":"a","value":"1"},{"ref":"x","key":"b","value":"2"}]}',
      },
      'Duplicate import ref',
    ],
    [{ format: 'csv', content: 'key,value\na,"broken"tail' }, 'characters after'],
    [{ format: 'csv', content: 'key,value\na,b,extra' }, 'must contain'],
  ])('handles malformed import safely', (request, error) => {
    if (error) expect(() => parseMemoryImport(request)).toThrow(error);
    else expect(parseMemoryImport(request)[0]).toEqual({ ref: 'item_1', key: '', value: '' });
  });
});
