import { IThemeRGB } from '../types';

/**
 * Dark theme — Raycast-inspired palette
 * RGB values in space-separated format for CSS variable injection
 */
export const darkTheme: IThemeRGB = {
  // Text colors
  'rgb-text-primary': '249 249 249', // #f9f9f9
  'rgb-text-secondary': '206 206 206', // #cecece
  'rgb-text-secondary-alt': '156 156 157', // #9c9c9d
  'rgb-text-tertiary': '106 107 108', // #6a6b6c
  'rgb-text-warning': '255 188 51', // #ffbc33

  // Ring colors
  'rgb-ring-primary': '106 107 108', // #6a6b6c

  // Header colors
  'rgb-header-primary': '16 17 17', // #101111
  'rgb-header-hover': '27 28 30', // #1b1c1e
  'rgb-header-button-hover': '16 17 17', // #101111

  // Surface colors
  'rgb-surface-active': '27 28 30', // #1b1c1e
  'rgb-surface-active-alt': '16 17 17', // #101111
  'rgb-surface-hover': '27 28 30', // #1b1c1e
  'rgb-surface-hover-alt': '27 28 30', // #1b1c1e
  'rgb-surface-primary': '7 8 10', // #07080a
  'rgb-surface-primary-alt': '16 17 17', // #101111
  'rgb-surface-primary-contrast': '16 17 17', // #101111
  'rgb-surface-secondary': '16 17 17', // #101111
  'rgb-surface-secondary-alt': '16 17 17', // #101111
  'rgb-surface-tertiary': '27 28 30', // #1b1c1e
  'rgb-surface-tertiary-alt': '27 28 30', // #1b1c1e
  'rgb-surface-dialog': '16 17 17', // #101111
  'rgb-surface-submit': '95 201 146', // #5fc992
  'rgb-surface-submit-hover': '77 166 122', // #4da67a
  'rgb-surface-destructive': '255 99 99', // #FF6363
  'rgb-surface-destructive-hover': '229 90 90', // #e55a5a
  'rgb-surface-chat': '16 17 17', // #101111

  // Border colors
  'rgb-border-light': '37 40 41', // #252829
  'rgb-border-medium': '47 48 49', // #2f3031
  'rgb-border-medium-alt': '47 48 49', // #2f3031
  'rgb-border-heavy': '67 67 69', // #434345
  'rgb-border-xheavy': '106 107 108', // #6a6b6c

  // Brand colors — Raycast Red replaces legacy purple
  'rgb-brand-purple': '255 99 99', // #FF6363

  // Presentation
  'rgb-presentation': '16 17 17', // #101111

  // Utility colors (mapped to Raycast palette)
  'rgb-background': '7 8 10', // #07080a
  'rgb-foreground': '249 249 249', // #f9f9f9
  'rgb-primary': '85 179 255', // #55b3ff (Raycast Blue)
  'rgb-primary-foreground': '7 8 10', // #07080a
  'rgb-secondary': '16 17 17', // #101111
  'rgb-secondary-foreground': '249 249 249', // #f9f9f9
  'rgb-muted': '27 28 30', // #1b1c1e
  'rgb-muted-foreground': '156 156 157', // #9c9c9d
  'rgb-accent': '27 28 30', // #1b1c1e
  'rgb-accent-foreground': '249 249 249', // #f9f9f9
  'rgb-destructive-foreground': '7 8 10', // #07080a
  'rgb-border': '37 40 41', // #252829
  'rgb-input': '37 40 41', // #252829
  'rgb-ring': '85 179 255', // #55b3ff
  'rgb-card': '16 17 17', // #101111
  'rgb-card-foreground': '249 249 249', // #f9f9f9
};
