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
        bg: '#08080f',
        bg2: '#0b0b18',
        bg3: '#0e0e1c',
        card: '#0f0f1e',
        card2: '#13132a',
        sidebar: '#09091a',
        indigo: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4338ca',
        },
        purple: {
          DEFAULT: '#7c3aed',
          light: '#a78bfa',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
      },
      boxShadow: {
        glow: '0 0 40px rgba(99,102,241,.3)',
        'glow-lg': '0 0 80px rgba(99,102,241,.4), 0 0 160px rgba(99,102,241,.1)',
      },
      animation: {
        'btn-pulse': 'btn-pulse 2.8s ease-in-out infinite',
        'fade-in': 'fadeIn 0.35s ease forwards',
        'spin-slow': 'spin 1.1s linear infinite reverse',
      },
      keyframes: {
        'btn-pulse': {
          '0%, 100%': { boxShadow: '0 4px 22px rgba(99,102,241,.28), 0 0 0px rgba(124,58,237,0)' },
          '50%': { boxShadow: '0 4px 38px rgba(99,102,241,.6), 0 0 32px rgba(124,58,237,.38)' },
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
