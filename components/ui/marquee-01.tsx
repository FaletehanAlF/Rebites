'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Marquee } from "@/components/ui/marquee-01-utils/marquee";
import { Star } from "lucide-react";

type Review = {
  name: string;
  username: string;
  body: string;
  profile: string;
  audience: 'Pembeli' | 'UMKM';
  role: string;
  rating: number;
};

// Data contoh ReBites (bukan testimoni pelanggan nyata).
// Avatar: randomuser.me (foto potret stock, stabil dipakai hotlink).
// Jika foto gagal dimuat (mis. jaringan diblok), otomatis turun ke avatar inisial.
const reviews: Review[] = [
  {
    name: "Dimas A.",
    username: "@dimasbeji",
    body: "Di ReBites saya bisa lihat dulu menu surplus yang masih tersedia, jadi tidak perlu menebak-nebak stok warung sekitar.",
    profile: "https://randomuser.me/api/portraits/men/32.jpg",
    audience: "Pembeli",
    role: "Pembeli — Beji, Depok",
    rating: 5.0,
  },
  {
    name: "Sri Wahyuni",
    username: "@sriwarung",
    body: "Menjelang tutup masih ada sisa nasi? Sekarang saya unggah dari pagi, dan biasanya habis sebelum jam tutup.",
    profile: "https://randomuser.me/api/portraits/women/65.jpg",
    audience: "UMKM",
    role: "Penjual nasi rumahan — Margonda, Depok",
    rating: 5.0,
  },
  {
    name: "Hendra S.",
    username: "@hendraroti",
    body: "Dashboard-nya tidak bikin pusing: isi menu, harga, stok. Pesanan langsung kelihatan tanpa bolak-balik cek HP.",
    profile: "https://randomuser.me/api/portraits/men/85.jpg",
    audience: "UMKM",
    role: "Penjual roti — Sawangan, Depok",
    rating: 4.9,
  },
  {
    name: "Sinta Maharani",
    username: "@sintasav",
    body: "Pesanan sampai masih hangat dan porsinya sama seperti beli langsung di tempat. Harga surplusnya jujur.",
    profile: "https://randomuser.me/api/portraits/women/44.jpg",
    audience: "Pembeli",
    role: "Pembeli — Cimanggis, Depok",
    rating: 4.8,
  },
  {
    name: "Laras Lestari",
    username: "@larasbakery",
    body: "Roti sisa display pagi yang biasanya didiskon habis-habisan, sekarang masuk etalase ReBites. Lebih untung.",
    profile: "https://randomuser.me/api/portraits/women/17.jpg",
    audience: "UMKM",
    role: "Penjual kue & roti — Depok Lama",
    rating: 4.9,
  },
  {
    name: "Dewi Kurnia",
    username: "@dewiku",
    body: "Hemat bukan berarti berkompromi — harganya masuk akal karena belum habis terjual, bukan karena kualitasnya buruk.",
    profile: "https://randomuser.me/api/portraits/women/68.jpg",
    audience: "Pembeli",
    role: "Pembeli — Pancoran Mas, Depok",
    rating: 5.0,
  },
];

const initials = (name: string) =>
  name.replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

const initialsAvatar = (name: string) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect width='96' height='96' rx='48' fill='#1B4D33'/><text x='48' y='48' fill='#ffffff' font-family='Arial, sans-serif' font-size='34' font-weight='700' text-anchor='middle' dominant-baseline='central'>${initials(name)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const firstRow = reviews.slice(0, reviews.length / 2);
const secondRow = reviews.slice(reviews.length / 2);

const ReviewCard = ({
  profile,
  name,
  username,
  body,
  audience,
  role,
  rating,
}: Review) => {
  return (
    <Card className="relative w-80 shrink-0 cursor-pointer border-border bg-white p-5 shadow-none transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
      <CardContent className="flex h-full flex-col gap-4 p-0">
        <div className="flex flex-row items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-border"
            width="48"
            height="48"
            loading="lazy"
            alt={`Foto profil ${name}`}
            src={profile}
            onError={(e) => {
              const img = e.currentTarget;
              if (img.dataset.fallbackApplied)
                return;
              img.dataset.fallbackApplied = "1";
              img.src = initialsAvatar(name);
            }}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-[13px] font-semibold leading-snug text-foreground">{name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{role}</p>
          </div>
          <span className="ml-auto shrink-0 self-start rounded-full bg-accent px-2.5 py-1 font-secondary text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">
            {audience}
          </span>
        </div>

        <div className="flex items-center gap-2 border-t border-border/50 pt-3" aria-label={`Rating ${rating} dari 5`}>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            ))}
          </div>
          <span className="text-[11px] font-semibold text-foreground/80">{rating.toFixed(1)}</span>
          <span className="text-[10.5px] text-muted-foreground">· {username}</span>
        </div>

        <p className="text-[12px] leading-relaxed text-foreground/90">
          &ldquo;{body}&rdquo;
        </p>
      </CardContent>
    </Card>
  );
};

export default function TestimonialMarqueeDemo() {
  return (
    <div className="relative flex w-full flex-col items-center justify-center overflow-hidden py-3 [--gap:1.25rem]">
      <Marquee pauseOnHover className="[--duration:28s]">
        {firstRow.map((review) => (
          <ReviewCard key={`${review.username}-1`} {...review} />
        ))}
      </Marquee>
      <Marquee reverse pauseOnHover className="mt-5 [--duration:28s]">
        {secondRow.map((review) => (
          <ReviewCard key={`${review.username}-2`} {...review} />
        ))}
      </Marquee>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent sm:w-24" />
    </div>
  );
}
