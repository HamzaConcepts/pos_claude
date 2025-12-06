import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        "radial-large": "radial-gradient(circle 75%, var(--tw-gradient-stops))",
      },
      colors: {
        'bg-primary': '#FFFFFF',
        'bg-secondary': '#F5F5F5',
        'bg-dark': '#000000',
        'text-primary': '#000000',
        'text-secondary': '#666666',
        'text-inverse': '#FFFFFF',
        'border-light': '#E0E0E0',
        'border-dark': '#000000',
        'status-success': '#000000',
        'status-warning': '#666666',
        'status-error': '#333333',
        'status-info': '#999999',
      },
      fontSize: {
        'xs': '0.68rem',      // ~11px (was 12px)
        'sm': '0.765rem',     // ~12px (was 14px)
        'base': '0.85rem',    // ~14px (was 16px)
        'lg': '0.935rem',     // ~15px (was 18px)
        'xl': '1.02rem',      // ~16px (was 20px)
        '2xl': '1.19rem',     // ~19px (was 24px)
        '3xl': '1.53rem',     // ~24px (was 30px)
        '4xl': '1.87rem',     // ~30px (was 36px)
      },
      spacing: {
        '1': '0.212rem',   // ~3.4px (was 4px)
        '2': '0.425rem',   // ~6.8px (was 8px)
        '3': '0.638rem',   // ~10.2px (was 12px)
        '4': '0.85rem',    // ~13.6px (was 16px)
        '5': '1.063rem',   // ~17px (was 20px)
        '6': '1.275rem',   // ~20.4px (was 24px)
        '8': '1.7rem',     // ~27px (was 32px)
        '10': '2.125rem',  // ~34px (was 40px)
        '12': '2.55rem',   // ~41px (was 48px)
        '16': '3.4rem',    // ~54px (was 64px)
        '20': '4.25rem',   // ~68px (was 80px)
        '24': '5.1rem',    // ~82px (was 96px)
      },
    },
  },
  plugins: [],
}
export default config
