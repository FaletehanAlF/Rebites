import { MapPin } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';

const ASSURANCES = [
  {
    num: '01',
    title: 'Masih layak konsumsi',
    description:
      'Menu berasal dari kelebihan produksi atau yang belum terjual hari itu — bukan makanan yang kedaluwarsa.',
  },
  {
    num: '02',
    title: 'Harga selalu terbuka',
    description:
      'Harga asli dan harga surplus ditampilkan berdampingan, jadi kamu tahu berapa yang benar-benar dihemat.',
  },
  {
    num: '03',
    title: 'Waktu tidak disembunyikan',
    description:
      'Setiap penjual mencantumkan jam operasional serta waktu penerimaan pesanan sebelum kamu memesan.',
  },
  {
    num: '04',
    title: 'Fokus di Kota Depok',
    description:
      'ReBites beroperasi khusus di Depok sebagai langkah awal membangun ekosistem penyelamatan pangan.',
  },
];

/**
 * Value / trust band directly below the hero. Deliberately framed as
 * *assurances about the platform* rather than statistics: the app ships no
 * verifiable user, vendor or order counts, so nothing numeric is claimed.
 */
export function TrustSection() {
  return (
    <section
      id="about"
      aria-labelledby="trust-heading"
      className="grain-overlay bg-secondary"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
          <Reveal>
            <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              Mengapa ReBites
            </p>
            <h2
              id="trust-heading"
              className="mt-4 text-balance font-display text-[clamp(1.8rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary"
            >
              Makanan surplus{' '}
              <span className="font-light italic">tanpa kompromi</span> pada
              kualitas.
            </h2>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="max-w-xl text-[15px] leading-[1.8] text-muted-foreground lg:pb-2">
              ReBites hanya menampilkan makanan yang masih layak konsumsi,
              lengkap dengan informasi yang perlu kamu tahu sebelum memesan —
              harga, sisa stok, jam ketersediaan, sampai cara menerimanya.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {ASSURANCES.map((item, index) => (
            <Reveal key={item.num} delay={0.06 + index * 0.05}>
              <div className="border-t border-border pt-5">
                <span className="font-display text-xs font-semibold tabular-nums tracking-[0.2em] text-primary/50">
                  {item.num}
                </span>
                <h3 className="mt-3 font-display text-lg font-semibold tracking-tight text-primary">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-[1.75] text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-12 flex items-start gap-3 rounded-2xl border border-border bg-white px-5 py-4 text-sm leading-[1.7] text-muted-foreground sm:mt-14 sm:items-center">
            <MapPin
              className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:mt-0"
              aria-hidden
            />
            <span>
              Saat ini ReBites beroperasi di{' '}
              <span className="font-semibold text-primary">Kota Depok</span>,
              sebagai langkah awal sebelum ekosistem ini meluas ke kota lain.
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
