import Image from 'next/image';
import type { Metadata } from 'next';
import { PublicShell } from '@/app/components/landing/public-shell';
import { PublicPageHero } from '@/app/components/landing/PublicPageHero';
import { ContactCTASection } from '@/app/components/landing/ContactCTASection';
import { Reveal } from '@/app/components/shared/reveal';

export const metadata: Metadata = {
  title: 'Dampak - ReBites',
  description:
    'Dampak yang ingin dibuat ReBites: makanan surplus tidak terbuang, UMKM memperoleh pendapatan tambahan, dan pembeli mendapat makanan terjangkau di Kota Depok.',
};

const THEMES = [
  {
    num: '01',
    title: 'Makanan yang tidak terbuang',
    description:
      'Setiap porsi yang berpindah tangan adalah satu porsi lebih sedikit yang berakhir di tempat sampah.',
  },
  {
    num: '02',
    title: 'Pendapatan tambahan untuk UMKM',
    description:
      'Menu yang tadinya hanya menambah beban produksi kembali menghasilkan — sekaligus membuka toko ke pembeli baru.',
  },
  {
    num: '03',
    title: 'Makanan terjangkau untuk pembeli',
    description:
      'Kualitas yang sama dengan harga lebih masuk akal, tanpa perlu menunggu promo atau waktu tertentu.',
  },
  {
    num: '04',
    title: 'Ekosistem lokal yang lebih rapat',
    description:
      'Transaksi terjadi antar warga di wilayah yang sama: dapurnya dekat, pembelinya dekat, dan makanannya tidak jauh berpindah.',
  },
];

export default function DampakPage() {
  return (
    <PublicShell>
      <PublicPageHero
        eyebrow="Dampak"
        title={
          <>
            Satu transaksi kecil,{' '}
            <span className="font-light italic">sesuatu yang lebih.</span>
          </>
        }
        lead="Ketika makanan surplus menemukan pembelinya, satu transaksi kecil bisa berarti lebih banyak dari sekadar makanan."
      />

      {/* Narasi */}
      <section aria-labelledby="narrative-heading" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1fr] lg:items-center lg:gap-16">
            <Reveal>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted lg:aspect-[3/4]">
                <Image
                  src="/daun1072179.jpg"
                  alt="Rimbun daun tropis yang lebat"
                  fill
                  sizes="(min-width: 1024px) 24rem, calc(100vw - 2rem)"
                  className="object-cover"
                />
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div>
                <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Cerita dampak
                </p>
                <h2
                  id="narrative-heading"
                  className="mt-4 text-balance font-display text-[clamp(1.75rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary"
                >
                  Dampaknya tidak mulai dari kebijakan,{' '}
                  <span className="font-light italic">
                    tapi dari pesanan berikutnya.
                  </span>
                </h2>

                <div className="mt-5 space-y-4 text-[15px] leading-[1.8] text-muted-foreground">
                  <p>
                    Kami tidak memulai dari angka besar. Kami memulai dari satu
                    warung yang punya nasi tersisa, dan satu orang yang sedang
                    mencari makan siang.
                  </p>
                  <p>
                    Kalau keduanya bertemu, makanannya tidak terbuang,
                    penjualnya mendapat tambahan, dan pembelinya membayar
                    lebih sedikit untuk hal yang sama. Tidak ada yang harus
                    mengorbankan yang lain.
                  </p>
                  <p>
                    Di situlah ReBites ingin berada: di tengah percakapan
                    sehari-hari soal makanan, harga, dan sisa — bukan di
                    presentasi yang jauh dari dapur.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Tema dampak */}
      <section
        aria-labelledby="themes-heading"
        className="grain-overlay bg-primary text-primary-foreground"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <Reveal>
            <div className="max-w-2xl">
              <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/70">
                Yang kami kejar
              </p>
              <h2
                id="themes-heading"
                className="mt-4 text-balance font-display text-[clamp(1.75rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white"
              >
                Empat hal yang ingin{' '}
                <span className="font-light italic">kami ubah.</span>
              </h2>
            </div>
          </Reveal>

          <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {THEMES.map((theme, index) => (
              <Reveal
                key={theme.num}
                as="li"
                delay={Math.min(index, 3) * 0.05}
                className="border-t border-white/20 pt-5"
              >
                <span className="font-display text-xs font-semibold tabular-nums tracking-[0.2em] text-white/70">
                  {theme.num}
                </span>
                <h3 className="mt-2.5 font-display text-lg font-semibold tracking-tight text-white sm:text-xl">
                  {theme.title}
                </h3>
                <p className="mt-2 text-sm leading-[1.75] text-white/70">
                  {theme.description}
                </p>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={0.05}>
            <p className="mt-10 max-w-2xl border-t border-white/20 pt-6 text-sm leading-[1.75] text-white/70">
              Angka dampak kumulatifnya masih kami kumpulkan. Untuk sekarang,
              yang bisa kami tunjukkan dengan jujur adalah cerita di balik
              setiap transaksi.
            </p>
          </Reveal>
        </div>
      </section>

      <ContactCTASection />
    </PublicShell>
  );
}
