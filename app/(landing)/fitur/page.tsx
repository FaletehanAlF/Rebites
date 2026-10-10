import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { PublicShell } from '@/app/components/landing/public-shell';
import { PageIntro } from '@/app/components/landing/PageIntro';
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
    <ol className="">
      {items.map((item, index) => (
        <Reveal
          key={item.title}
          as="li"
          delay={index * 0.06}
          className="flex items-start gap-4 border-b border-border py-6 sm:gap-6"
        >
          <span className="mt-1 shrink-0 font-display text-xs font-semibold tabular-nums tracking-[0.16em] text-primary">
            0{index + 1}
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold tracking-tight text-primary sm:text-xl">
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

/**
 * `/fitur` — dua kelompok kemampuan yang benar-benar tersedia hari ini
 * (id `pembeli` dan `umkm` dipakai footer aplikasi, jangan diubah).
 * Tiap kelompok disusun sebagai daftar tugas pengguna berdampingan dengan
 * satu foto hidangan, bukan grid kartu berikon.
 */
export default function FiturPage() {
  return (
    <PublicShell>

      {/* Pembeli */}
      <section id="pembeli" aria-labelledby="buyer-heading" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="buyer-heading"
            heading="Temukan, bandingkan, lalu pesan."
            description="Semua informasi yang kamu butuhkan untuk memutuskan sudah terlihat sebelum memesan — bukan setelah makanannya tiba."
          />

          <div className="mt-10 grid gap-10 sm:mt-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-14">
            <TaskList items={BUYER_TASKS} />

            <Reveal delay={0.08}>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border/70 bg-muted sm:aspect-[3/2] lg:aspect-[4/5]">
                <Image
                  src="/hero-makanan.jpeg"
                  alt="Aneka hidangan dari pelaku UMKM yang dijual melalui ReBites"
                  fill
                  sizes="(min-width: 1024px) 22rem, calc(100vw - 2rem)"
                  className="object-cover"
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
                  aria-hidden
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
            <Reveal>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border/70 bg-muted sm:aspect-[3/2] lg:aspect-[4/5]">
                <Image
                  src="/terselamatkan.jpg"
                  alt="Aneka hidangan dari dapur UMKM yang siap dinikmati pembeli"
                  fill
                  sizes="(min-width: 1024px) 22rem, calc(100vw - 2rem)"
                  className="object-cover"
                />
              </div>
            </Reveal>

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
                      aria-hidden
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
