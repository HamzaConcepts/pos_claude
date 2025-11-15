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
    },
  },
  plugins: [],
}
export default config
