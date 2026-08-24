import { isSkillCodeFileBlocked, isSkillCodeImportEnabled } from './import';

describe('skill import code files', () => {
  it('blocks code by default and requires an explicit true value', () => {
    expect(isSkillCodeImportEnabled(undefined)).toBe(false);
    expect(isSkillCodeImportEnabled('false')).toBe(false);
    expect(isSkillCodeImportEnabled('TRUE')).toBe(false);
    expect(isSkillCodeImportEnabled('true')).toBe(true);
  });

  it('blocks source files while preserving instruction and reference files', () => {
    expect(isSkillCodeFileBlocked('scripts/analyze.py', false)).toBe(true);
    expect(isSkillCodeFileBlocked('src/index.ts', false)).toBe(true);
    expect(isSkillCodeFileBlocked('references/guide.md', false)).toBe(false);
    expect(isSkillCodeFileBlocked('assets/report.pdf', false)).toBe(false);
    expect(isSkillCodeFileBlocked('src/index.ts', true)).toBe(false);
  });
});
