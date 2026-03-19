import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
      },
      colors: {
        nb:   '#C4E8F4',
        'nb-d': '#7BC8DF',
        'nb-t': '#E8F7FC',
        nc:   '#2E1A0E',
        'nc-m': '#5C3D26',
        'nc-l': '#A07850',
        ny:   '#FDFACC',
        'ny-d': '#F5EF8A',
        bg:   '#F4FAFE',
      },
    },
  },
  plugins: [],
}

export default config
