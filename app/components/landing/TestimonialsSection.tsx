import { SectionHeading } from '@/app/components/landing/SectionHeading';
import TestimonialMarqueeDemo from '@/components/ui/marquee-01';

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

        <div className="mt-10 sm:mt-12">
          <TestimonialMarqueeDemo />
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground sm:mt-10">
          Catatan: ulasan yang ditampilkan merupakan data demo,
          bukan testimoni pelanggan yang telah terverifikasi.
        </p>
      </div>
    </section>
  );
}
