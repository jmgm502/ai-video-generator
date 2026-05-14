/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#667eea',
          light: '#8b9cf5',
          dark: '#4c5fd5',
        },
        background: {
          DEFAULT: '#1a1a2e',
          secondary: '#16213e',
          tertiary: '#0f0f1a',
        },
        text: {
          primary: '#ffffff',
          secondary: '#a0a0a0',
          muted: '#6b7280',
        },
        success: '#67c23a',
        warning: '#e6a23c',
        danger: '#f56c6c',
        info: '#909399',
      },
      fontFamily: {
        sans: ['Microsoft YaHei', 'PingFang SC', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        'sm': '6px',
        'md': '12px',
        'lg': '16px',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
