const { createRunBody } = require('./createRunBody');
const { withHumanization } = require('@librechat/api');

describe('createRunBody', () => {
  const baseOptions = {
    assistant_id: 'asst_123',
    model: 'gpt-4',
  };

  it('should create basic run body', () => {
    const body = createRunBody(baseOptions);
    expect(body).toEqual({
      assistant_id: 'asst_123',
      model: 'gpt-4',
      additional_instructions: withHumanization(),
    });
  });

  it('should include promptPrefix in additional_instructions', () => {
    const body = createRunBody({
      ...baseOptions,
      promptPrefix: 'You are a helpful assistant.',
    });
    expect(body.additional_instructions).toBe(withHumanization('You are a helpful assistant.'));
  });

  it('should include projectInstructions before promptPrefix', () => {
    const body = createRunBody({
      ...baseOptions,
      projectInstructions: 'Project context: build a website.',
      promptPrefix: 'You are a helpful assistant.',
    });
    expect(body.additional_instructions).toBe(
      withHumanization('Project context: build a website.You are a helpful assistant.'),
    );
  });

  it('should include only projectInstructions when no promptPrefix', () => {
    const body = createRunBody({
      ...baseOptions,
      projectInstructions: 'Project context: build a website.',
    });
    expect(body.additional_instructions).toBe(
      withHumanization('Project context: build a website.'),
    );
  });

  it('should merge instructions into body.instructions', () => {
    const body = createRunBody({
      ...baseOptions,
      instructions: 'Original assistant instructions.',
    });
    expect(body.instructions).toBe('Original assistant instructions.');
  });

  it('should append artifactsPrompt after promptPrefix', () => {
    const body = createRunBody({
      ...baseOptions,
      promptPrefix: 'Prefix.',
      endpointOption: {
        artifactsPrompt: 'Use artifacts.',
      },
    });
    expect(body.additional_instructions).toBe(withHumanization('Prefix.\nUse artifacts.'));
  });

  it('should prepend projectInstructions before promptPrefix and append artifactsPrompt', () => {
    const body = createRunBody({
      ...baseOptions,
      projectInstructions: 'Project context.',
      promptPrefix: 'Prefix.',
      endpointOption: {
        artifactsPrompt: 'Use artifacts.',
      },
    });
    expect(body.additional_instructions).toBe(
      withHumanization('Project context.Prefix.\nUse artifacts.'),
    );
  });

  it('should include datetime when append_current_datetime is true', () => {
    const body = createRunBody({
      ...baseOptions,
      endpointOption: {
        assistant: { append_current_datetime: true },
      },
      clientTimestamp: '2024-01-15T10:30:00.000Z',
    });
    expect(body.additional_instructions).toContain('Current date and time: 2024-01-15 10:30:00');
  });

  it('should include datetime + projectInstructions + promptPrefix in correct order', () => {
    const body = createRunBody({
      ...baseOptions,
      projectInstructions: 'Project context.',
      promptPrefix: 'Prefix.',
      endpointOption: {
        assistant: { append_current_datetime: true },
      },
      clientTimestamp: '2024-01-15T10:30:00.000Z',
    });
    expect(body.additional_instructions).toBe(
      withHumanization('Current date and time: 2024-01-15 10:30:00\nProject context.Prefix.'),
    );
  });

  it('should include projectMemories after projectInstructions and before promptPrefix', () => {
    const body = createRunBody({
      ...baseOptions,
      projectInstructions: 'Instructions.',
      projectMemories: 'Memories.',
      promptPrefix: 'Prefix.',
    });
    expect(body.additional_instructions).toBe(withHumanization('Instructions.\nMemories.Prefix.'));
  });

  it('should include only projectMemories when no projectInstructions', () => {
    const body = createRunBody({
      ...baseOptions,
      projectMemories: 'Memories.',
    });
    expect(body.additional_instructions).toBe(withHumanization('Memories.'));
  });

  it('should include datetime + instructions + memories + prefix + artifacts in correct order', () => {
    const body = createRunBody({
      ...baseOptions,
      projectInstructions: 'Instructions.',
      projectMemories: 'Memories.',
      promptPrefix: 'Prefix.',
      endpointOption: {
        assistant: { append_current_datetime: true },
        artifactsPrompt: 'Artifacts.',
      },
      clientTimestamp: '2024-01-15T10:30:00.000Z',
    });
    expect(body.additional_instructions).toBe(
      withHumanization(
        'Current date and time: 2024-01-15 10:30:00\nInstructions.\nMemories.Prefix.\nArtifacts.',
      ),
    );
  });
});
