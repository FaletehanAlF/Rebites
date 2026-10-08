import { Quote } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
import { TESTIMONIALS } from '@/app/components/landing/testimonials';

/**
 * Ulasan pengguna di halaman landing.
 *
 * Isinya data demo dari `testimonials.ts` — belum ada ulasan publik yang
 * bisa diverifikasi di aplikasi — jadi section ini sengaja menutup dengan
 * catatan bahwa yang ditampilkan bukan testimoni pelanggan terverifikasi.
 * Ketika data riil tersedia, cukup ganti isi datasetnya.
 */
export function TestimonialsSection() {
  return (
    <section
      id="ulasan"
      aria-labelledby="testimonials-heading"
      className="grain-overlay bg-secondary"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <Reveal>
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
            <div>
              <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Umpan balik
              </p>
              <h2
                id="testimonials-heading"
                className="mt-4 text-balance font-display text-[clamp(1.75rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary"
              >
                Dari dua sisi{' '}
                <span className="font-light italic">yang sama-sama untung.</span>
              </h2>
            </div>
            <p className="max-w-xl text-[15px] leading-[1.8] text-muted-foreground lg:pb-1">
              Pembeli yang mencari makanan terjangkau, penjual yang punya menu
              tersisa. Ceritanya berbeda, hasil akhirnya sama.
            </p>
          </div>
        </Reveal>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5">
          {TESTIMONIALS.map((item, index) => (
            <Reveal key={item.name} as="li" delay={Math.min(index, 3) * 0.06}>
              <figure className="flex h-full flex-col rounded-2xl border border-border bg-white p-6 sm:p-7">
                <Quote
                  className="h-6 w-6 shrink-0 text-primary/40"
                  aria-hidden
                />
                <blockquote className="mt-4 flex-1 text-[15px] leading-[1.8] text-foreground">
                  {item.quote}
                </blockquote>
                <figcaption className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <div>
                    <p className="font-display text-sm font-semibold tracking-tight text-primary">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {item.role}
                    </p>
                  </div>
                  <span className="rounded-full bg-accent px-3 py-1 font-secondary text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                    {item.audience}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Cerita di atas adalah contoh tampilan (data demo), bukan ulasan
          pelanggan terverifikasi.
        </p>
      </div>
    </section>
  );
}
