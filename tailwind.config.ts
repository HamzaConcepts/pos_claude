import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
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
        'xs': '0.75rem',      // 12px (increased from ~11px)
        'sm': '0.875rem',     // 14px (increased from ~12px)
        'base': '1rem',       // 16px (increased from ~14px)
        'lg': '1.125rem',     // 18px (increased from ~15px)
        'xl': '1.25rem',      // 20px (increased from ~16px)
        '2xl': '1.5rem',      // 24px (increased from ~19px)
        '3xl': '1.875rem',    // 30px (increased from ~24px)
        '4xl': '2.25rem',     // 36px (increased from ~30px)
      },
      spacing: {
        '1': '0.25rem',    // 4px (increased from ~3.4px)
        '2': '0.5rem',     // 8px (increased from ~6.8px)
        '3': '0.75rem',    // 12px (increased from ~10.2px)
        '4': '1rem',       // 16px (increased from ~13.6px)
        '5': '1.25rem',    // 20px (increased from ~17px)
        '6': '1.5rem',     // 24px (increased from ~20.4px)
        '8': '2rem',       // 32px (increased from ~27px)
        '10': '2.5rem',    // 40px (increased from ~34px)
        '12': '3rem',      // 48px (increased from ~41px)
        '16': '4rem',      // 64px (increased from ~54px)
        '20': '5rem',      // 80px (increased from ~68px)
        '24': '6rem',      // 96px (increased from ~82px)
      },
    },
  },
  plugins: [],
}
export default config
