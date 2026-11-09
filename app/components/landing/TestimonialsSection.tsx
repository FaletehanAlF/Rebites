
import { Quote } from 'lucide-react';

import { Reveal } from '@/app/components/shared/reveal';
import { SectionHeading } from '@/app/components/landing/SectionHeading';
import { TESTIMONIALS } from '@/app/components/landing/testimonials';

// Ulasan pengguna; datanya demo, bukan pelanggan nyata. Ganti isi testimonials.ts saat data riil tersedia.
export function TestimonialsSection() {
  return (
    <section
      id="ulasan"
      aria-labelledby="testimonials-heading"
      className="border-t border-border bg-white"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          id="testimonials-heading"
          heading="Cerita dari Pembeli dan UMKM."
          description="Dua perspektif tentang makanan surplus: pembeli yang mencari pilihan hemat, dan penjual yang ingin mengurangi sisa produksi."
        />

        <ul className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5">
          {TESTIMONIALS.map((item, index) => (
            <Reveal
              key={item.name}
              as="li"
              delay={Math.min(index, 3) * 0.06}
            >
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
          Catatan: ulasan yang ditampilkan merupakan data demo,
          bukan testimoni pelanggan yang telah terverifikasi.
        </p>
      </div>
    </section>
  );
}
