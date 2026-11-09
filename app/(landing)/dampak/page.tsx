import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { PublicShell } from '@/app/components/landing/public-shell';
import { PageIntro } from '@/app/components/landing/PageIntro';
import { SectionHeading } from '@/app/components/landing/SectionHeading';
import { ContactCTASection } from '@/app/components/landing/ContactCTASection';
import { Reveal } from '@/app/components/shared/reveal';

export const metadata: Metadata = {
  title: 'Dampak - ReBites',
  description:
    'Dampak yang ingin dibuat ReBites: makanan surplus tidak terbuang, UMKM memperoleh pendapatan tambahan, dan pembeli mendapat makanan terjangkau di Kota Depok.',
};

const OUTCOMES = [
  {
    num: '01',
    title: 'Makanan yang tidak terbuang',
    description:
      'Setiap porsi yang berpindah tangan adalah satu porsi lebih sedikit yang berakhir di tempat sampah. Sisa produksi hari itu tetap berakhir di piring.',
  },
  {
    num: '02',
    title: 'Pendapatan tambahan untuk UMKM',
    description:
      'Menu yang tadinya hanya menambah beban produksi kembali menghasilkan — sekaligus membuka toko ke pembeli baru di sekitarnya.',
  },
  {
    num: '03',
    title: 'Makanan terjangkau untuk pembeli',
    description:
      'Kualitas yang sama dengan harga lebih masuk akal, tanpa perlu menunggu promo atau waktu tertentu.',
  },
];

const CHAIN = [
  {
    num: '01',
    title: 'UMKM menawarkan surplus',
    description:
      'Menu yang belum terjual hari itu diunggah lengkap dengan harga, sisa stok, dan waktu penerimaannya.',
  },
  {
    num: '02',
    title: 'Pembeli menemukan dan memesan',
    description:
      'Informasi terlihat sebelum transaksi, lalu pesanan dipilih diantar atau diambil sendiri di lokasi penjual.',
  },
  {
    num: '03',
    title: 'Makanan berpindah tangan',
    description:
      'Satu porsi berakhir di piring, dan ketiga hasil di atas terjadi pada waktu yang bersamaan.',
  },
];

// /dampak lebih naratif daripada /fitur; tanpa angka kumulatif karena data dampak belum bisa diverifikasi.
export default function DampakPage() {
  return (
    <PublicShell>

      {/* Narasi */}
      <section aria-labelledby="narrative-heading" className="border-t border-border bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="narrative-heading"
            heading="Dampaknya tidak mulai dari kebijakan, tapi dari pesanan berikutnya."
            description="Kami tidak memulai dari angka besar. Kami memulai dari satu warung yang punya nasi tersisa, dan satu orang yang sedang mencari makan siang."
          />

          <Reveal delay={0.06}>
            <div className="mt-10 grid gap-6 border-t border-border pt-8 text-[15px] leading-[1.8] text-muted-foreground sm:mt-12 lg:grid-cols-2 lg:gap-14">
              <p>
                Kalau keduanya bertemu, makanannya tidak terbuang, penjualnya
                mendapat tambahan, dan pembelinya membayar lebih sedikit untuk
                hal yang sama. Tidak ada yang harus mengorbankan yang lain.
              </p>
              <p>
                Di situlah ReBites ingin berada: di tengah percakapan
                sehari-hari soal makanan, harga, dan sisa — bukan di
                presentasi yang jauh dari dapur.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Tiga hasil */}
      <section
        aria-labelledby="outcomes-heading"
        className="border-t border-border bg-white"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="outcomes-heading"
            heading="Tiga hasil dari satu kebiasaan kecil."
            description="Tiga hasil ini saling terkait. Satu pesanan yang selesai menyalakan ketiganya sekaligus, bukan satu per satu."
          />

          <ol className="mt-10 border-t border-border sm:mt-12">
            {OUTCOMES.map((outcome, index) => (
              <Reveal
                key={outcome.num}
                as="li"
                delay={index * 0.06}
                className="grid gap-3 border-b border-border py-7 sm:py-8 lg:grid-cols-[3rem_1fr_1.15fr] lg:items-baseline lg:gap-10"
              >
                <span className="font-display text-xs font-semibold tabular-nums tracking-[0.2em] text-muted-foreground">
                  {outcome.num}
                </span>
                <h3 className="font-display text-xl font-semibold leading-snug tracking-[-0.02em] text-foreground sm:text-2xl">
                  {outcome.title}
                </h3>
                <p className="max-w-2xl text-sm leading-[1.75] text-muted-foreground">
                  {outcome.description}
                </p>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={0.05}>
            <p className="mt-8 max-w-2xl text-sm leading-[1.75] text-muted-foreground">
              Angka dampak kumulatifnya masih kami kumpulkan. Untuk sekarang,
              yang bisa kami tunjukkan dengan jujur adalah cerita di balik
              setiap transaksi.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Rantai */}
      <section aria-labelledby="chain-heading" className="border-t border-border bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="chain-heading"
            heading="Satu rantai yang pendek dan jelas."
            description="ReBites tidak menambah rantai pasok. Perannya hanya mempertemukan dua pihak yang sudah berada di lokasi yang sama."
          />

          <ol className="mt-10 flex flex-col gap-4 sm:mt-12 sm:flex-row sm:items-stretch sm:gap-3">
            {CHAIN.map((step, index) => (
              <li key={step.num} className="flex w-full items-stretch gap-3 sm:flex-1">
                <Reveal delay={index * 0.06} className="flex-1">
                  <div className="h-full rounded-2xl border border-border bg-white p-5 sm:p-6">
                    <span className="font-secondary text-sm font-semibold tabular-nums text-primary">
                      {step.num}
                    </span>
                    <h3 className="mt-6 font-display text-lg font-semibold leading-snug tracking-[-0.02em] text-foreground sm:text-xl">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-[1.75] text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </Reveal>

                {index < CHAIN.length - 1 && (
                  <ArrowRight
                    className="hidden h-5 w-5 shrink-0 self-center text-muted-foreground sm:block"
                    aria-hidden
                  />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ContactCTASection />
    </PublicShell>
  );
}
