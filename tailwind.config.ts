import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 1px)',
        sm: 'calc(var(--radius) - 2px)',
      },
      fontFamily: {
        display: ['var(--font-sans)'],
        sans: ['var(--font-sans)'],
        inter: ['var(--font-secondary)', 'system-ui', 'sans-serif'],
      },
      colors: {
        forest: '#3B5240',
        'forest-dark': '#2F4235',
        'forest-deep': '#2A3731',
        'forest-800': '#163C28',
        'forest-900': '#0F2E1F',
        cream: '#F7F5EF',
        'cream-50': '#FAF8F5',
        'cream-100': '#F4F1E9',
        'cream-200': '#ECE7DA',
        stone: '#6B6A63',
        hairline: '#DEDACF',
        sage: '#AEB89B',
        'sage-100': '#E4EBE4',
        'sage-500': '#6B9080',
        'sage-600': '#5F796C',
        'green-50': '#EAF2EC',
        'green-600': '#2D6A4F',
        'green-700': '#1B4D32',
        gold: '#D6A54A',
        'gold-100': '#F3E9C9',
        'gold-200': '#EAD7A8',
        'gold-300': '#E2C98A',
        'gold-400': '#D9BA62',
        'gold-500': '#C9A227',
        'gold-600': '#B08A1C',
        sale: '#E53935',
        'charcoal-500': '#5C6B60',
        'charcoal-900': '#1E2A22',
        amber: {
          DEFAULT: '#D6A54A',
          50: '#FCF9EF',
          100: '#F7EFD6',
          200: '#EFE1B0',
          300: '#E5CF85',
          400: '#DDBB5F',
          500: '#D6A54A',
          600: '#BE8731',
          700: '#9A6824',
        },
        caramel: '#C8A882',
        'caramel-dark': '#6F4529',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          strong: 'hsl(var(--primary-foreground-strong))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0%)' },
          to: { transform: 'translateX(-50%)' },
        },
        'marquee-reverse': {
          from: { transform: 'translateX(-50%)' },
          to: { transform: 'translateX(0%)' },
        },
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
        'marquee-reverse': 'marquee-reverse 40s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
