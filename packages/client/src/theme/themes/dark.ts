import { IThemeRGB } from '../types';

/**
 * Dark theme
 * RGB values extracted from the existing dark mode CSS variables
 */
export const darkTheme: IThemeRGB = {
  // Text colors
  'rgb-text-primary': '241 241 241', // #f1f1f1
  'rgb-text-secondary': '200 200 200', // #c8c8c8
  'rgb-text-secondary-alt': '168 168 168', // #a8a8a8
  'rgb-text-tertiary': '160 160 160', // #a0a0a0
  'rgb-text-warning': '211 154 53', // #d39a35

  // Ring colors (not defined in dark mode, using default)
  'rgb-ring-primary': '145 163 122', // #91a37a

  // Header colors
  'rgb-header-primary': '28 28 28', // #1c1c1c
  'rgb-header-hover': '40 40 40', // #282828
  'rgb-header-button-hover': '48 48 48', // #303030

  // Surface colors
  'rgb-surface-active': '64 64 64', // #404040
  'rgb-surface-active-alt': '48 48 48', // #303030
  'rgb-surface-hover': '40 40 40', // #282828
  'rgb-surface-hover-alt': '56 56 56', // #383838
  'rgb-surface-primary': '20 20 20', // #141414
  'rgb-surface-primary-alt': '28 28 28', // #1c1c1c
  'rgb-surface-primary-contrast': '36 36 36', // #242424
  'rgb-surface-secondary': '32 32 32', // #202020
  'rgb-surface-secondary-alt': '40 40 40', // #282828
  'rgb-surface-tertiary': '48 48 48', // #303030
  'rgb-surface-tertiary-alt': '56 56 56', // #383838
  'rgb-surface-dialog': '32 32 32', // #202020
  'rgb-surface-submit': '79 90 66', // #4f5a42
  'rgb-surface-submit-hover': '96 110 80', // #606e50
  'rgb-surface-destructive': '153 27 27', // #991b1b (red-800)
  'rgb-surface-destructive-hover': '127 29 29', // #7f1d1d (red-900)
  'rgb-surface-chat': '32 32 32', // #202020

  // Border colors
  'rgb-border-light': '59 59 59', // #3b3b3b
  'rgb-border-medium': '112 112 112', // #707070
  'rgb-border-medium-alt': '112 112 112', // #707070
  'rgb-border-heavy': '144 144 144', // #909090
  'rgb-border-xheavy': '154 154 154', // #9a9a9a

  // Brand colors
  'rgb-brand-purple': '145 163 122', // legacy name, shared olive accent

  // Presentation
  'rgb-presentation': '32 32 32', // #202020

  // Utility colors (mapped to existing colors for backwards compatibility)
  'rgb-background': '20 20 20',
  'rgb-foreground': '241 241 241',
  'rgb-primary': '79 90 66',
  'rgb-primary-foreground': '250 250 250',
  'rgb-secondary': '32 32 32',
  'rgb-secondary-foreground': '200 200 200',
  'rgb-muted': '40 40 40',
  'rgb-muted-foreground': '168 168 168',
  'rgb-accent': '48 54 42',
  'rgb-accent-foreground': '241 241 241',
  'rgb-destructive-foreground': '250 250 250',
  'rgb-border': '112 112 112',
  'rgb-input': '112 112 112',
  'rgb-ring': '145 163 122',
  'rgb-card': '28 28 28',
  'rgb-card-foreground': '241 241 241',
};
