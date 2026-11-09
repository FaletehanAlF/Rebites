import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { Lottie } from 'lottie-react';
import { PublicShell } from '@/app/components/landing/public-shell';
import { SectionHeading } from '@/app/components/landing/SectionHeading';
import { ContactCTASection } from '@/app/components/landing/ContactCTASection';
import { Reveal } from '@/app/components/shared/reveal';

export const metadata: Metadata = {
  title: 'Fitur Unggulan - ReBites',
  description:
    'Apa yang bisa dilakukan pembeli dan UMKM di ReBites: menelusuri katalog surplus, memesan, mengunggah menu, dan memantau pesanan.',
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

type Task = {
  title: string;
  description: string;
};

const BUYER_TASKS: Task[] = [
  {
    title: 'Telusuri kategori dan toko',
    description:
      'Delapan kategori kuliner — dari makanan berat sampai minuman — bisa langsung dibuka. Setiap penjual punya halaman sendiri berisi menu yang ditawarkan dan informasi operasionalnya.',
  },
  {
    title: 'Bandingkan sebelum memesan',
    description:
      'Harga asli, harga surplus, sisa stok, rating, dan jarak penjual tampil di halaman detail, jadi keputusan diambil sebelum makanannya tiba.',
  },
  {
    title: 'Pesan dan ikuti sampai selesai',
    description:
      'Pilih diantar ke alamatmu atau ambil sendiri di lokasi penjual, selesaikan pembayaran secara online, lalu ikuti status pesanan beserta riwayat dan pemberitahuannya.',
  },
];

const SELLER_TASKS: Task[] = [
  {
    title: 'Daftarkan usahamu',
    description:
      'Buat akun penjual, lengkapi profil usaha, dan atur jam operasional toko. Setelah itu barulah mulai menawarkan menu ke pembeli di sekitar Depok.',
  },
  {
    title: 'Tawarkan makanan surplus',
    description:
      'Unggah menu beserta harga, diskon, sisa stok, dan waktu penjualannya, supaya pembeli tahu persis apa yang tersedia hari itu.',
  },
  {
    title: 'Kelola pesanan dan performa',
    description:
      'Pesanan masuk, diproses, dan ditandai selesai dari satu dashboard. Lihat ringkasan penjualan serta ulasan pembeli, dan dapatkan kabar lewat notifikasi penjual.',
  },
];

function TaskList({ items }: { items: Task[] }) {
  return (
    <ol className="space-y-6">
      {items.map((item, index) => (
        <Reveal
          key={item.title}
          as="li"
          delay={index * 0.06}
          className="flex items-start gap-4 border-b border-border pb-6 sm:gap-6"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-secondary text-sm font-bold text-primary">
            0{index + 1}
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {item.title}
            </h3>

            <p className="mt-2 max-w-2xl text-sm leading-[1.75] text-muted-foreground">
              {item.description}
            </p>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}


function LottieIllustration({
  src,
  label,
}: {
  src: string;
  label: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden sm:aspect-[3/2] lg:aspect-[4/5]"
    >
      <Lottie
        src={src}
        autoplay
        loop
        className="h-auto w-full"
      />
    </div>
  );
}

export default function FiturPage() {
  return (
    <PublicShell>
      {/* Pembeli */}
      <section
        id="pembeli"
        aria-labelledby="buyer-heading"
        className="bg-background"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="buyer-heading"
            heading="Makan enak, hemat, dan minim sisa."
            description="Semua pilihan kuliner surplus di sekitarmu terangkum dalam satu tempat. Cari, bandingkan, lalu pesan sebelum kehabisan."
          />

          <div className="mt-10 grid gap-10 sm:mt-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-14">
            <TaskList items={BUYER_TASKS} />

            <Reveal delay={0.08}>
              <div className="mx-auto w-full max-w-xl lg:max-w-none lg:scale-110">
                <LottieIllustration
                  src="/lottie_animation/blocks.json"
                  label="Ilustrasi pengalaman pembeli ReBites"
                />
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.05}>
            <div className="mt-8 pt-6">
              <Link
                href="/home"
                className={`group inline-flex min-h-[40px] items-center gap-1.5 font-secondary text-sm font-semibold text-primary ${FOCUS_RING}`}
              >
                Mulai jelajahi katalog
                <ArrowUpRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* UMKM */}
      <section
        id="umkm"
        aria-labelledby="seller-heading"
        className="bg-white"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="seller-heading"
            heading="Dari menu tersisa jadi pesanan."
            description="Membuka toko tidak butuh persiapan panjang. Setelah profil usaha lengkap, menu surplus bisa langsung ditawarkan ke pembeli di sekitar Depok."
          />

          <div className="mt-10 grid gap-10 sm:mt-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-14">
            <div className="origin-top-left scale-125 sm:scale-110 lg:scale-100">
              <Reveal>
                <LottieIllustration
                  src="/lottie_animation/toko.json"
                  label="Ilustrasi UMKM menawarkan makanan surplus"
                />
              </Reveal>
            </div>

            <div>
              <TaskList items={SELLER_TASKS} />

              <Reveal delay={0.05}>
                <p className="mt-6 text-sm leading-[1.75] text-muted-foreground">
                  Jumlah produk yang dapat ditampilkan mengikuti{' '}
                  <Link
                    href="/#langganan"
                    className={`font-medium text-primary underline underline-offset-4 hover:text-primary-dark ${FOCUS_RING}`}
                  >
                    paket membership penjual
                  </Link>
                  .
                </p>

                <div className="mt-6 pt-6">
                  <Link
                    href="/auth/register/penjual"
                    className={`group inline-flex min-h-[40px] items-center gap-1.5 font-secondary text-sm font-semibold text-primary ${FOCUS_RING}`}
                  >
                    Daftar sebagai penjual
                    <ArrowUpRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <ContactCTASection />
    </PublicShell>
  );
}