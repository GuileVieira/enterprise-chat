import { readFileSync } from 'node:fs';
import path from 'node:path';

import { darkTheme } from '../themes/dark';
import applyTheme from './applyTheme';

const styleCss = readFileSync(
  path.resolve(__dirname, '../../../../../client/src/style.css'),
  'utf8',
);
const darkCss = styleCss.match(/\.dark \{([\s\S]*?)\n\}/)?.[1];

const hslKeys = new Set([
  'background',
  'foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'card',
  'card-foreground',
]);

const cssVariable = (name: string) =>
  darkCss?.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim() ??
  styleCss.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();

const cssColorToRgb = (value: string) => {
  const resolved = value.startsWith('var(') ? cssVariable(value.slice(4, -1)) : value;
  if (!resolved?.startsWith('#')) return resolved;
  const hex = resolved.slice(1);
  return `rgb(${parseInt(hex.slice(0, 2), 16)} ${parseInt(hex.slice(2, 4), 16)} ${parseInt(hex.slice(4, 6), 16)})`;
};

describe('applyTheme', () => {
  beforeEach(() => document.documentElement.removeAttribute('style'));

  it('keeps Tailwind utility variables in HSL channel format', () => {
    applyTheme({
      'rgb-background': '25 24 21',
      'rgb-primary': '120 132 99',
      'rgb-text-primary': '244 241 232',
    });

    expect(document.documentElement.style.getPropertyValue('--background')).toBe('45 8.7% 9.02%');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe(
      '81.82 14.29% 45.29%',
    );
    expect(document.documentElement.style.getPropertyValue('--text-primary')).toBe(
      'rgb(244 241 232)',
    );
  });

  it('keeps static dark CSS aligned with darkTheme RGB tokens', () => {
    expect(darkCss).toBeDefined();

    applyTheme(darkTheme);

    for (const [rgbKey] of Object.entries(darkTheme)) {
      const cssName = `--${rgbKey.slice(4)}`;
      const cssValue = cssVariable(cssName);
      const appliedValue = document.documentElement.style.getPropertyValue(cssName);
      expect(cssValue).toBeDefined();
      expect(appliedValue).not.toBe('');
      if (hslKeys.has(rgbKey.slice(4))) expect(appliedValue).toBe(cssValue);
      else expect(appliedValue).toBe(cssColorToRgb(cssValue as string));
    }
  });
});
