import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary';
export function FinalCTASection() {
    return (<section aria-labelledby="final-cta-heading" className="grain-overlay bg-secondary">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-14 text-center sm:rounded-[2.5rem] sm:px-12 sm:py-16 lg:px-20 lg:py-20">
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10"/>

            <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
              Siap mulai
            </p>

            <h2 id="final-cta-heading" className="mx-auto mt-4 max-w-3xl text-balance font-display text-[clamp(1.95rem,4vw,3.25rem)] font-semibold leading-[1.06] tracking-[-0.035em] text-white">
              Siap menyelamatkan{' '}
              <span className="font-light italic">gigitan</span> berikutnya?
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.8] text-white/70 sm:text-base">
              Buat akun gratis dan jelajahi makanan surplus dari pelaku UMKM
              Kota Depok hari ini juga — atau bawa usahamu bergabung.
            </p>

            <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link href="/auth/register" className={`group inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 font-secondary text-sm font-semibold text-primary transition-colors duration-300 hover:bg-secondary ${FOCUS_RING}`}>
                Buat akun gratis
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden/>
              </Link>

              <Link href="/auth/register/penjual" className={`inline-flex items-center justify-center gap-2 rounded-full border border-white/35 px-7 py-3.5 font-secondary text-sm font-semibold text-white transition-colors duration-300 hover:border-white hover:bg-white/10 ${FOCUS_RING}`}>
                Daftar sebagai penjual
              </Link>
            </div>

            <p className="mt-8 flex items-center justify-center gap-2 text-xs text-white">
              <MapPin className="h-3.5 w-3.5" aria-hidden/>
              Tersedia khusus untuk wilayah Kota Depok
            </p>
          </div>
        </Reveal>
      </div>
    </section>);
}
