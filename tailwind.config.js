/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Minimal Editorial Color System
        canvas: {
          light: '#FAFAF8',
          dark: '#101713',
          DEFAULT: '#FAFAF8',
        },
        surface: {
          light: '#F0F1ED',
          dark: '#19231D',
          subtle: '#F5F6F2',
          DEFAULT: '#F0F1ED',
        },
        primary: {
          light: '#171A18',
          dark: '#F3F4EF',
          DEFAULT: '#171A18',
        },
        secondary: {
          light: '#777C77',
          dark: '#A4ADA6',
          DEFAULT: '#777C77',
        },
        accent: {
          light: '#176B50',
          dark: '#48A783',
          hoverLight: '#12543E',
          hoverDark: '#5DB895',
          DEFAULT: '#176B50',
        },
        divider: {
          light: '#E6E7E2',
          dark: '#233128',
          DEFAULT: '#E6E7E2',
        },

        // Backward-compatible semantic aliases mapped to minimal palette
        forest: {
          DEFAULT: '#101713',
          dark: '#0C120F',
          deep: '#101713',
        },
        emerald: {
          rich: '#176B50',
          deep: '#101713',
          surface: '#19231D',
          border: '#233128',
          card: '#151F19',
          accent: '#48A783',
          DEFAULT: '#176B50',
        },
        ivory: {
          DEFAULT: '#FAFAF8',
          surface: '#F0F1ED',
          border: '#E6E7E2',
          card: '#FFFFFF',
          muted: '#777C77',
        },
        gold: {
          DEFAULT: '#176B50',
          dark: '#12543E',
          light: '#48A783',
          accent: '#176B50',
          subtle: 'rgba(23, 107, 80, 0.08)',
        },
        sand: {
          50: '#FAFAF8',
          100: '#F0F1ED',
          200: '#E6E7E2',
          300: '#D5D7D1',
          800: '#171A18',
          900: '#101713',
        },
      },
      fontFamily: {
        sans: [
          '"Hind Siliguri"',
          '"Noto Sans Bengali"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        arabic: [
          '"Amiri"',
          '"Noto Naskh Arabic"',
          'Traditional Arabic',
          'serif',
        ],
      },
      maxWidth: {
        'page': '1440px',
      },
    },
  },
  plugins: [],
}
