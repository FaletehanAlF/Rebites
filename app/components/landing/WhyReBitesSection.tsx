import Image from 'next/image';
import { Reveal } from '@/app/components/shared/reveal';
import { SectionHeading } from '@/app/components/landing/SectionHeading';

const DIFFERENTIATORS = [
  {
    num: '01',
    title: 'Surplus, bukan sekadar diskon',
    description:
      'Menu diambil dari kelebihan produksi atau yang belum terjual hari itu — masih layak konsumsi, bukan makanan yang kedaluwarsa.',
  },
  {
    num: '02',
    title: 'Menghubungkan dua sisi',
    description:
      'UMKM yang punya makanan bertemu pembeli yang mencari makanan terjangkau. ReBites berdiri di tengah, mempertemukan keduanya.',
  },
  {
    num: '03',
    title: 'Lebih hemat, tetap bernilai',
    description:
      'Pembeli membayar lebih sedikit untuk makanan yang sama. Penjual mendapat pendapatan tambahan dari menu yang tadinya tersisa.',
  },
  {
    num: '04',
    title: 'Dampak dari transaksi sederhana',
    description:
      'Setiap pesanan berarti satu porsi lebih banyak berakhir di piring — bukan di tempat sampah.',
  },
];

/**
 * "Kenapa ReBites?" — empat diferensiasi yang benar-benar melekat pada
 * produk, disusun sebagai daftar bernomor berdampingan dengan satu foto
 * agar hierarkinya kuat tanpa jatuh ke grid kartu yang seragam.
 *
 * Sengaja tidak memuat angka: aplikasi tidak punya statistik yang bisa
 * diverifikasi.
 */
export function WhyReBitesSection() {
  return (
    <section
      id="kenapa"
      aria-labelledby="why-heading"
      className="border-t border-border bg-white"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          id="why-heading"
          heading="Pilihan Hemat, Manfaat Lebih Besar."
          description="Manfaatkan makanan yang masih layak konsumsi sambil membantu mengurangi makanan terbuang dan mendukung UMKM lokal."
        />

        <div className="mt-10 grid gap-10 sm:mt-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <Reveal>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted sm:aspect-[3/2]">
              <Image
                src="/terselamatkan.jpg"
                alt="Aneka hidangan dari dapur UMKM yang siap dinikmati pembeli"
                fill
                sizes="(min-width: 1024px) 24rem, calc(100vw - 2rem)"
                className="object-cover"
              />
            </div>
          </Reveal>

          <ol className="border-t border-border">
            {DIFFERENTIATORS.map((item, index) => (
              <Reveal
                key={item.num}
                as="li"
                delay={0.04 + index * 0.05}
                className="flex items-start gap-4 border-b border-border py-6 sm:gap-6"
              >
                <span className="mt-1 font-display text-xs font-semibold tabular-nums tracking-[0.16em] text-primary">
                  {item.num}
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                    {item.title}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-[1.75] text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
