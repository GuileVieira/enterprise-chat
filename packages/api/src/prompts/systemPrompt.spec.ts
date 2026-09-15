import { GLOBAL_SYSTEM_PROMPT, withSystemPrompt } from './systemPrompt';

describe('withSystemPrompt', () => {
  it('always supplies the fixed system prefix, including when the old flag is false', () => {
    const previous = process.env.HUMANIZATION_ENABLED;
    process.env.HUMANIZATION_ENABLED = 'false';
    try {
      expect(withSystemPrompt()).toBe(GLOBAL_SYSTEM_PROMPT);
      expect(withSystemPrompt('')).toBe(GLOBAL_SYSTEM_PROMPT);
    } finally {
      if (previous === undefined) delete process.env.HUMANIZATION_ENABLED;
      else process.env.HUMANIZATION_ENABLED = previous;
    }
  });

  it('preserves the original instructions and never duplicates the prefix', () => {
    const instructions = 'Return only JSON: {"id":"123"}';
    const result = withSystemPrompt(instructions);
    expect(result).toBe(`${GLOBAL_SYSTEM_PROMPT}\n\n${instructions}`);
    expect(withSystemPrompt(result)).toBe(result);
  });
});
