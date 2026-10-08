import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Check, ShoppingBag, Store } from 'lucide-react';
import { PublicShell } from '@/app/components/landing/public-shell';
import { PublicPageHero } from '@/app/components/landing/PublicPageHero';
import { ContactCTASection } from '@/app/components/landing/ContactCTASection';
import { Reveal } from '@/app/components/shared/reveal';

export const metadata: Metadata = {
  title: 'Tentang Kami - ReBites',
  description:
    'Kenapa ReBites dibuat, masalah apa yang coba dipecahkan, dan bagaimana ReBites mempertemukan UMKM dengan pembeli di Kota Depok.',
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const FOCUS_RING_ON_GREEN =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary';

const PROBLEMS = [
  {
    title: 'Makanan surplus tidak terserap',
    description:
      'Kelebihan produksi atau menu yang belum habis terjual sering berakhir jadi limbah dapur sebelum sempat dinikmati.',
  },
  {
    title: 'UMKM kehilangan potensi pendapatan',
    description:
      'Menu yang tidak terjual lenyap bersama cuan yang seharusnya bisa didapat dari makanan yang sama.',
  },
  {
    title: 'Pembeli mencari makanan terjangkau',
    description:
      'Kualitas jarang jadi masalah — harga yang membatasi. Padahal makanan yang sama masih layak disantap.',
  },
];

const ECOSYSTEM = [
  'UMKM',
  'Makanan surplus',
  'ReBites',
  'Pembeli',
  'Makanan terselamatkan',
];

const BUYER_POINTS = [
  'Harga surplus yang jelas sebelum kamu memesan',
  'Diantar ke tempatmu atau ambil sendiri di penjual',
  'Tanpa biaya langganan untuk pembeli',
];

const SELLER_POINTS = [
  'Unggah menu surplus dalam beberapa menit',
  'Jangkau pembeli baru di sekitar Depok',
  'Pantau pesanan dan performa penjualan',
];

export default function TentangKamiPage() {
  return (
    <PublicShell>
      <PublicPageHero
        eyebrow="Tentang Kami"
        title={
          <>
            Setiap makanan yang terselamatkan{' '}
            <span className="font-light italic">punya cerita.</span>
          </>
        }
        lead="ReBites lahir dari satu kejadian yang terjadi hampir setiap hari: makanan yang masih layak konsumsi berakhir terbuang, sementara orang di sekitarnya sedang mencari makanan dengan harga yang masuk akal."
      />

      {/* Cerita */}
      <section aria-labelledby="story-heading" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-16">
            <Reveal>
              <div>
                <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Ceritanya
                </p>
                <h2
                  id="story-heading"
                  className="mt-4 text-balance font-display text-[clamp(1.75rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary"
                >
                  Makanan yang masih bagus{' '}
                  <span className="font-light italic">berakhir sia-sia.</span>
                </h2>

                <div className="mt-5 space-y-4 text-[15px] leading-[1.8] text-muted-foreground">
                  <p>
                    Setiap hari dapur UMKM menyiapkan lebih banyak makanan
                    daripada yang bisa terjual. Menjelang tutup, porsi yang
                    tersisa sering tidak punya pilihan selain dibuang —
                    padahal tidak ada yang salah dengan makanan itu.
                  </p>
                  <p>
                    Di sisi yang sama ada orang yang mencari makanan dengan
                    harga masuk akal. Mereka tidak saling kenal, dan tidak
                    ada tempat yang mempertemukan keduanya.
                  </p>
                  <p>
                    ReBites dibuat untuk menjadi jembatan itu: satu tempat
                    di mana makanan surplus dilihat sebagai kesempatan, bukan
                    sebagai sisa.
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted sm:aspect-[4/3] lg:aspect-[3/4]">
                <Image
                  src="/penerimaan.jpg"
                  alt="Paket makanan diserahkan dari penjual kepada pembeli"
                  fill
                  sizes="(min-width: 1024px) 26rem, calc(100vw - 2rem)"
                  className="object-cover"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Masalah */}
      <section aria-labelledby="problem-heading" className="grain-overlay bg-secondary">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <Reveal>
            <div className="max-w-2xl">
              <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Masalahnya
              </p>
              <h2
                id="problem-heading"
                className="mt-4 text-balance font-display text-[clamp(1.75rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary"
              >
                Makanan yang tidak terjual hari ini{' '}
                <span className="font-light italic">belum tentu</span> harus
                menjadi sampah.
              </h2>
            </div>
          </Reveal>

          <ol className="mt-10 border-t border-border">
            {PROBLEMS.map((problem, index) => (
              <Reveal
                key={problem.title}
                as="li"
                delay={index * 0.05}
                className="flex items-start gap-4 border-b border-border py-5 sm:gap-6 sm:py-6"
              >
                <span className="mt-1 font-display text-xs font-semibold tabular-nums tracking-[0.16em] text-primary">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="font-display text-base font-semibold tracking-tight text-primary sm:text-lg">
                    {problem.title}
                  </h3>
                  <p className="mt-1.5 max-w-2xl text-sm leading-[1.75] text-muted-foreground">
                    {problem.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Pendekatan */}
      <section
        aria-labelledby="approach-heading"
        className="grain-overlay bg-primary text-primary-foreground"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:gap-16">
            <Reveal>
              <div>
                <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/70">
                  Cara kami menyikapinya
                </p>
                <h2
                  id="approach-heading"
                  className="mt-4 text-balance font-display text-[clamp(1.75rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white"
                >
                  ReBites menghubungkan{' '}
                  <span className="font-light italic">keduanya.</span>
                </h2>
                <p className="mt-5 max-w-xl text-[15px] leading-[1.8] text-white/70">
                  ReBites tidak memasak, tidak menyimpan, dan tidak
                  mengantar-sendiri. Perannya satu: mempertemukan makanan
                  surplus dengan orang yang membutuhkannya, lalu memastikan
                  informasinya jelas sebelum transaksi terjadi.
                </p>
                <p className="mt-6 max-w-xl border-t border-white/20 pt-5 text-sm leading-[1.75] text-white/70">
                  Satu pesanan menjaga makanan tetap berakhir di piring —
                  bukan di tempat sampah.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <ol className="rounded-[1.75rem] border border-white/20 bg-white/10 p-6 sm:p-8">
                {ECOSYSTEM.map((step, index) => {
                  const isLast = index === ECOSYSTEM.length - 1;
                  return (
                    <li key={step} className="flex gap-3.5">
                      <div className="flex flex-col items-center">
                        <span
                          aria-hidden
                          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                            isLast ? 'bg-white' : 'border border-white/50'
                          }`}
                        />
                        {!isLast && (
                          <span
                            aria-hidden
                            className="w-px flex-1 bg-white/20"
                          />
                        )}
                      </div>
                      <p
                        className={`flex-1 pt-0.5 text-sm leading-relaxed ${
                          isLast
                            ? 'font-semibold text-white'
                            : 'pb-5 text-white/70'
                        }`}
                      >
                        {step}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Ekosistem */}
      <section aria-labelledby="ecosystem-heading" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <Reveal>
            <div className="max-w-2xl">
              <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Untuk siapa
              </p>
              <h2
                id="ecosystem-heading"
                className="mt-4 text-balance font-display text-[clamp(1.75rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary"
              >
                Dua sisi,{' '}
                <span className="font-light italic">satu tujuan yang sama.</span>
              </h2>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:gap-5 lg:grid-cols-2">
            <Reveal delay={0.05}>
              <div className="flex h-full flex-col rounded-[1.75rem] border border-border bg-secondary p-6 sm:p-8">
                <span
                  aria-hidden
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-white text-primary"
                >
                  <ShoppingBag className="h-5 w-5" strokeWidth={2} />
                </span>
                <p className="mt-5 font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Untuk pembeli
                </p>
                <h3 className="mt-2.5 font-display text-xl font-semibold tracking-tight text-primary sm:text-2xl">
                  Makanan berkualitas dengan harga lebih hemat.
                </h3>
                <ul className="mt-5 space-y-3">
                  {BUYER_POINTS.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2.5 text-sm leading-[1.7] text-muted-foreground"
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-primary"
                      >
                        <Check className="h-3 w-3" strokeWidth={3.25} />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/home"
                  className={`group mt-7 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary px-7 font-secondary text-sm font-semibold text-white transition-colors duration-300 hover:bg-primary-dark sm:self-start ${FOCUS_RING}`}
                >
                  Temukan Makanan
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden
                  />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="flex h-full flex-col rounded-[1.75rem] bg-primary p-6 text-primary-foreground sm:p-8">
                <span
                  aria-hidden
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10"
                >
                  <Store className="h-5 w-5" strokeWidth={2} />
                </span>
                <p className="mt-5 font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                  Untuk UMKM
                </p>
                <h3 className="mt-2.5 font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  Ubah makanan surplus menjadi peluang pendapatan.
                </h3>
                <ul className="mt-5 space-y-3">
                  {SELLER_POINTS.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2.5 text-sm leading-[1.7] text-white/70"
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
                      >
                        <Check className="h-3 w-3" strokeWidth={3.25} />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/register/penjual"
                  className={`group mt-7 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-white px-7 font-secondary text-sm font-semibold text-primary transition-colors duration-300 hover:bg-secondary sm:self-start ${FOCUS_RING_ON_GREEN}`}
                >
                  Gabung sebagai UMKM
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden
                  />
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.05}>
            <p className="mt-8 max-w-3xl text-[15px] leading-[1.8] text-muted-foreground">
              Arahnya sederhana: makanan yang masih layak konsumsi berakhir
              di piring, dan setiap pihak yang terlibat mendapat bagiannya
              sendiri.
            </p>
          </Reveal>
        </div>
      </section>

      <ContactCTASection />
    </PublicShell>
  );
}
