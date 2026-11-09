import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Check, Eye, ListChecks } from 'lucide-react';
import { PublicShell } from '@/app/components/landing/public-shell';
import { PageIntro } from '@/app/components/landing/PageIntro';
import { SectionHeading } from '@/app/components/landing/SectionHeading';
import { ContactCTASection } from '@/app/components/landing/ContactCTASection';
import { Reveal } from '@/app/components/shared/reveal';
import TeamLanyardRail from '@/app/components/landing/team-lanyard-rail';
import { LANYARD_DEMO_TEAM } from './lanyard-demo-team';

export const metadata: Metadata = {
  title: 'Tentang Kami - ReBites',
  description:
    'Kenapa ReBites dibuat, masalah apa yang coba dipecahkan, dan bagaimana ReBites mempertemukan UMKM dengan pembeli di Kota Depok.',
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const MISSIONS = [
  'Menghubungkan UMKM dan konsumen untuk menyalurkan makanan surplus berkualitas dengan harga terjangkau.',
  'Membantu UMKM mengubah potensi limbah menjadi pendapatan.',
  'Mengedukasi masyarakat tentang dampak food loss dan food waste bagi lingkungan dan ekonomi.',
  'Membangun ekosistem pangan yang berkelanjutan dan inklusif di Indonesia.',
];

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
      <PageIntro
        title="Tentang ReBites"
        lead="ReBites lahir dari satu pertanyaan sederhana: apa yang terjadi pada makanan yang masih layak tetapi tidak terjual?"
      />

      {/* Visi & Misi */}
      <section
        id="visi-misi"
        aria-labelledby="visi-misi-heading"
        className="border-t border-border bg-white scroll-mt-20"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="visi-misi-heading"
            heading="Visi dan misi kami."
            description="ReBites tidak ingin menjadi marketplace besar — kami ingin menjadi platform yang benar-benar menyelesaikan masalah food waste di satu kota, dengan cara yang berkelanjutan."
          />

          <div className="mt-10 grid gap-10 sm:mt-12 lg:grid-cols-2 lg:gap-14">
            <Reveal>
              <div className="relative">
                <Eye className="h-5 w-5 text-primary" aria-hidden />
                <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Visi
                </p>
                <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  Satu tempat untuk makanan surplus di Kota Depok.
                </h3>
                <p className="mt-3 text-[15px] leading-[1.8] text-muted-foreground">
                  Menjadi platform lokal yang mempertemukan dapur UMKM
                  dengan pembeli secara langsung, sehingga tidak ada
                  lagi porsi makanan berkualitas yang terbuang sia-sia.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.06}>
              <div className="relative">
                <ListChecks className="h-5 w-5 text-primary" aria-hidden />
                <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Misi
                </p>
                <ul className="mt-4 space-y-3">
                  {MISSIONS.map((mission) => (
                    <li
                      key={mission}
                      className="flex items-start gap-2.5 text-sm leading-[1.7] text-muted-foreground"
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-primary"
                      >
                        <Check className="h-3 w-3" strokeWidth={3.25} />
                      </span>
                      {mission}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section aria-labelledby="problem-heading" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="problem-heading"
            heading="Makanan yang masih bagus berakhir sia-sia."
            description="Setiap hari dapur UMKM menyiapkan lebih banyak makanan daripada yang bisa terjual. Menjelang tutup, porsi yang tersisa sering tidak punya pilihan selain dibuang — padahal tidak ada yang salah dengan makanan itu."
          />

          <ol className="mt-10 grid gap-x-10 gap-y-8 pt-8 sm:mt-12 sm:grid-cols-3">
            {PROBLEMS.map((problem, index) => (
              <Reveal
                key={problem.title}
                as="li"
                delay={Math.min(index, 2) * 0.06}
              >
                <span className="font-display text-xs font-semibold tabular-nums tracking-[0.16em] text-primary">
                  0{index + 1}
                </span>
                <h3 className="mt-3 font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  {problem.title}
                </h3>
                <p className="mt-2 text-sm leading-[1.75] text-muted-foreground">
                  {problem.description}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="approach-heading" className="border-t border-border bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="approach-heading"
            heading="ReBites menghubungkan keduanya."
            description="ReBites tidak memasak, tidak menyimpan, dan tidak mengantar-sendiri. Perannya satu: mempertemukan makanan surplus dengan orang yang membutuhkannya, lalu memastikan informasinya jelas sebelum transaksi terjadi."
          />

          <div className="mt-10 grid gap-10 sm:mt-12 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-16">
            <Reveal>
              <div className="space-y-4 text-[15px] leading-[1.8] text-muted-foreground">
                <p>
                  Di satu sisi ada dapur UMKM yang setiap hari memproduksi
                  makanan melebihi yang bisa habis terjual. Di sisi lain ada
                  orang yang sedang mencari makanan dengan harga masuk akal.
                  Keduanya berada di wilayah yang sama, tetapi tidak saling
                  kenal.
                </p>
                <p>
                  ReBites dibuat untuk menjadi jembatan itu: satu tempat di
                  mana makanan surplus dilihat sebagai kesempatan, bukan sebagai
                  sisa. Harga, sisa stok, dan cara penerimaan ditampilkan
                  sebelum pembeli memutuskan.
                </p>
                <p className="pt-5 text-sm leading-[1.75]">
                  Satu pesanan menjaga makanan tetap berakhir di piring — bukan
                  di tempat sampah.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border/70 bg-muted sm:aspect-[3/2] lg:aspect-[4/5]">
                <Image
                  src="/penerimaan.avif"
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

      <section aria-labelledby="value-heading" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="value-heading"
            heading="Dua sisi, satu tujuan yang sama."
            description="Pembeli dan UMKM memperoleh hal yang berbeda dari satu pesanan yang sama, dan lingkungan di sekitarnya ikut merasakan dampaknya."
          />

          <div className="mt-10 grid gap-x-10 gap-y-8 pt-8 sm:mt-12 lg:grid-cols-2">
            <Reveal>
              <div>
                <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Untuk pembeli
                </p>
                <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
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
              </div>
            </Reveal>

            <Reveal delay={0.06}>
              <div>
                <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Untuk UMKM
                </p>
                <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  Ubah makanan surplus menjadi peluang pendapatan.
                </h3>
                <ul className="mt-5 space-y-3">
                  {SELLER_POINTS.map((point) => (
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
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.05}>
            <div className="mt-8 grid gap-3 pt-6 lg:grid-cols-[0.25fr_0.75fr] lg:gap-10">
              <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Untuk lingkungan
              </p>
              <p className="max-w-3xl text-[15px] leading-[1.8] text-muted-foreground">
                Setiap porsi yang berpindah tangan adalah satu porsi lebih
                sedikit yang berakhir di tempat sampah. ReBites tidak menjanjikan
                angka besar — yang kami kejar adalah kebiasaan kecil yang
                berulang setiap hari di satu kota yang sama.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="mt-8 flex flex-col gap-4 pt-8 sm:flex-row sm:items-center sm:gap-6">
              <Link
                href="/home"
                className={`group inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-primary px-7 font-secondary text-sm font-semibold text-white transition-colors duration-300 hover:bg-primary-dark sm:w-fit ${FOCUS_RING}`}
              >
                Temukan Makanan
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none"
                  aria-hidden
                />
              </Link>

              <Link
                href="/auth/register/penjual"
                className={`group inline-flex min-h-[44px] items-center justify-center gap-1.5 font-secondary text-sm font-semibold text-primary sm:justify-start ${FOCUS_RING}`}
              >
                Gabung sebagai UMKM
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none"
                  aria-hidden
                />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section
        id="tim-leadership"
        aria-labelledby="team-heading"
        className="border-t border-border bg-white scroll-mt-20"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="team-heading"
            heading="Tim di balik ReBites."
            description="Tiga orang yang membangun ReBites mulai dari ide, desain, hingga kode. Klik kartu untuk melihat detail dan kontak masing-masing."
          />
          <Reveal delay={0.05}>
            <div className="mt-10 sm:mt-12">
              <TeamLanyardRail
                items={LANYARD_DEMO_TEAM}
                caption="Pilih satu kartu untuk melihat detail tim"
                autoplay
                interval={3200}
                labels={{
                  flip: 'Klik atau tekan Enter untuk membalik kartu',
                  back: 'Klik lagi atau tekan Esc untuk mengembalikan',
                  show: 'Tampilkan',
                }}
              />
            </div>
          </Reveal>
        </div>
      </section>

      <ContactCTASection />
    </PublicShell>
  );
}
