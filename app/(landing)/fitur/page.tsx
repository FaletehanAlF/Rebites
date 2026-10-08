import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  ClipboardList,
  CreditCard,
  Eye,
  LayoutGrid,
  Store,
  Truck,
  Upload,
  UserPlus,
} from 'lucide-react';
import { PublicShell } from '@/app/components/landing/public-shell';
import { PublicPageHero } from '@/app/components/landing/PublicPageHero';
import { ContactCTASection } from '@/app/components/landing/ContactCTASection';
import { Reveal } from '@/app/components/shared/reveal';

export const metadata: Metadata = {
  title: 'Fitur Unggulan - ReBites',
  description:
    'Apa yang bisa dilakukan pembeli dan UMKM di ReBites: menelusuri katalog surplus, memesan, mengunggah menu, dan memantau pesanan.',
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

type Capability = {
  icon: React.ElementType;
  title: string;
  description: string;
};

const BUYER_CAPABILITIES: Capability[] = [
  {
    icon: LayoutGrid,
    title: 'Telusuri per kategori',
    description:
      'Delapan kategori kuliner — dari makanan berat sampai minuman — bisa langsung dibuka tanpa perlu menebak-nebak.',
  },
  {
    icon: Eye,
    title: 'Bandingkan sebelum memesan',
    description:
      'Harga asli, harga surplus, sisa stok, rating, dan jarak penjual tampil di halaman detail sebelum kamu memutuskan.',
  },
  {
    icon: Store,
    title: 'Kenali tokonya',
    description:
      'Setiap penjual punya halaman tersendiri berisi menu yang ditawarkan dan informasi operasionalnya.',
  },
  {
    icon: Truck,
    title: 'Pilih cara penerimaan',
    description:
      'Diantar ke alamatmu atau ambil sendiri langsung di lokasi penjual — keduanya dipilih saat checkout.',
  },
  {
    icon: CreditCard,
    title: 'Bayar dan ikuti pesanan',
    description:
      'Pembayaran diproses secara online, dan status pesanan bisa diikuti sampai selesai.',
  },
  {
    icon: ClipboardList,
    title: 'Simpan riwayat & kabar',
    description:
      'Riwayat pesanan dan pemberitahuan tersedia di akunmu kapan pun kamu butuhkan.',
  },
];

const SELLER_CAPABILITIES: Capability[] = [
  {
    icon: UserPlus,
    title: 'Daftarkan usahamu',
    description:
      'Buat akun penjual, lengkapi profil usaha, dan atur jam operasional toko.',
  },
  {
    icon: Upload,
    title: 'Tawarkan makanan surplus',
    description:
      'Unggah menu beserta harga, diskon, sisa stok, dan waktu penjualannya.',
  },
  {
    icon: ClipboardList,
    title: 'Kelola pesanan dalam satu tempat',
    description:
      'Pesanan masuk, diproses, dan ditandai selesai dari dashboard penjual.',
  },
  {
    icon: BarChart3,
    title: 'Pantau performa dan ulasan',
    description:
      'Lihat ringkasan penjualan, performa toko, dan baca ulasan dari pembeli.',
  },
  {
    icon: Bell,
    title: 'Dapat kabar lebih dulu',
    description:
      'Pesanan dan aktivitas toko muncul di notifikasi penjual tanpa perlu memeriksa manual.',
  },
  {
    icon: CreditCard,
    title: 'Atur kapasitas lewat paket',
    description:
      'Jumlah produk yang bisa ditampilkan mengikuti paket langganan yang kamu pilih.',
  },
];

function CapabilityGrid({ items }: { items: Capability[] }) {
  return (
    <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <Reveal
            key={item.title}
            as="li"
            delay={Math.min(index, 5) * 0.05}
            className="border-t border-border pt-5"
          >
            <span
              aria-hidden
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-accent text-primary"
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold tracking-tight text-primary sm:text-lg">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-[1.75] text-muted-foreground">
              {item.description}
            </p>
          </Reveal>
        );
      })}
    </ul>
  );
}

export default function FiturPage() {
  return (
    <PublicShell>
      <PublicPageHero
        eyebrow="Fitur Unggulan"
        title={
          <>
            Satu marketplace,{' '}
            <span className="font-light italic">dua peran.</span>
          </>
        }
        lead="ReBites mempertemukan pembeli yang mencari makanan terjangkau dengan UMKM yang punya makanan surplus. Berikut yang benar-benar bisa dilakukan masing-masing sisi hari ini."
      />

      {/* Pembeli */}
      <section
        id="pembeli"
        aria-labelledby="buyer-heading"
        className="bg-white"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <Reveal>
            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
              <div>
                <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Untuk pembeli
                </p>
                <h2
                  id="buyer-heading"
                  className="mt-4 text-balance font-display text-[clamp(1.75rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary"
                >
                  Temukan, bandingkan,{' '}
                  <span className="font-light italic">lalu pesan.</span>
                </h2>
              </div>
              <div className="lg:pb-1">
                <p className="max-w-xl text-[15px] leading-[1.8] text-muted-foreground">
                  Semua informasi yang kamu butuhkan untuk memutuskan sudah
                  terlihat sebelum memesan — bukan setelah makanannya tiba.
                </p>
                <Link
                  href="/home"
                  className={`group mt-4 inline-flex min-h-[40px] items-center gap-1.5 font-secondary text-sm font-semibold text-primary ${FOCUS_RING}`}
                >
                  Mulai jelajahi
                  <ArrowUpRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </div>
            </div>
          </Reveal>

          <CapabilityGrid items={BUYER_CAPABILITIES} />
        </div>
      </section>

      {/* UMKM */}
      <section
        id="umkm"
        aria-labelledby="seller-heading"
        className="grain-overlay bg-secondary"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <Reveal>
            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
              <div>
                <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Untuk UMKM
                </p>
                <h2
                  id="seller-heading"
                  className="mt-4 text-balance font-display text-[clamp(1.75rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary"
                >
                  Dari menu tersisa{' '}
                  <span className="font-light italic">jadi pesanan.</span>
                </h2>
              </div>
              <div className="lg:pb-1">
                <p className="max-w-xl text-[15px] leading-[1.8] text-muted-foreground">
                  Membuka toko tidak butuh persiapan panjang. Setelah profil
                  usaha lengkap, menu surplus bisa langsung ditawarkan ke
                  pembeli di sekitar Depok.
                </p>
                <Link
                  href="/auth/register/penjual"
                  className={`group mt-4 inline-flex min-h-[40px] items-center gap-1.5 font-secondary text-sm font-semibold text-primary ${FOCUS_RING}`}
                >
                  Daftar sebagai penjual
                  <ArrowUpRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </div>
            </div>
          </Reveal>

          <CapabilityGrid items={SELLER_CAPABILITIES} />

          <Reveal delay={0.05}>
            <p className="mt-10 max-w-3xl border-t border-border pt-6 text-sm leading-[1.75] text-muted-foreground">
              Jumlah produk yang dapat ditampilkan mengikuti{' '}
              <Link
                href="/#langganan"
                className={`font-medium text-primary underline underline-offset-4 hover:text-primary-dark ${FOCUS_RING}`}
              >
                paket membership penjual
              </Link>
              .
            </p>
          </Reveal>
        </div>
      </section>

      <ContactCTASection />
    </PublicShell>
  );
}
