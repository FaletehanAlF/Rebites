'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Marquee } from '@/components/ui/marquee-01-utils/marquee';
import { Star, Quote } from 'lucide-react';

type Review = {
  name: string;
  username: string;
  body: string;
  profile: string;
  audience: 'Pembeli' | 'UMKM';
  role: string;
  rating: number;
};

// Data demo ReBites (bukan testimoni pelanggan nyata).
const reviews: Review[] = [
  {
    name: 'Dimas A.',
    username: '@dimasbeji',
    body: 'Di ReBites saya bisa lihat dulu menu surplus yang masih tersedia, jadi tidak perlu menebak-nebak stok warung sekitar.',
    profile: 'https://randomuser.me/api/portraits/men/32.jpg',
    audience: 'Pembeli',
    role: 'Pembeli — Beji, Depok',
    rating: 5.0,
  },
  {
    name: 'Sri Wahyuni',
    username: '@sriwarung',
    body: 'Menjelang tutup masih ada sisa nasi? Sekarang saya unggah dari pagi, dan biasanya habis sebelum jam tutup.',
    profile: 'https://randomuser.me/api/portraits/women/65.jpg',
    audience: 'UMKM',
    role: 'Penjual nasi rumahan — Margonda, Depok',
    rating: 5.0,
  },
  {
    name: 'Hendra S.',
    username: '@hendraroti',
    body: 'Dashboard-nya tidak bikin pusing: isi menu, harga, stok. Pesanan langsung kelihatan tanpa bolak-balik cek HP.',
    profile: 'https://randomuser.me/api/portraits/men/85.jpg',
    audience: 'UMKM',
    role: 'Penjual roti — Sawangan, Depok',
    rating: 4.9,
  },
  {
    name: 'Sinta Maharani',
    username: '@sintasav',
    body: 'Pesanan sampai masih hangat dan porsinya sama seperti beli langsung di tempat. Harga surplusnya jujur.',
    profile: 'https://randomuser.me/api/portraits/women/44.jpg',
    audience: 'Pembeli',
    role: 'Pembeli — Cimanggis, Depok',
    rating: 4.8,
  },
  {
    name: 'Laras Lestari',
    username: '@larasbakery',
    body: 'Roti sisa display pagi yang biasanya didiskon habis-habisan, sekarang masuk etalase ReBites. Lebih untung.',
    profile: 'https://randomuser.me/api/portraits/women/17.jpg',
    audience: 'UMKM',
    role: 'Penjual kue & roti — Depok Lama',
    rating: 4.9,
  },
  {
    name: 'Dewi Kurnia',
    username: '@dewiku',
    body: 'Hemat bukan berarti berkompromi — harganya masuk akal karena belum habis terjual, bukan karena kualitasnya buruk.',
    profile: 'https://randomuser.me/api/portraits/women/68.jpg',
    audience: 'Pembeli',
    role: 'Pembeli — Pancoran Mas, Depok',
    rating: 5.0,
  },
];

const initialsOf = (name: string) =>
  name
    .replace(/[^A-Za-z ]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

const initialsAvatar = (name: string) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect width='96' height='96' rx='48' fill='#247A4D'/><text x='48' y='48' fill='#ffffff' font-family='Arial, sans-serif' font-size='34' font-weight='700' text-anchor='middle' dominant-baseline='central'>${initialsOf(name)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const firstRow = reviews.slice(0, Math.ceil(reviews.length / 2));
const secondRow = reviews.slice(Math.ceil(reviews.length / 2));

const ReviewCard = ({
  profile,
  name,
  body,
  role,
}: Review) => {
  return (
    <Card className="w-[300px] shrink-0 rounded-3xl border border-border/60 bg-white p-5 shadow-[0_18px_40px_-24px_rgba(27,77,50,0.35)] transition-transform duration-300">
      <CardContent className="flex h-full flex-col gap-4 p-0">
        {/* Stars kiri + ikon quote kanan */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-0.5" aria-label="Rating 5 dari 5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="h-4 w-4 fill-primary text-primary"
                aria-hidden
              />
            ))}
          </div>
          <Quote
            className="h-7 w-7 shrink-0 rotate-180 text-primary/25"
            aria-hidden
          />
        </div>

        {/* Isi ulasan */}
        <p className="text-sm leading-relaxed text-foreground/85">
          {body}
        </p>

        {/* Divider + identitas */}
        <div className="border-t border-border/60 pt-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-border"
              width="44"
              height="44"
              loading="lazy"
              alt={`Foto profil ${name}`}
              src={profile}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.dataset.fallbackApplied) return;
                img.dataset.fallbackApplied = '1';
                img.src = initialsAvatar(name);
              }}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-snug text-foreground">
                {name}
              </p>
              <p className="truncate text-xs text-muted-foreground">{role}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Dua baris marquee horizontal berlawanan arah:
// baris atas bergerak ke kiri, baris bawah ke kanan.
export default function TestimonialMarqueeDemo() {
  return (
    <div className="relative flex w-full flex-col items-center justify-center overflow-hidden py-4">
      <Marquee pauseOnHover className="[--duration:36s] [--gap:4rem]">
        {firstRow.map((review) => (
          <ReviewCard key={`${review.username}-1`} {...review} />
        ))}
      </Marquee>
      <Marquee pauseOnHover reverse className="mt-10 [--duration:36s] [--gap:4rem]">
        {secondRow.map((review) => (
          <ReviewCard key={`${review.username}-2`} {...review} />
        ))}
      </Marquee>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent sm:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent sm:w-32" />
    </div>
  );
}
