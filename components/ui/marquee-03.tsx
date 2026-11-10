import { Card, CardContent } from "@/components/ui/card";
import { Marquee } from "@/components/ui/marquee-03-utils/marquee";

type Review = {
  name: string;
  username: string;
  body: string;
  profile: string;
  role: string;
  audience: 'Pembeli' | 'UMKM';
};

// Data contoh (bukan testimoni pelanggan nyata) — sesuaikan dengan data riil
// saat tersedia. Avatar: foto pria/wanita dewasa kawasan urban (Unsplash).
const reviews: Review[] = [
  {
    name: "Dimas A.",
    username: "@dimasbeji",
    body: "“Saya biasanya baru tahu makanan surplus dari warung sekitar sudah hampir habis. Di ReBites saya bisa lihat duluan menu yang masih tersedia, jadi tidak perlu menebak-nebak.”",
    profile: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=128&h=128&q=80",
    role: "Pembeli — Beji, Kota Depok",
    audience: "Pembeli",
  },
  {
    name: "Sri Wahyuni",
    username: "@sriwarung",
    body: "“Kalau menjelang tutup masih ada nasi sisa, dulu saya bingung mau diapakan. Sekarang saya unggah dari pagi, dan biasanya habis sebelum jam tutup.”",
    profile: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=128&h=128&q=80",
    role: "Penjual nasi rumahan — Margonda, Kota Depok",
    audience: "UMKM",
  },
  {
    name: "Ananda P.",
    username: "@andpakukusan",
    body: "“Yang bikin saya balik bukan cuma harganya. Saya jadi tahu siapa yang masaknya, dan porsinya tetap seperti pesan langsung di tempatnya.”",
    profile: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=128&h=128&q=80",
    role: "Pembeli — Kukusan, Kota Depok",
    audience: "Pembeli",
  },
  {
    name: "Hendra S.",
    username: "@hendraroti",
    body: "“Dashboard-nya tidak bikin pusing: isi nama menu, harga, sisa stok. Pesanan masuk langsung kelihatan, jadi saya bisa siapkan tanpa bolak-balik cek HP.”",
    profile: "https://images.unsplash.com/photo-1500648767791-00dcc994a43?auto=format&fit=crop&w=128&h=128&q=80",
    role: "Penjual roti — Sawangan, Kota Depok",
    audience: "UMKM",
  },
  {
    name: "Sinta Maharani",
    username: "@sintasav",
    body: "“Pesanan sampai masih hangat dan porsinya sama seperti beli langsung di tempat. Harga surplusnya jujur, rasanya tetap sama seperti hari-hari biasa.”",
    profile: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=128&h=128&q=80",
    role: "Pembeli — Cimanggis, Kota Depok",
    audience: "Pembeli",
  },
  {
    name: "Laras Lestari",
    username: "@larasbakery",
    body: "“Roti sisa display pagi yang biasanya harus didiskon habis-habisan, sekarang bisa langsung masuk etalase ReBites. Lebih untung dan tidak ada yang terbuang.”",
    profile: "https://images.unsplash.com/photo-1544005313-4817aa6c0977?auto=format&fit=crop&w=128&h=128&q=80",
    role: "Penjual kue & roti — Depok Lama",
    audience: "UMKM",
  },
  {
    name: "Bima Giriyanti",
    username: "@bimagiri",
    body: "“Sejak pandemi saya tidak terlalu sering jajan di luar. Menemukan makanan layak dengan harga normal di ReBites benar-benar membantu sekali.”",
    profile: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=128&h=128&q=80",
    role: "Pembeli — Sawangan, Kota Depok",
    audience: "Pembeli",
  },
  {
    name: "Nisa Hidayah",
    username: "@nisatoko",
    body: "“Pesanan lumayan ramai menjelang tutup. Sistemnya sederhana, dan pelanggan senang karena bisa jajan sisa produksi dengan wajar dan murah.”",
    profile: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=128&h=128&q=80",
    role: "Pemilik kedai pisang — Beji, Kota Depok",
    audience: "UMKM",
  },
  {
    name: "Dewi Kurnia",
    username: "@dewiku",
    body: "“Hemat bukan berarti berkompromi. Saya dapat makanan gratis-ish bukan karena sisa yang jelek, tapi karena memang belum habis terjual di akhir hari.”",
    profile: "https://images.unsplash.com/photo-1494790108755-2616b612b47c?auto=format&fit=crop&w=128&h=128&q=80",
    role: "Pembeli — Pancoran Mas, Kota Depok",
    audience: "Pembeli",
  },
];

const ReviewCard = ({ profile, name, username, body, role, audience }: Review) => {
  return (
    <Card className="relative w-full max-w-sm cursor-pointer border border-border bg-white p-4 shadow-none">
      <CardContent className="flex flex-col gap-3 p-0">
        <div className="flex flex-row items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="h-9 w-9 rounded-full object-cover"
            width="36"
            height="36"
            loading="lazy"
            alt={name}
            src={profile}
          />
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {username}
              <span className="px-1.5 text-border">•</span>
              {role}
            </p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-accent px-2.5 py-1 font-secondary text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">
            {audience}
          </span>
        </div>
        <p className="text-[13px] leading-relaxed text-foreground/90">{body}</p>
      </CardContent>
    </Card>
  );
};

const VerticalMarqueeDemo = () => {
  return (
    <div className="relative flex h-[500px] w-full flex-row items-center justify-center overflow-hidden">
      <div className="flex h-full w-full flex-row items-center justify-center gap-4 px-4">
        <Marquee
          pauseOnHover
          vertical
          className="hidden h-full flex-1 sm:flex [--duration:24s]"
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
          className="hidden h-full flex-1 sm:flex [--duration:24s]"
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
          className="hidden h-full flex-1 lg:flex [--duration:24s]"
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
          className="flex h-full flex-1 sm:hidden [--duration:24s]"
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
