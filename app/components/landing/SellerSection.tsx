import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ClipboardList,
  CreditCard,
  Star,
  Store,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';

const CAPABILITIES = [
  {
    icon: UtensilsCrossed,
    title: 'Kelola menu & stok',
    description: 'Tambah, ubah, dan nonaktifkan menu surplus beserta sisa stoknya.',
  },
  {
    icon: Store,
    title: 'Atur profil & jam toko',
    description: 'Nama usaha, logo, dan jam operasional tampil apa adanya ke pembeli.',
  },
  {
    icon: ClipboardList,
    title: 'Terima pesanan masuk',
    description: 'Pantau pesanan yang sedang disiapkan, siap diambil, atau diantar.',
  },
  {
    icon: Star,
    title: 'Baca ulasan pembeli',
    description: 'Lihat penilaian dan komentar setiap pesanan yang selesai.',
  },
  {
    icon: TrendingUp,
    title: 'Pantau performa penjualan',
    description: 'Ringkasan penjualan membantu kamu mengambil keputusan lebih cepat.',
  },
  {
    icon: CreditCard,
    title: 'Pilih paket langganan',
    description: 'Mulai dari Basic, lalu naik tier saat usahamu makin ramai.',
  },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function SellerSection() {
  return (
    <section
      id="umkm"
      aria-labelledby="seller-heading"
      className="grain-overlay bg-secondary"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <Reveal>
              <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Untuk pelaku UMKM
              </p>
              <h2
                id="seller-heading"
                className="mt-4 text-balance font-display text-[clamp(1.8rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary"
              >
                Surplus yang tadinya{' '}
                <span className="font-light italic">terbuang</span>, kembali
                bernilai rupiah.
              </h2>
              <p className="mt-5 max-w-xl text-[15px] leading-[1.8] text-muted-foreground">
                Daftarkan usahamu, lengkapi profil, lalu unggah makanan surplus
                beserta harga, stok, dan waktu penjualannya. Sisanya biar ReBites
                yang bawa ke pembeli di sekitarmu.
              </p>
            </Reveal>

            <ul className="mt-9 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {CAPABILITIES.map((item, index) => (
                <Reveal
                  as="li"
                  key={item.title}
                  delay={0.04 + index * 0.04}
                  className="list-none"
                >
                  <div className="flex gap-3.5">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-white text-primary"
                    >
                      <item.icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-semibold tracking-tight text-primary">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-[1.7] text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>

            <Reveal delay={0.1}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Link
                  href="/auth/register/penjual"
                  className={`group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 font-secondary text-sm font-semibold text-white transition-colors duration-300 hover:bg-primary-dark ${FOCUS_RING}`}
                >
                  Daftar sebagai penjual
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden
                  />
                </Link>
                <Link
                  href="/auth/login/penjual"
                  className={`inline-flex items-center justify-center gap-2 rounded-full border border-border px-7 py-3.5 font-secondary text-sm font-semibold text-primary transition-colors duration-300 hover:border-primary hover:bg-white ${FOCUS_RING}`}
                >
                  Masuk ke dashboard
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="relative">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] border border-border bg-muted shadow-[0_40px_80px_-56px_rgba(27,77,50,0.7)] sm:rounded-[2.5rem]">
                <Image
                  src="/makanan14.jpg"
                  alt="Pelaku UMKM menyiapkan hasil produksi makanan untuk dijual"
                  fill
                  sizes="(min-width: 1024px) 34rem, calc(100vw - 2rem)"
                  className="object-cover"
                />
              </div>
            </div>
          </Reveal>
        </div>

        {/* Paket langganan — anchor `#langganan` dipakai oleh footer dan
            halaman sukses langganan, jadi tetap dipertahankan. */}
        <span id="langganan" aria-hidden className="block h-px w-full" />

        <div className="mt-16 border-t border-border pt-10 sm:mt-20 sm:pt-12">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Paket langganan penjual
                </p>
                <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-primary sm:text-2xl">
                  Mulai gratis, kembangkan saat siap.
                </h3>
              </div>
              <p className="max-w-sm text-sm leading-[1.75] text-muted-foreground">
                Pembeli tidak dikenakan biaya langganan. Hanya penjual yang
                memilih paket sesuai kebutuhan usahanya.
              </p>
            </div>
          </Reveal>

          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {SUBSCRIPTION_PLANS.map((plan, index) => (
              <Reveal
                as="li"
                key={plan.slug}
                delay={0.05 + index * 0.06}
                className="list-none"
              >
                <div className="flex h-full flex-col rounded-2xl border border-border bg-white p-6 transition-colors duration-300 hover:border-primary/50">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-display text-base font-semibold tracking-tight text-primary">
                      ReBites {plan.name}
                    </h4>
                    {plan.popular && (
                      <span className="rounded-full bg-primary px-2.5 py-1 font-secondary text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                        Populer
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {plan.tagline}
                  </p>

                  <p className="mt-5 flex items-baseline gap-1 text-primary">
                    <span className="font-display text-2xl font-bold tracking-tight tabular-nums">
                      {plan.monthly === 0
                        ? 'Gratis'
                        : `Rp${plan.monthly.toLocaleString('id-ID')}`}
                    </span>
                    {plan.monthly > 0 && (
                      <span className="font-secondary text-xs text-muted-foreground">
                        /bulan
                      </span>
                    )}
                  </p>

                  <ul className="mt-5 space-y-2 border-t border-border pt-5">
                    {plan.features.slice(0, 3).map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm leading-snug text-muted-foreground"
                      >
                        <span
                          aria-hidden
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`/auth/register/penjual?plan=${plan.slug}&billing=monthly`}
                    className={`mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full border border-primary/30 font-secondary text-sm font-semibold text-primary transition-colors duration-300 hover:bg-primary hover:text-white ${FOCUS_RING}`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
