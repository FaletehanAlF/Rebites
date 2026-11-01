import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Ajakan penutup setiap halaman publik — dipakai di halaman utama dan
 * halaman pendukung (`/tentang-kami`, `/fitur`, `/dampak`) supaya setiap
 * halaman berakhir dengan langkah yang sama jelasnya. Sengaja polos di
 * atas putih: hierarki dibangun oleh tipografi, hijau hanya untuk tombol.
 */
export function ContactCTASection() {
  return (
    <section
      id="kontak"
      aria-labelledby="contact-cta-heading"
      className="border-t border-border bg-white"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-3 text-center sm:px-6 sm:py-2 lg:px-8 lg:py-4 mt-8">
        <Reveal>
          <h2
            id="contact-cta-heading"
            className="text-balance font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground"
          >
            Masih punya pertanyaan?
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.8] text-muted-foreground">
            Hubungi tim ReBites dan kami akan membantu — atau langsung
            jelajahi makanan surplus yang sedang ditawarkan hari ini.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/hubungi-kami"
              className={`group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 font-secondary text-sm font-semibold text-white transition-colors duration-300 hover:bg-primary-dark ${FOCUS_RING}`}
            >
              <Mail className="h-4 w-4" aria-hidden />
              Hubungi Kami
            </Link>

            <Link
              href="/home"
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-border px-7 py-3.5 font-secondary text-sm font-semibold text-primary transition-colors duration-300 hover:border-primary ${FOCUS_RING}`}
            >
              Jelajahi ReBites
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
