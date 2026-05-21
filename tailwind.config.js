/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        bg: '#05070D',
        bg2: '#0B1020',
        bg3: '#0B1020',
        card: '#151C2F',
        card2: '#151C2F',
        sidebar: '#0B1020',
        cyberBlue: {
          bg: '#05070D',
          bgSecondary: '#0B1020',
          card: '#151C2F',
          accent: '#3B82F6',
          glow: '#22D3EE',
          cta: '#2563EB',
        },
        indigo: {
          DEFAULT: '#3B82F6',
          light: '#60A5FA',
          dark: '#1D4ED8',
        },
        purple: {
          DEFAULT: '#3B82F6',
          light: '#22D3EE',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #2563EB 0%, #3B82F6 55%, #22D3EE 100%)',
      },
      boxShadow: {
        glow: '0 0 40px rgba(34,211,238,.18)',
        'glow-lg': '0 0 80px rgba(59,130,246,.25), 0 0 160px rgba(34,211,238,.08)',
      },
      animation: {
        'btn-pulse': 'btn-pulse 2.8s ease-in-out infinite',
        'fade-in': 'fadeIn 0.35s ease forwards',
        'spin-slow': 'spin 1.1s linear infinite reverse',
      },
      keyframes: {
        'btn-pulse': {
          '0%, 100%': { boxShadow: '0 4px 22px rgba(59,130,246,.28), 0 0 0px rgba(34,211,238,0)' },
          '50%': { boxShadow: '0 4px 38px rgba(59,130,246,.6), 0 0 32px rgba(34,211,238,.38)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
