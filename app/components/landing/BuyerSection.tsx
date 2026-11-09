import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
const STEPS = [
    {
        num: '01',
        title: 'Jelajahi',
        description: 'Cari makanan lewat kategori, kata kunci, atau urutan terdekat dari lokasimu.',
    },
    {
        num: '02',
        title: 'Pastikan detailnya',
        description: 'Harga surplus, sisa stok, dan jam ketersediaan tampil sebelum kamu memesan.',
    },
    {
        num: '03',
        title: 'Pilih cara terima',
        description: 'Diantar ke alamatmu, atau diambil langsung di lokasi penjual — sesuai kebutuhan.',
    },
    {
        num: '04',
        title: 'Bayar & lacak',
        description: 'Selesaikan pembayaran, lalu ikuti status pesanan dari disiapkan sampai selesai.',
    },
];
const EXTRAS = [
    'Simpan makanan favorit',
    'Promo kode & koin',
    'Riwayat pesanan',
    'Ulasan & penilaian',
    'Notifikasi pesanan',
];
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
export function BuyerSection() {
    return (<section id="pembeli" aria-labelledby="buyer-heading" className="grain-overlay bg-white">

      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:px-8 lg:py-24">

        <Reveal>

          <div className="relative">

            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] border border-border bg-muted shadow-[0_40px_80px_-56px_rgba(27,77,50,0.7)] sm:rounded-[2.5rem]">

              <Image src="/pembeli-mencaro.avif" alt="Pembeli mencari dan memesan makanan surplus di ReBites" fill sizes="(min-width: 1024px) 32rem, calc(100vw - 2rem)" className="object-cover"/>

            </div>



            <div className="absolute -top-4 left-4 rounded-2xl border border-border bg-white px-4 py-3 shadow-[0_24px_44px_-26px_rgba(27,77,50,0.7)] sm:left-6">

              <p className="font-secondary text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">

                Cara penerimaan

              </p>

              <p className="mt-1 font-display text-sm font-semibold text-primary">

                Diantar atau ambil sendiri

              </p>

            </div>

          </div>

        </Reveal>



        <div>

          <Reveal delay={0.06}>

            <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">

              Untuk pembeli

            </p>

            <h2 id="buyer-heading" className="mt-4 text-balance font-display text-[clamp(1.8rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary">

              Dari jelajah pertama hingga{' '}

              <span className="font-light italic">pesanan tiba</span> di depan

              pintu.

            </h2>

            <p className="mt-5 max-w-xl text-[15px] leading-[1.8] text-muted-foreground">

              Semua yang kamu butuhkan untuk berburu makanan surplus ada di satu

              tempat — tanpa langganan, tanpa biaya tersembunyi.

            </p>

          </Reveal>



          <ol className="mt-8 border-t border-border">

            {STEPS.map((step, index) => (<Reveal as="li" key={step.num} delay={0.04 + index * 0.05} className="list-none border-b border-border">

                <div className="flex items-start gap-4 py-4 sm:gap-6 sm:py-5">

                  <span className="font-display text-xs font-semibold tabular-nums tracking-[0.16em] text-primary">

                    {step.num}

                  </span>

                  <div>

                    <h3 className="font-display text-sm font-semibold tracking-tight text-primary sm:text-base">

                      {step.title}

                    </h3>

                    <p className="mt-1 text-sm leading-[1.7] text-muted-foreground">

                      {step.description}

                    </p>

                  </div>

                </div>

              </Reveal>))}

          </ol>



          <Reveal delay={0.08}>

            <ul className="mt-6 flex flex-wrap gap-2">

              {EXTRAS.map((extra) => (<li key={extra} className="rounded-full border border-border bg-secondary px-3.5 py-1.5 font-secondary text-xs font-medium text-muted-foreground">

                  {extra}

                </li>))}

            </ul>

          </Reveal>



          <Reveal delay={0.1}>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">

              <Link href="/auth/register" className={`group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 font-secondary text-sm font-semibold text-white transition-colors duration-300 hover:bg-primary-dark ${FOCUS_RING}`}>

                Buat akun pembeli

                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden/>

              </Link>

              <Link href="/auth/login" className={`inline-flex items-center justify-center gap-2 rounded-full border border-border px-7 py-3.5 font-secondary text-sm font-semibold text-primary transition-colors duration-300 hover:border-primary hover:bg-secondary ${FOCUS_RING}`}>

                Sudah punya akun? Masuk

              </Link>

            </div>

          </Reveal>

        </div>

      </div>

    </section>);
}
