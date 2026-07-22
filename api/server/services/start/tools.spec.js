const fs = require('fs');

jest.mock('fs', () => ({
  readdirSync: jest.fn(),
}));

jest.mock('@librechat/agents', () => ({
  Calculator: class Calculator {
    constructor() {
      this.name = 'calculator';
      this.description = 'Calculator';
      this.schema = { type: 'object', properties: {} };
    }
  },
}));

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@librechat/api', () => ({
  getToolkitKey: jest.fn(() => undefined),
  oaiToolkit: {},
  geminiToolkit: {},
}));

jest.mock('~/app/clients/tools/manifest', () => ({
  toolkits: [],
}));

const { loadAndFormatTools } = require('./tools');

describe('loadAndFormatTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.readdirSync.mockReturnValue([]);
  });

  it('includes the premium image generator when @librechat/api dist has no new toolkit export', () => {
    const tools = loadAndFormatTools({
      directory: '/tools',
      adminIncluded: ['calculator', 'openrouter_gemini_image_gen'],
    });

    expect(tools.calculator).toBeDefined();
    expect(tools.openrouter_gemini_image_gen).toBeDefined();
  });
});
