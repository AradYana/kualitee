import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Neo-Retro Industrial palette
        'page-bg': '#cec5b4',
        'window-bg': '#e6e0d4',
        'title-bar': '#084999',
        'chip-bg': '#A8C4E1',
        'border-gray': '#808080',
        'text-primary': '#000000',
        'text-secondary': '#4D4D4D',
        'logo-fill': '#9cc4de',
        'logo-shadow': '#98BBDD',
      },
      fontFamily: {
        'mono': ['Courier Prime', 'Roboto Mono', 'Consolas', 'monospace'],
        'sans': ['Inter', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'window': '12px',
        'terminal': '6px',
        'chip': '8px',
        'input': '4px',
        'btn': '6px',
      },
      boxShadow: {
        'bevel': 'inset 1px 1px 0px #000000',
        'bevel-out': 'inset -1px -1px 0px #000000, inset 1px 1px 0px #FFFFFF',
        'soft': '0 2px 8px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
}
export default config
