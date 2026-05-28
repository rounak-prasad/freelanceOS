/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#0A0A0A',
          900: '#0F0F0F',
          800: '#1A1A1A',
          700: '#262626',
          600: '#2A2A2A',
          500: '#404040',
          400: '#525252',
          300: '#737373',
          200: '#A3A3A3',
          100: '#D4D4D4',
          50: '#FAFAFA',
        },
        accent: {
          DEFAULT: '#00D4AA',
          50: '#ECFDF9',
          100: '#D1FAF0',
          200: '#A7F3E2',
          300: '#5EEAD0',
          400: '#2DD4BF',
          500: '#00D4AA',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        status: {
          green: '#22C55E',
          amber: '#F59E0B',
          red: '#EF4444',
          blue: '#3B82F6',
          purple: '#A855F7',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'count-up': 'countUp 1s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 212, 170, 0)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(0, 212, 170, 0.15)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(135deg, #00D4AA, #0D9488)',
        'gradient-dark': 'linear-gradient(135deg, #1A1A1A, #262626)',
        'shimmer-gradient': 'linear-gradient(90deg, transparent, rgba(0,212,170,0.05), transparent)',
      },
    },
  },
  plugins: [],
}
