import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from 'next/font/google';

// Exactly two typefaces for the whole product:
//   --font-sans      Plus Jakarta Sans — primary (body, headings, UI)
//   --font-secondary Be Vietnam Pro    — secondary (supporting / accent text)
// Every declared weight is justified by in-use utility classes:
//   200 font-extralight, 300 font-light, 400 font-normal, 500 font-medium,
//   600 font-semibold, 700 font-bold, 800 fallback for the two font-black sites,
//   italic for the 21 `italic` sites. `preload` stays false because next/font
//   preloads every declared face, which would fetch far more files than any view uses.
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
  openGraph: {
    title: 'ReBites - Selamatkan Makanan Surplus',
    description:
      'Marketplace makanan surplus untuk UMKM kuliner. Kurangi food waste, hemat pengeluaran.',
    type: 'website',
  },
};

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
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
