import { runSafeFunction } from './safe-function';

describe('safe-function', () => {
  it('returns data unchanged when code is empty', async () => {
    const result = await runSafeFunction('', { foo: 'bar' });
    expect(result).toEqual({ foo: 'bar' });
  });

  it('executes a simple transform function', async () => {
    const result = await runSafeFunction(
      '(data) => data.map((x) => x * 2)',
      [1, 2, 3],
    );
    expect(result).toEqual([2, 4, 6]);
  });

  it('executes an arrow function returning an object', async () => {
    const result = await runSafeFunction(
      '(data) => ({ id: data.id, name: data.name.toUpperCase() })',
      { id: 1, name: 'test' },
    );
    expect(result).toEqual({ id: 1, name: 'TEST' });
  });

  it('throws when code does not evaluate to a function', async () => {
    await expect(runSafeFunction('42', {})).rejects.toThrow(
      'postProcess code did not evaluate to a function',
    );
  });

  it('throws on syntax errors in code', async () => {
    await expect(runSafeFunction('=> broken', {})).rejects.toThrow();
  });

  it('times out on slow async operations', async () => {
    const code = '(data) => new Promise((resolve) => setTimeout(resolve, 5000))';
    await expect(runSafeFunction(code, {}, 100)).rejects.toThrow('timed out');
  });
});
