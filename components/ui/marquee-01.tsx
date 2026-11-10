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
// Avatar: foto potret (Unsplash). Semua kartu menampilkan foto profil.
const reviews: Review[] = [
  {
    name: "Dimas A.",
    username: "@dimasbeji",
    body: "Di ReBites saya bisa lihat dulu menu surplus yang masih tersedia, jadi tidak perlu menebak-nebak stok warung sekitar.",
    profile: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=128&h=128&q=80",
    audience: "Pembeli",
    role: "Pembeli — Beji, Depok",
    rating: 5.0,
  },
  {
    name: "Sri Wahyuni",
    username: "@sriwarung",
    body: "Menjelang tutup masih ada sisa nasi? Sekarang saya unggah dari pagi, dan biasanya habis sebelum jam tutup.",
    profile: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=128&h=128&q=80",
    audience: "UMKM",
    role: "Penjual nasi rumahan — Margonda, Depok",
    rating: 5.0,
  },
  {
    name: "Hendra S.",
    username: "@hendraroti",
    body: "Dashboard-nya tidak bikin pusing: isi menu, harga, stok. Pesanan langsung kelihatan tanpa bolak-balik cek HP.",
    profile: "https://images.unsplash.com/photo-1500648767791-00dcc994a43?auto=format&fit=crop&w=128&h=128&q=80",
    audience: "UMKM",
    role: "Penjual roti — Sawangan, Depok",
    rating: 4.9,
  },
  {
    name: "Sinta Maharani",
    username: "@sintasav",
    body: "Pesanan sampai masih hangat dan porsinya sama seperti beli langsung di tempat. Harga surplusnya jujur.",
    profile: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=128&h=128&q=80",
    audience: "Pembeli",
    role: "Pembeli — Cimanggis, Depok",
    rating: 4.8,
  },
  {
    name: "Laras Lestari",
    username: "@larasbakery",
    body: "Roti sisa display pagi yang biasanya didiskon habis-habisan, sekarang masuk etalase ReBites. Lebih untung.",
    profile: "https://images.unsplash.com/photo-1544005313-4817aa6c0977?auto=format&fit=crop&w=128&h=128&q=80",
    audience: "UMKM",
    role: "Penjual kue & roti — Depok Lama",
    rating: 4.9,
  },
  {
    name: "Dewi Kurnia",
    username: "@dewiku",
    body: "Hemat bukan berarti berkompromi — harganya masuk akal karena belum habis terjual, bukan karena kualitasnya buruk.",
    profile: "https://images.unsplash.com/photo-1494790108755-2616b612b47c?auto=format&fit=crop&w=128&h=128&q=80",
    audience: "Pembeli",
    role: "Pembeli — Pancoran Mas, Depok",
    rating: 5.0,
  },
];

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
    <Card className="relative h-full w-72 cursor-pointer overflow-hidden border-border bg-white p-4 shadow-none transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <CardContent className="flex h-full flex-col gap-2.5 p-0">
        <div className="flex flex-row items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="h-10 w-10 shrink-0 rounded-full border border-border/60 object-cover"
            width="40"
            height="40"
            loading="lazy"
            alt={name}
            src={profile}
          />
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{name}</p>
            <p className="truncate text-[10.5px] leading-tight text-muted-foreground">
              {username}
            </p>
          </div>
          <span className="ml-auto shrink-0 self-start rounded-full bg-accent px-2 py-0.5 font-secondary text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">
            {audience}
          </span>
        </div>

        <div className="flex items-center gap-1.5" aria-label={`Rating ${rating} dari 5`}>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            ))}
          </div>
          <span className="text-[11px] font-semibold text-foreground/80">{rating.toFixed(1)}</span>
          <span className="text-[10px] text-muted-foreground">· {role}</span>
        </div>

        <p className="line-clamp-3 text-[12px] leading-snug text-foreground/90">
          &ldquo;{body}&rdquo;
        </p>
      </CardContent>
    </Card>
  );
};

export default function TestimonialMarqueeDemo() {
  return (
    <div className="relative flex w-full flex-col items-center justify-center overflow-hidden py-2">
      <Marquee pauseOnHover className="[--duration:24s]">
        {firstRow.map((review) => (
          <ReviewCard key={`${review.username}-1`} {...review} />
        ))}
      </Marquee>
      <Marquee reverse pauseOnHover className="mt-4 [--duration:24s]">
        {secondRow.map((review) => (
          <ReviewCard key={`${review.username}-2`} {...review} />
        ))}
      </Marquee>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent sm:w-28" />
    </div>
  );
}
