/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f4f6fa',
          100: '#e8ecf5',
          200: '#c9d2e6',
          300: '#9aa8cc',
          400: '#6b7fb0',
          500: '#3f5588',
          600: '#2a3a66',
          700: '#1f2d52',
          800: '#16213e',
          900: '#0f172a',
        },
        gold: {
          50: '#fdfaf3',
          100: '#f9f2e3',
          200: '#f0e2c2',
          300: '#e4cc98',
          400: '#d4b16a',
          500: '#c9a227',
          600: '#a8861f',
          700: '#876a1a',
          800: '#665015',
          900: '#45360f',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}