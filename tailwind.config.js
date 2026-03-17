/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        onboard: 'tap-and-swipe 2.5s infinite cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
      keyframes: {
        'tap-and-swipe': {
          '0%': {
            transform: 'translate(-20px, 0) scale(1.5)',
            opacity: '0',
          },
          '15%': {
            transform: 'translate(-20px, 0) scale(1)',
            opacity: '1',
          },
          '25%': {
            transform: 'translate(-20px, 0) scale(0.9)',
            opacity: '1',
          },
          '35%': {
            transform: 'translate(-20px, 0) scale(1)',
            opacity: '1',
          },
          '50%': {
            transform: 'translate(-20px, 0) scale(1)',
            opacity: '1',
          },
          '80%': {
            transform: 'translate(80px, 0) scale(1)',
            opacity: '0',
          },
          '100%': {
            opacity: '0',
          },
        },
      },
    },
  },
  plugins: [],
}
