'use client';

import { InfiniteSlider } from '@/components/ui/testimonials-6-utils/infinite-slider';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Testimonial = {
  quote: string;
  image: string;
  name: string;
  /** Peran + area, mis. "Penjual roti — Sawangan, Depok". */
  role: string;
  audience: 'Pembeli' | 'UMKM';
  rating: number;
};

// Data demo ReBites (bukan testimoni pelanggan nyata).
// Avatar: randomuser.me (potret stock, stabil untuk hotlink);
// bila gagal dimuat otomatis turun ke avatar inisial.
const reviews: Testimonial[] = [
  {
    quote:
      'Di ReBites saya bisa lihat dulu menu surplus yang masih tersedia, jadi tidak perlu menebak-nebak stok warung sekitar.',
    image: 'https://randomuser.me/api/portraits/men/32.jpg',
    name: 'Dimas A.',
    role: 'Pembeli — Beji, Depok',
    audience: 'Pembeli',
    rating: 5.0,
  },
  {
    quote:
      'Menjelang tutup masih ada sisa nasi? Sekarang saya unggah dari pagi, dan biasanya habis sebelum jam tutup.',
    image: 'https://randomuser.me/api/portraits/women/65.jpg',
    name: 'Sri Wahyuni',
    role: 'Penjual nasi rumahan — Margonda, Depok',
    audience: 'UMKM',
    rating: 5.0,
  },
  {
    quote:
      'Buat makan malam tim kantor, tiga menu sekaligus masih di bawah budget biasa. Notifikasi statusnya juga jelas.',
    image: 'https://randomuser.me/api/portraits/men/45.jpg',
    name: 'Rizky Pratama',
    role: 'Pembeli — Sukmajaya, Depok',
    audience: 'Pembeli',
    rating: 4.9,
  },
  {
    quote:
      'Dashboard-nya tidak bikin pusing: isi menu, harga, stok. Pesanan langsung kelihatan tanpa bolak-balik cek HP.',
    image: 'https://randomuser.me/api/portraits/men/85.jpg',
    name: 'Hendra S.',
    role: 'Penjual roti — Sawangan, Depok',
    audience: 'UMKM',
    rating: 4.9,
  },
  {
    quote:
      'Pesanan sampai masih hangat dan porsinya sama seperti beli langsung di tempat. Harga surplusnya jujur.',
    image: 'https://randomuser.me/api/portraits/women/44.jpg',
    name: 'Sinta Maharani',
    role: 'Pembeli — Cimanggis, Depok',
    audience: 'Pembeli',
    rating: 4.8,
  },
  {
    quote:
      'Sisa catering acara dulu sering terbuang. Lewat ReBites, malam itu juga ludes dibeli warga sekitar.',
    image: 'https://randomuser.me/api/portraits/women/24.jpg',
    name: 'Bu Ratna',
    role: 'Penjual katering — Cinere, Depok',
    audience: 'UMKM',
    rating: 5.0,
  },
  {
    quote:
      'Hemat bukan berarti berkompromi — harganya masuk akal karena belum habis terjual, bukan karena kualitasnya buruk.',
    image: 'https://randomuser.me/api/portraits/women/68.jpg',
    name: 'Dewi Kurnia',
    role: 'Pembeli — Pancoran Mas, Depok',
    audience: 'Pembeli',
    rating: 5.0,
  },
  {
    quote:
      'Roti sisa display pagi yang biasanya didiskon habis-habisan, sekarang masuk etalase ReBites. Lebih untung.',
    image: 'https://randomuser.me/api/portraits/women/17.jpg',
    name: 'Laras Lestari',
    role: 'Penjual kue & roti — Depok Lama',
    audience: 'UMKM',
    rating: 4.9,
  },
  {
    quote:
      'Bisa ikuti warung favorit dan langsung tahu kalau ada menu baru masuk etalase. Praktis banget.',
    image: 'https://randomuser.me/api/portraits/men/12.jpg',
    name: 'Fajar Nugraha',
    role: 'Pembeli — Limo, Depok',
    audience: 'Pembeli',
    rating: 4.8,
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
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect width='96' height='96' rx='48' fill='#1B4D33'/><text x='48' y='48' fill='#ffffff' font-family='Arial, sans-serif' font-size='34' font-weight='700' text-anchor='middle' dominant-baseline='central'>${initialsOf(name)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export function TestimonialsCard({
  testimonial,
  className,
}: {
  testimonial: Testimonial;
  className?: string;
}) {
  const { quote, image, name, role, audience, rating } = testimonial;

  return (
    <figure
      className={cn(
        'w-full max-w-xs rounded-3xl border bg-white p-8 shadow-lg shadow-foreground/5',
        className,
      )}
    >
      <blockquote className="text-[15px] leading-relaxed text-foreground/90">
        &ldquo;{quote}&rdquo;
      </blockquote>

      <div className="mt-4 flex items-center gap-1.5" aria-label={`Rating ${rating} dari 5`}>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
          ))}
        </div>
        <span className="text-[11px] font-semibold text-foreground/80">{rating.toFixed(1)}</span>
        <span className="ml-auto rounded-full bg-accent px-2 py-0.5 font-secondary text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">
          {audience}
        </span>
      </div>

      <figcaption className="mt-5 flex items-center gap-2.5 border-t border-border/60 pt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border"
          width="32"
          height="32"
          loading="lazy"
          alt={`Foto profil ${name}`}
          src={image}
          onError={(e) => {
            const img = e.currentTarget;
            if (img.dataset.fallbackApplied) return;
            img.dataset.fallbackApplied = '1';
            img.src = initialsAvatar(name);
          }}
        />
        <div className="flex min-w-0 flex-col">
          <cite className="truncate text-sm font-medium not-italic leading-5 tracking-tight text-foreground">
            {name}
          </cite>
          <span className="truncate text-xs leading-5 tracking-tight text-muted-foreground">
            {role}
          </span>
        </div>
      </figcaption>
    </figure>
  );
}

