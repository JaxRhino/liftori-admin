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
          300: '#D1D5DB',
          400: '#A6B1BF',
          500: '#8E9BAB',
          600: '#7A8999',
          700: '#64748B',
          800: '#475569',
          900: '#334155',
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
