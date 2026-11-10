import { Card, CardContent } from "@/components/ui/card";
import { Marquee } from "@/components/ui/marquee-03-utils/marquee";

type Review = {
  name: string;
  username: string;
  body: string;
  profile: string;
  audience: 'Pembeli' | 'UMKM';
};

// Data contoh ReBites (bukan testimoni pelanggan nyata).
// Avatar: foto potret (Unsplash). 6 ulasan — 2 per kolom agar rapat.
const reviews: Review[] = [
  {
    name: "Dimas A.",
    username: "@dimasbeji",
    body: "“Di ReBites saya bisa lihat dulu menu surplus yang masih tersedia, jadi tidak perlu menebak-nebak stok warung sekitar.”",
    profile: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=128&h=128&q=80",
    audience: "Pembeli",
  },
  {
    name: "Sri Wahyuni",
    username: "@sriwarung",
    body: "“Menjelang tutup masih ada sisa nasi? Sekarang saya unggah dari pagi, dan biasanya habis sebelum jam tutup.”",
    profile: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=128&h=128&q=80",
    audience: "UMKM",
  },
  {
    name: "Hendra S.",
    username: "@hendraroti",
    body: "“Dashboard-nya tidak bikin pusing: isi nama menu, harga, sisa stok. Pesanan langsung kelihatan tanpa bolak-balik cek HP.”",
    profile: "https://images.unsplash.com/photo-1500648767791-00dcc994a43?auto=format&fit=crop&w=128&h=128&q=80",
    audience: "UMKM",
  },
  {
    name: "Sinta Maharani",
    username: "@sintasav",
    body: "“Pesanan sampai masih hangat dan porsinya sama seperti beli langsung di tempat. Harga surplusnya jujur, rasanya tetap enak.”",
    profile: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=128&h=128&q=80",
    audience: "Pembeli",
  },
  {
    name: "Laras Lestari",
    username: "@larasbakery",
    body: "“Roti sisa display pagi yang biasanya didiskon habis-habisan, sekarang masuk etalase ReBites. Lebih untung dan tidak terbuang.”",
    profile: "https://images.unsplash.com/photo-1544005313-4817aa6c0977?auto=format&fit=crop&w=128&h=128&q=80",
    audience: "UMKM",
  },
  {
    name: "Dewi Kurnia",
    username: "@dewiku",
    body: "“Hemat bukan berarti berkompromi — harganya masuk akal karena memang belum habis terjual, bukan karena kualitasnya buruk.”",
    profile: "https://images.unsplash.com/photo-1494790108755-2616b612b47c?auto=format&fit=crop&w=128&h=128&q=80",
    audience: "Pembeli",
  },
];

const ReviewCard = ({ profile, name, username, body, audience }: Review) => {
  return (
    <Card className="relative w-full max-w-sm cursor-pointer overflow-hidden border border-border bg-white p-4 shadow-none">
      <CardContent className="flex flex-col gap-2 p-0">
        <div className="flex flex-row items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="h-8 w-8 rounded-full object-cover"
            width="32"
            height="32"
            loading="lazy"
            alt={name}
            src={profile}
          />
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-[13px] font-semibold text-foreground">{name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{username}</p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-accent px-2 py-0.5 font-secondary text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">
            {audience}
          </span>
        </div>
        <p className="text-[12.5px] leading-snug text-foreground/90">{body}</p>
      </CardContent>
    </Card>
  );
};

const VerticalMarqueeDemo = () => {
  return (
    <div className="relative flex h-[420px] w-full flex-row items-center justify-center overflow-hidden">
      <div className="flex h-full w-full flex-row items-center justify-center gap-4 px-4">
        <Marquee
          pauseOnHover
          vertical
          className="hidden h-full flex-1 sm:flex [--duration:28s]"
        >
          {reviews
            .filter((_, i) => i % 3 === 0)
            .map((review, idx) => (
              <ReviewCard key={idx} {...review} />
            ))}
        </Marquee>
        <Marquee
          reverse
          pauseOnHover
          vertical
          className="hidden h-full flex-1 sm:flex [--duration:28s]"
        >
          {reviews
            .filter((_, i) => i % 3 === 1)
            .map((review, idx) => (
              <ReviewCard key={idx} {...review} />
            ))}
        </Marquee>
        <Marquee
          pauseOnHover
          vertical
          className="hidden h-full flex-1 lg:flex [--duration:28s]"
        >
          {reviews
            .filter((_, i) => i % 3 === 2)
            .map((review, idx) => (
              <ReviewCard key={idx} {...review} />
            ))}
        </Marquee>
        <Marquee
          pauseOnHover
          vertical
          className="flex h-full flex-1 sm:hidden [--duration:28s]"
        >
          {reviews.map((review, idx) => (
            <ReviewCard key={idx} {...review} />
          ))}
        </Marquee>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-white to-transparent"></div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-white to-transparent"></div>
    </div>
  );
};

export default VerticalMarqueeDemo;