// Tiga kolom scroll vertikal tak berujung, kecepatan tiap kolom berbeda,
// melambat saat hover. Kolom 2 tampil mulai tablet, kolom 3 mulai layar besar.
export function TestimonialColumns({
  reviews: reviewList = reviews,
  className,
}: {
  reviews?: Testimonial[];
  className?: string;
}) {
  const columns = [reviewList.slice(0, 3), reviewList.slice(3, 6), reviewList.slice(6, 9)];
  const speeds = [
    { speed: 30, speedOnHover: 15 },
    { speed: 50, speedOnHover: 25 },
    { speed: 35, speedOnHover: 17 },
  ];
  const columnVisibility = [undefined, 'hidden md:block', 'hidden xl:block'];
  const maskImage =
    'linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)';

  return (
    <div
      className={cn('flex max-h-[40rem] justify-center gap-6 overflow-hidden', className)}
      style={{
        maskImage,
        WebkitMaskImage: maskImage,
      }}
    >
      {columns.map((column, index) => (
        <InfiniteSlider
          key={index}
          direction="vertical"
          speed={speeds[index]?.speed ?? 40}
          speedOnHover={speeds[index]?.speedOnHover ?? 20}
          className={columnVisibility[index]}
        >
          {column.map((testimonial) => (
            <TestimonialsCard key={testimonial.name} testimonial={testimonial} />
          ))}
        </InfiniteSlider>
      ))}
    </div>
  );
}

// Versi lengkap ala 21st.dev (badge + heading + subteks + kolom),
// dipakai bila komponen ini berdiri sendiri tanpa heading section lain.
export function TestimonialsSection() {
  return (
    <section className="relative py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-4">
          <div className="flex justify-center">
            <div className="rounded-lg border px-4 py-1 text-sm">Testimoni</div>
          </div>
          <h2 className="text-3xl font-bold tracking-tighter lg:text-4xl">Apa kata mereka</h2>
          <p className="text-center text-sm text-muted-foreground">
            Cerita pembeli dan UMKM yang memakai ReBites.
          </p>
        </div>
        <div className="mt-10">
          <TestimonialColumns />
        </div>
      </div>
    </section>
  );
}
