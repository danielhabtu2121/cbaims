/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#034dbdff',
          800: '#1c54a2ff',
          700: '#287ffaff',
          500: '#5298f3ff',
          100: '#E6EFFD',
          50: '#F0F6FE',
        },
        surface: '#FFFFFF',
        border: '#DCE4EE',
        text: {
          primary: '#0F172A',
          secondary: '#5B6B82',
        },
        success: {
          DEFAULT: '#1E8E5A',
          bg: '#E5F6ED',
        },
        warning: {
          DEFAULT: '#B8860B',
          bg: '#FFF6DF',
        },
        danger: {
          DEFAULT: '#C0362C',
          bg: '#FCEAE8',
        },
        info: {
          DEFAULT: '#2E6FB8',
          bg: '#E8F0FA',
        },
        neutral: {
          DEFAULT: '#8A97A8',
          bg: '#EEF1F5',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
