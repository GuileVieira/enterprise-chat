/**
 * Helper function to create a color value that uses CSS variables with alpha support
 * This is a CommonJS version for use in tailwind.config.js
 */
const HSL_VARIABLES = new Set([
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

function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      if (HSL_VARIABLES.has(variableName)) {
        return `hsl(var(${variableName}) / ${opacityValue})`;
      }
      return `color-mix(in srgb, var(${variableName}) calc(${opacityValue} * 100%), transparent)`;
    }
    return HSL_VARIABLES.has(variableName) ? `hsl(var(${variableName}))` : `var(${variableName})`;
  };
}

/**
 * Creates Tailwind color configuration that uses CSS variables
 * This allows dynamic theme switching by changing CSS variable values
 */
function createTailwindColors() {
  return {
    'text-primary': withOpacity('--text-primary'),
    'text-secondary': withOpacity('--text-secondary'),
    'text-secondary-alt': withOpacity('--text-secondary-alt'),
    'text-tertiary': withOpacity('--text-tertiary'),
    'text-warning': withOpacity('--text-warning'),
    'ring-primary': withOpacity('--ring-primary'),
    'header-primary': withOpacity('--header-primary'),
    'header-hover': withOpacity('--header-hover'),
    'header-button-hover': withOpacity('--header-button-hover'),
    'surface-active': withOpacity('--surface-active'),
    'surface-active-alt': withOpacity('--surface-active-alt'),
    'surface-hover': withOpacity('--surface-hover'),
    'surface-hover-alt': withOpacity('--surface-hover-alt'),
    'surface-primary': withOpacity('--surface-primary'),
    'surface-primary-alt': withOpacity('--surface-primary-alt'),
    'surface-primary-contrast': withOpacity('--surface-primary-contrast'),
    'surface-secondary': withOpacity('--surface-secondary'),
    'surface-secondary-alt': withOpacity('--surface-secondary-alt'),
    'surface-tertiary': withOpacity('--surface-tertiary'),
    'surface-tertiary-alt': withOpacity('--surface-tertiary-alt'),
    'surface-dialog': withOpacity('--surface-dialog'),
    'surface-submit': withOpacity('--surface-submit'),
    'surface-submit-hover': withOpacity('--surface-submit-hover'),
    'surface-destructive': withOpacity('--surface-destructive'),
    'surface-destructive-hover': withOpacity('--surface-destructive-hover'),
    'surface-chat': withOpacity('--surface-chat'),
    'border-light': withOpacity('--border-light'),
    'border-medium': withOpacity('--border-medium'),
    'border-medium-alt': withOpacity('--border-medium-alt'),
    'border-heavy': withOpacity('--border-heavy'),
    'border-xheavy': withOpacity('--border-xheavy'),
    'brand-purple': withOpacity('--brand-purple'),
    presentation: withOpacity('--presentation'),
    background: withOpacity('--background'),
    foreground: withOpacity('--foreground'),
    primary: {
      DEFAULT: withOpacity('--primary'),
      foreground: withOpacity('--primary-foreground'),
    },
    secondary: {
      DEFAULT: withOpacity('--secondary'),
      foreground: withOpacity('--secondary-foreground'),
    },
    muted: {
      DEFAULT: withOpacity('--muted'),
      foreground: withOpacity('--muted-foreground'),
    },
    accent: {
      DEFAULT: withOpacity('--accent'),
      foreground: withOpacity('--accent-foreground'),
    },
    destructive: {
      DEFAULT: withOpacity('--surface-destructive'),
      foreground: withOpacity('--destructive-foreground'),
    },
    border: withOpacity('--border'),
    input: withOpacity('--input'),
    ring: withOpacity('--ring'),
    card: {
      DEFAULT: withOpacity('--card'),
      foreground: withOpacity('--card-foreground'),
    },
  };
}

module.exports = { createTailwindColors };
