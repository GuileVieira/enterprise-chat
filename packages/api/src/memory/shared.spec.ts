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

  it('accepts spreadsheet BOM and quoted CRLF rows without changing embedded newlines', () => {
    expect(parseMemoryCsv('\uFEFF"key","value"\r\n"tone","Olá\r\ntime"\r\n')).toEqual([
      { ref: 'row_2', key: 'tone', value: 'Olá\r\ntime' },
    ]);
    expect(() => parseMemoryCsv('key,value,extra\na,b')).toThrow('header');
  });

  it('neutralizes spreadsheet formulas without changing JSON content', () => {
    expect(escapeMemoryCsvCell('=cmd()')).toBe('"\'=cmd()"');
    expect(escapeMemoryCsvCell('\t=cmd()')).toBe('"\'\t=cmd()"');
    expect(escapeMemoryCsvCell('  +cmd()')).toBe('"\'  +cmd()"');
    expect(escapeMemoryCsvCell('Olá, time')).toBe('"Olá, time"');
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
    [
      {
        format: 'json',
        content:
          '{"format":"orqest-memories","version":1,"items":[{"ref":{},"key":"a","value":"b"}]}',
      },
      'Invalid import ref',
    ],
  ])('handles malformed import safely', (request, error) => {
    if (error) expect(() => parseMemoryImport(request)).toThrow(error);
    else expect(parseMemoryImport(request)[0]).toEqual({ ref: 'item_1', key: '', value: '' });
  });
});
