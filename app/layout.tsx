import './globals.css';
import type { Metadata } from 'next';
import { Inter, Dancing_Script } from 'next/font/google';

// Font utama ReBites. Satu keluarga (Inter) dipakai untuk seluruh aplikasi:
// body, heading, form, dialog, tabel, dan panel admin. Inter dipilih karena
// netral, x-height besar, punya berat 100-900 (variable) plus italic, dan
// sangat terbaca pada ukuran kecil seperti tabel/label admin.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  style: ['normal', 'italic'],
});

// Hanya untuk aksen dekoratif (tanda tangan "dibuat dengan rasa" di FAQ).
// Bukan font UI, jadi tidak dipakai untuk elemen fungsional apa pun.
const dancingScript = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-script',
  display: 'swap',
  weight: ['500', '600', '700'],
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
      className={`${inter.variable} ${dancingScript.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
