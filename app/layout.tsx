import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from 'next/font/google';
import { ChatbotMount } from '@/app/components/chatbot/chatbot-mount';

// Dua font seluruh produk: `--font-sans` utama, `--font-secondary` pendukung.
// Semua weight yang dideklarasikan dipakai kelas utility yang ada.
// `preload` false: next/font memuat semua face, jadi lebih hemat bila dimuat saat diperlukan.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  preload: false,
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin'],
  variable: '--font-secondary',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal'],
  preload: false,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'ReBites - Selamatkan Makanan Surplus, Kurangi Food Waste',
  description:
    'Marketplace yang mempertemukan pelaku UMKM kuliner dengan pembeli untuk menyelamatkan makanan surplus yang masih layak konsumsi. Dari dapur UMKM, ke piring yang butuh.',
  icons: {
    icon: '/logo.png',
  },
  openGraph: {
    title: 'ReBites - Selamatkan Makanan Surplus',
    description:
      'Marketplace makanan surplus untuk UMKM kuliner. Kurangi food waste, hemat pengeluaran.',
    type: 'website',
  },
};

const noJsCss = `
  [style*="opacity:0"], [style*="opacity: 0"] {
    opacity: 1 !important;
    transform: none !important;
  }
  [class~="z-[200]"] {
    display: none !important;
  }
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${plusJakartaSans.variable} ${beVietnamPro.variable}`}
    >
      <body className="font-sans antialiased">
        {/*
         * Fallback tanpa JS: animasi reveal memakai inline `opacity:0` yang baru
         * dibersihkan saat hydrasi, jadi tanpa JS seluruh section harus tetap
         * terbaca dan overlay disembunyikan. `dangerouslySetInnerHTML` wajib agar
         * tanda kutip CSS selamat — <style> raw-text akan membiarkan `&quot;`
         * ter-escape dan merusak aturan.
         */}
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: noJsCss }} />
        </noscript>
        {children}
        {/* Asisten melayang untuk semua halaman; profil perilaku ditentukan
            server dari status sesi, bukan dari klien. */}
        <ChatbotMount />
      </body>
    </html>
  );
}
