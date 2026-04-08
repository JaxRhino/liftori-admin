/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#060B18',
          800: '#0A1628',
          700: '#0F1D35',
          600: '#152642',
          500: '#1B3050'
        },
        brand: {
          blue: '#0EA5E9',
          light: '#7DD3FC',
          ice: '#E0F7FF',
          cyan: '#00E5CC'
        },
        gray: {
          300: '#F1F5F9',
          400: '#E2E8F0',
          500: '#CBD5E1',
          600: '#B0BAC9',
          700: '#94A3B8',
          800: '#64748B',
          900: '#475569',
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
        display: ['Bebas Neue', 'sans-serif']
      }
    }
  },
  plugins: []
}
