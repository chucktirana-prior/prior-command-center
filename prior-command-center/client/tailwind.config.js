/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        prior: {
          cream: '#FDFDF4',
          black: '#000000',
          body: '#666666',
          muted: '#999999',
          dark: '#454545',
          mid: '#888888',
          border: '#D9D9D9',
          'border-light': '#CCCCCC',
          'green-light': '#93C47D',
          'green-mid': '#6AA84F',
          'green-dark': '#38761D',
          'yellow-light': '#FFE599',
          'yellow-warm': '#F9CB9C',
        },
      },
      fontFamily: {
        serif: ['"Libre Baskerville"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
