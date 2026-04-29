import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        background: '#f4f2ee',
        surface: '#e8e4dc',
        'surface-raised': '#fffdf8',
        'text-primary': '#1b1a17',
        'text-secondary': '#5f5b52',
        'text-muted': '#898274',
        accent: '#1b1a17',
        'accent-hover': '#302e28',
        'border-primary': 'rgba(27,26,23,0.1)',
        moss: '#6f675b',
      },
      borderRadius: {
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        diffusion: '0 20px 44px -24px rgba(67,61,52,0.28)',
        'diffusion-lg': '0 28px 70px -34px rgba(67,61,52,0.34)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;