const DuckDuckGoSearchTool = require('../DuckDuckGoSearch');

describe('DuckDuckGoSearchTool', () => {
  it('ignores legacy arguments and returns at most five normalized results without fetching pages', async () => {
    const searchTool = {
      invoke: jest.fn().mockResolvedValue(
        JSON.stringify(
          Array.from({ length: 7 }, (_, index) => ({
            title: ` Result ${index} `,
            link: `https://example.com/${index}`,
            snippet: ` Snippet ${index} `,
          })),
        ),
      ),
    };
    const tool = new DuckDuckGoSearchTool({ searchTool });

    const output = JSON.parse(
      await tool.invoke({
        query: ' latest docs ',
        fetch_results: true,
        max_content_chars: 99999,
        max_results: 10,
      }),
    );

    expect(DuckDuckGoSearchTool.jsonSchema).toEqual({
      type: 'object',
      properties: {
        query: expect.objectContaining({ type: 'string' }),
      },
      required: ['query'],
    });
    expect(searchTool.invoke).toHaveBeenCalledWith('latest docs');
    expect(output.results).toHaveLength(5);
    expect(output.results[0]).toEqual({
      title: 'Result 0',
      url: 'https://example.com/0',
      snippet: 'Snippet 0',
    });
    expect(JSON.stringify(output)).not.toContain('"fetch"');
  });

  it('rejects an empty query without calling DuckDuckGo', async () => {
    const searchTool = { invoke: jest.fn() };
    const tool = new DuckDuckGoSearchTool({ searchTool });

    await expect(tool._call({ query: ' ' })).resolves.toContain('Query cannot be empty');
    expect(searchTool.invoke).not.toHaveBeenCalled();
  });

  it('returns a structured error when DuckDuckGo blocks the server', async () => {
    const tool = new DuckDuckGoSearchTool({
      searchTool: {
        invoke: jest.fn().mockRejectedValue(new Error('DDG detected an anomaly')),
      },
    });

    await expect(tool._call({ query: 'docs' })).resolves.toBe(
      JSON.stringify({
        ok: false,
        query: 'docs',
        error: 'DDG detected an anomaly',
        retryable: false,
        results: [],
      }),
    );
  });
});
