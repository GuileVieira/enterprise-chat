import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        background: '#f9fafb',
        surface: '#ffffff',
        'text-primary': '#0a0a0a',
        'text-secondary': '#595959',
        'text-muted': '#999696',
        accent: '#0a0a0a',
        'accent-hover': '#1a1a1a',
      },
      borderRadius: {
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'diffusion': '0 20px 40px -15px rgba(0,0,0,0.05)',
        'diffusion-lg': '0 25px 50px -12px rgba(0,0,0,0.08)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
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
