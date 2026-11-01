import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './types/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /**
       * Skala opacity tambahan.
       *
       * Tailwind hanya menghasilkan CSS untuk nilai yang ada di skala. Nilai
       * di luar skala diabaikan tanpa error build maupun peringatan lint,
       * sehingga kelas seperti `bg-success/15` tidak berefek dan elemen
       * memakai warna induknya.
       *
       * Nilai berikut ditambahkan karena dipakai di komponen. Sisanya sudah
       * ada di skala bawaan: 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90,
       * 95, 100.
       */
      opacity: {
        15: '0.15',
        35: '0.35',
        45: '0.45',
        55: '0.55',
        68: '0.68',
        85: '0.85',
      },

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
      // Skala elevasi panel admin. Ganti garis 1px dengan bayangan lembut:
      // permukaan tetap terbaca sebagai lapisan, tapi tidak lagi terlihat
      // seperti kotak bertanda. `admin-card` = panel/tabel diam,
      // `admin-pop` = lapisan mengambang (dropdown, modal, drawer),
      // `admin-hover` = state hover pada kartu interaktif.
      boxShadow: {
        'admin-card':
          '0 1px 2px hsl(152 20% 20% / 0.04), 0 8px 24px -12px hsl(152 20% 20% / 0.16)',
        'admin-pop':
          '0 4px 12px hsl(152 20% 20% / 0.08), 0 16px 40px -16px hsl(152 20% 20% / 0.28)',
        'admin-hover':
          '0 2px 6px hsl(152 20% 20% / 0.06), 0 16px 32px -16px hsl(152 20% 20% / 0.24)',
      },
      // Dua keluarga font sesuai arah desain: Plus Jakarta Sans (primary,
      // --font-sans) dan Be Vietnam Pro (secondary, --font-secondary).
      // Alias `inter` menunjuk variabel yang sama dengan `sans` supaya kelas
      // `font-inter` pada lama masih valid tanpa memperkenalkan font ketiga.
      fontFamily: {
        display: ['var(--font-sans)'],
        sans: ['var(--font-sans)'],
        secondary: ['var(--font-secondary)', 'system-ui', 'sans-serif'],
        inter: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Palet panel admin (dari branch fitur admin) — token legacy yang
        // masih dipakai komponen admin. Kadang kelas ini juga dipakai halaman
        // publik lama; bersihkan seiring migrasi desain putih-hijau.
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
        'charcoal-500': '#5C6B60',
        // charcoal-700: teks body sekunder. Sebelumnya kelas `text-charcoal-700`
        // dipakai di banyak komponen admin tetapi token ini belum ada, sehingga
        // kelasnya tidak menghasilkan CSS dan teks jatuh ke charcoal-900
        // (hierarki judul vs body hilang). Nilai ini memberi kontras ~9.4:1
        // di atas putih (charcoal-500 ~5.6:1, charcoal-900 ~15:1) sehingga
        // terbaca ringan tanpa melanggar WCAG AA.
        'charcoal-700': '#3B4A40',
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
        // Single source of truth: every colour below maps to a token in app/globals.css.
        // `sale` shares the destructive hue on purpose — one red value, two roles.
        sale: 'hsl(var(--destructive))',
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
          dark: 'hsl(var(--primary-dark))',
          foreground: 'hsl(var(--primary-foreground))',
          // Nama kunci sengaja 'foreground-strong' supaya utilitas yang
          // dihasilkan adalah `text-primary-foreground-strong` — kelas inilah
          // yang dipakai tombol, badge, dan footer. Sebelumnya kuncinya
          // 'strong' sehingga kelas itu tidak pernah tergenerate dan teks
          // tombol hilang di atas latar hijau saat hover.
          'foreground-strong': 'hsl(var(--primary-foreground-strong))',
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
          // Nada gelap untuk teks (badge/label). `warning` sendiri hanya cocok
          // sebagai latar; sebagai warna teks kontrasnya di bawah 4.5:1.
          strong: 'hsl(var(--warning-strong))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Token permukaan panel admin. Semua nilainya didefinisikan di
        // `app/globals.css` pada blok `:root` (bukan hanya `.admin-root`)
        // supaya `hsl(var(--admin-*))` selalu resolve, termasuk ketika
        // komponen admin dirender lewat portal di luar `.admin-root`.
        // Halaman publik tidak memakai token ini.
        'admin-canvas': 'hsl(var(--admin-canvas))',
        'admin-panel': 'hsl(var(--admin-panel))',
        'admin-surface': 'hsl(var(--admin-surface))',
        'admin-surface-hover': 'hsl(var(--admin-surface-hover))',
        'admin-line': 'hsl(var(--admin-line))',
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
