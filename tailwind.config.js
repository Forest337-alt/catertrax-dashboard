/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#234A73',
          50:  '#edf3f8',
          100: '#d0e1ee',
          200: '#a3c2d9',
          300: '#76a4c4',
          400: '#5B9EC9',
          500: '#4582A9',  // brand secondary
          600: '#2d5a80',
          700: '#2a5580',  // hover state
          800: '#234A73',  // brand primary — main usage
          900: '#1a3756',
        },
        secondary: {
          DEFAULT: '#4582A9',
          50:  '#eef5fa',
          100: '#d2e6f2',
          200: '#a6cce5',
          300: '#79b3d8',
          400: '#5B9EC9',
          500: '#4582A9',  // brand secondary
          600: '#376d8e',
          700: '#2d5a80',
          800: '#234A73',
          900: '#1a3756',
        },
        warning: {
          DEFAULT: '#d97706',
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: {
          DEFAULT: '#dc2626',
          500: '#ef4444',
          600: '#dc2626',
        },
        success: {
          DEFAULT: '#059669',
          500: '#10b981',
          600: '#059669',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
