import { IThemeRGB, IThemeVariables } from '../types';

/**
 * Validates RGB string format (e.g., "255 255 255")
 */
function validateRGB(rgb: string): boolean {
  if (!rgb) return true;
  const rgbRegex = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/;
  const match = rgb.match(rgbRegex);

  if (!match) return false;

  // Check that each value is between 0-255
  const [, r, g, b] = match;
  return [r, g, b].every((val) => {
    const num = parseInt(val, 10);
    return num >= 0 && num <= 255;
  });
}

const HSL_VARIABLES = new Set<string>([
  '--background',
  '--foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive-foreground',
  '--border',
  '--input',
  '--ring',
  '--card',
  '--card-foreground',
]);

function rgbToHsl(rgb: string): string {
  const [red, green, blue] = rgb
    .split(/\s+/)
    .map(Number)
    .map((channel) => channel / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const format = (value: number) => Number(value.toFixed(2));
  if (max === min) return `0 0% ${format(lightness * 100)}%`;
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return `${format(hue * 60)} ${format(saturation * 100)}% ${format(lightness * 100)}%`;
}

/**
 * Maps theme RGB values to CSS variables
 */
function mapTheme(rgb: IThemeRGB): Partial<IThemeVariables> {
  const variables: Partial<IThemeVariables> = {};

  // Map each RGB value to its corresponding CSS variable
  const mappings: Record<keyof IThemeRGB, keyof IThemeVariables> = {
    'rgb-text-primary': '--text-primary',
    'rgb-text-secondary': '--text-secondary',
    'rgb-text-secondary-alt': '--text-secondary-alt',
    'rgb-text-tertiary': '--text-tertiary',
    'rgb-text-warning': '--text-warning',
    'rgb-ring-primary': '--ring-primary',
    'rgb-header-primary': '--header-primary',
    'rgb-header-hover': '--header-hover',
    'rgb-header-button-hover': '--header-button-hover',
    'rgb-surface-active': '--surface-active',
    'rgb-surface-active-alt': '--surface-active-alt',
    'rgb-surface-hover': '--surface-hover',
    'rgb-surface-hover-alt': '--surface-hover-alt',
    'rgb-surface-primary': '--surface-primary',
    'rgb-surface-primary-alt': '--surface-primary-alt',
    'rgb-surface-primary-contrast': '--surface-primary-contrast',
    'rgb-surface-secondary': '--surface-secondary',
    'rgb-surface-secondary-alt': '--surface-secondary-alt',
    'rgb-surface-tertiary': '--surface-tertiary',
    'rgb-surface-tertiary-alt': '--surface-tertiary-alt',
    'rgb-surface-dialog': '--surface-dialog',
    'rgb-surface-submit': '--surface-submit',
    'rgb-surface-submit-hover': '--surface-submit-hover',
    'rgb-surface-destructive': '--surface-destructive',
    'rgb-surface-destructive-hover': '--surface-destructive-hover',
    'rgb-surface-chat': '--surface-chat',
    'rgb-border-light': '--border-light',
    'rgb-border-medium': '--border-medium',
    'rgb-border-medium-alt': '--border-medium-alt',
    'rgb-border-heavy': '--border-heavy',
    'rgb-border-xheavy': '--border-xheavy',
    'rgb-brand-purple': '--brand-purple',
    'rgb-presentation': '--presentation',

    // Utility colors
    'rgb-background': '--background',
    'rgb-foreground': '--foreground',
    'rgb-primary': '--primary',
    'rgb-primary-foreground': '--primary-foreground',
    'rgb-secondary': '--secondary',
    'rgb-secondary-foreground': '--secondary-foreground',
    'rgb-muted': '--muted',
    'rgb-muted-foreground': '--muted-foreground',
    'rgb-accent': '--accent',
    'rgb-accent-foreground': '--accent-foreground',
    'rgb-destructive-foreground': '--destructive-foreground',
    'rgb-border': '--border',
    'rgb-input': '--input',
    'rgb-ring': '--ring',
    'rgb-card': '--card',
    'rgb-card-foreground': '--card-foreground',
  };

  Object.entries(mappings).forEach(([rgbKey, cssVar]) => {
    const value = rgb[rgbKey as keyof IThemeRGB];
    if (value) {
      variables[cssVar] = value;
    }
  });

  return variables;
}

/**
 * Applies theme to the document root
 * Sets CSS variables as rgb() values for compatibility with existing CSS
 */
export default function applyTheme(themeRGB?: IThemeRGB) {
  if (!themeRGB) return;

  const themeObject = mapTheme(themeRGB);
  const root = document.documentElement;

  Object.entries(themeObject).forEach(([cssVar, value]) => {
    if (!value) return;

    const validation = validateRGB(value);
    if (!validation) {
      console.error(`Invalid RGB value for ${cssVar}: ${value}`);
      return;
    }

    root.style.setProperty(cssVar, HSL_VARIABLES.has(cssVar) ? rgbToHsl(value) : `rgb(${value})`);
  });
}
