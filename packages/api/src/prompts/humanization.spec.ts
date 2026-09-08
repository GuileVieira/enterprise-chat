import { HUMANIZATION_INSTRUCTIONS, withHumanization } from './humanization';

describe('withHumanization', () => {
  it('always supplies the fixed system prefix, including when the old flag is false', () => {
    const previous = process.env.HUMANIZATION_ENABLED;
    process.env.HUMANIZATION_ENABLED = 'false';
    try {
      expect(withHumanization()).toBe(HUMANIZATION_INSTRUCTIONS);
      expect(withHumanization('')).toBe(HUMANIZATION_INSTRUCTIONS);
    } finally {
      if (previous === undefined) delete process.env.HUMANIZATION_ENABLED;
      else process.env.HUMANIZATION_ENABLED = previous;
    }
  });

  it('preserves the original instructions and never duplicates the prefix', () => {
    const instructions = 'Return only JSON: {"id":"123"}';
    const result = withHumanization(instructions);
    expect(result).toBe(`${HUMANIZATION_INSTRUCTIONS}\n\n${instructions}`);
    expect(withHumanization(result)).toBe(result);
  });
});
