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
        // Enterprise SaaS palette
        'primary': {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        'surface': {
          'white': '#FFFFFF',
          'light': '#F7FAFC',
          'muted': '#EDF2F7',
        },
        'text': {
          'heading': '#1A202C',
          'body': '#718096',
          'muted': '#A0AEC0',
        },
        'accent': {
          'purple': '#6B46C1',
          'blue': '#63B3ED',
          'indigo': '#667EEA',
        },
        // Legacy support
        'text-primary': '#1A202C',
        'text-secondary': '#718096',
        'border-gray': '#E2E8F0',
      },
      fontFamily: {
        'sans': ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'card': '16px',
        'button': '12px',
        'input': '10px',
        'pill': '9999px',
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.08)',
        'button': '0 2px 8px rgba(107, 70, 193, 0.25)',
        'soft': '0 1px 3px rgba(0, 0, 0, 0.05)',
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(135deg, #6B46C1 0%, #63B3ED 100%)',
        'gradient-card': 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
      },
    },
  },
  plugins: [],
}
export default config
