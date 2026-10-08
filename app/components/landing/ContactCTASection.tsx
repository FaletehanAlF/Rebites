import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';

const FOCUS_RING_ON_GREEN =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary';

/**
 * Kartu ajakan penutup — dipakai di halaman landing dan halaman pendukung
 * (`/tentang-kami`, `/fitur`, `/dampak`) supaya setiap halaman publik
 * berakhir dengan langkah yang sama jelasnya.
 */
export function ContactCTASection() {
  return (
    <section
      id="kontak"
      aria-labelledby="contact-cta-heading"
      className="bg-white"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-12 text-center sm:rounded-[2.5rem] sm:px-12 sm:py-14 lg:px-20">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10"
            />

            <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
              Hubungi kami
            </p>

            <h2
              id="contact-cta-heading"
              className="mx-auto mt-4 max-w-2xl text-balance font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white"
            >
              Masih punya <span className="font-light italic">pertanyaan?</span>
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.8] text-white/70">
              Hubungi tim ReBites dan kami akan membantu — atau langsung
              jelajahi makanan surplus yang sedang ditawarkan hari ini.
            </p>

            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/hubungi-kami"
                className={`group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 font-secondary text-sm font-semibold text-primary transition-colors duration-300 hover:bg-secondary ${FOCUS_RING_ON_GREEN}`}
              >
                <Mail className="h-4 w-4" aria-hidden />
                Hubungi Kami
              </Link>

              <Link
                href="/home"
                className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/40 px-7 py-3.5 font-secondary text-sm font-semibold text-white transition-colors duration-300 hover:border-white hover:bg-white/10 ${FOCUS_RING_ON_GREEN}`}
              >
                Jelajahi ReBites
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
