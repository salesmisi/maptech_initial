export default {
  darkMode: 'class',
  content: [
    "./resources/**/*.blade.php",
    "./resources/**/*.js",
    "./resources/**/*.ts",
    "./resources/**/*.tsx",
  ],
  theme: {
    extend: {
      colors: {
        'green-dark': 'var(--GREEN_DARK)',
        'green-mid': 'var(--GREEN_MID)',
        'green-pale': 'var(--GREEN_PALE)',
        'green-text': 'var(--GREEN_TEXT)',
        'alt-row': 'var(--ALT_ROW)',
        'border-clr': 'var(--BORDER_CLR)',
        'gray-row': 'var(--GRAY_ROW)',
      },
      fontFamily: {
        sans: ['Calibri', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial'],
      },
    },
  },
  plugins: [],
}
