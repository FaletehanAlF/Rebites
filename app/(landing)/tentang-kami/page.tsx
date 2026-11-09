import type { Metadata } from 'next';
import { Check, Eye, ListChecks } from 'lucide-react';
import { LandingNavbar } from '@/app/components/landing/LandingNavbar';
import { LandingFooter } from '@/app/components/landing/LandingFooter';
import TeamLanyardRail from '@/app/components/landing/team-lanyard-rail';
import { Reveal } from '@/app/components/shared/reveal';
import { LANYARD_DEMO_TEAM } from './lanyard-demo-team';
import { FinalCTASection } from '@/app/components/landing/FinalCTASection';

export const metadata: Metadata = {
  title: 'Tentang Kami - ReBites',
  description:
    'Mengenal ReBites: marketplace makanan surplus dari UMKM untuk mengurangi food loss dan food waste di Indonesia.',
};

const MISSIONS = [
  'Menghubungkan UMKM dan konsumen untuk menyalurkan makanan surplus berkualitas dengan harga terjangkau.',
  'Membantu UMKM mengubah potensi limbah menjadi pendapatan.',
  'Mengedukasi masyarakat tentang dampak food loss dan food waste bagi lingkungan dan ekonomi.',
  'Membangun ekosistem pangan yang berkelanjutan dan inklusif di Indonesia.',
];

/**
 * Halaman Tentang Kami — publik. Berisi visi dan misi ReBites dalam dua
 * kartu: kartu hijau berisi pernyataan visi, kartu putih berisi daftar misi.
 */
export default function TentangKamiPage() {
  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-white pt-16 sm:pt-[72px]">
        <section
          aria-labelledby="tentang-kami-heading"
          className="grain-overlay bg-secondary"
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <Reveal>
              <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Tentang Kami
              </p>
              <h1
                id="tentang-kami-heading"
                className="mt-4 max-w-3xl text-balance font-display text-[clamp(2rem,4.2vw,3.25rem)] font-semibold leading-[1.06] tracking-[-0.035em] text-primary"
              >
                Menyelamatkan makanan,{' '}
                <span className="font-light italic">bersama-sama</span>.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-[1.8] text-muted-foreground">
                ReBites adalah marketplace makanan surplus dari UMKM - lahir dari
                satu keyakinan sederhana: makanan yang masih baik layak sampai ke
                meja makan, bukan ke tempat sampah.
              </p>
            </Reveal>

            <div id="visi-misi" className="mt-10 grid scroll-mt-24 gap-4 sm:mt-14 sm:gap-5 lg:grid-cols-5">
              {/* Visi — kartu hijau menjadi titik fokus */}
              <Reveal className="lg:col-span-2">
                <div className="flex h-full flex-col justify-between gap-10 rounded-3xl bg-primary p-7 text-primary-foreground sm:p-9">
                  <div>
                    <span
                      aria-hidden
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10"
                    >
                      <Eye className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <h2 className="mt-6 font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/60">
                      Visi
                    </h2>
                    <p className="mt-4 text-balance font-display text-[clamp(1.35rem,2vw,1.75rem)] font-medium leading-[1.3] tracking-[-0.02em] text-white">
                      Menjadi platform penyelamat makanan terdepan di Indonesia -
                      di mana setiap makanan surplus menemukan rumah barunya,
                      dan food loss serta food waste ditekan sekecil mungkin.
                    </p>
                  </div>
                  <p className="border-t border-white/15 pt-6 font-display text-sm italic leading-relaxed text-primary-foreground/70">
                    Satu porsi yang diselamatkan hari ini adalah satu porsi yang
                    tidak berakhir di tempat sampah.
                  </p>
                </div>
              </Reveal>

              {/* Misi */}
              <Reveal delay={0.08} className="lg:col-span-3">
                <div className="flex h-full flex-col rounded-3xl border border-border bg-white p-7 sm:p-9">
                  <span
                    aria-hidden
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-secondary text-primary"
                  >
                    <ListChecks className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <h2 className="mt-6 font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                    Misi
                  </h2>
                  <ol className="mt-5 divide-y divide-border">
                    {MISSIONS.map((mission, index) => (
                      <li key={index} className="flex items-start gap-4 py-4 first:pt-1 last:pb-0">
                        <span
                          aria-hidden
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </span>
                        <span className="text-sm leading-[1.8] text-muted-foreground sm:text-[15px]">
                          {mission}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <TeamLanyardRail
          id="tim-leadership"
          className="scroll-mt-24"
          items={LANYARD_DEMO_TEAM.slice(0, 3)}
          maxBadgeWidth={152}
          eyebrow="Meet the team"
          heading="A team wall you can flip through, right on the page."
          caption="Brush along the rail to meet someone, pull a badge down, click to flip it."
          autoplay
          labels={{
            flip: 'Klik atau tekan Enter untuk membalik lencana',
            back: 'Klik lagi atau tekan Esc untuk mengembalikannya',
            show: 'Tampilkan',
          }}
        />
      <br />
      <br />
      <br />
      <FinalCTASection />
      <br />
      <br />
      <br />
      </main>
      <LandingFooter />
    </>
  );
}
