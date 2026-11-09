import Image from 'next/image';
import { Reveal } from '@/app/components/shared/reveal';
const STEPS = [
    {
        num: '01',
        title: 'Pelaku UMKM mendaftar & mengunggah',
        description: 'Mendaftar akun, melengkapi profil usaha, lalu mengunggah makanan surplus yang masih layak konsumsi beserta harga, stok, dan waktu penjualannya.',
        image: '/penjual-login.avif',
        alt: 'Pelaku UMKM mendaftar dan mengunggah menu di ReBites',
    },
    {
        num: '02',
        title: 'Pembeli mencari & melihat detail',
        description: 'Menjelajahi kategori dan pencarian, lalu memeriksa detail produk surplus di sekitarnya sebelum menentukan jumlah pembelian.',
        image: '/pembeli-mencaro.avif',
        alt: 'Pembeli mencari makanan surplus di ReBites',
    },
    {
        num: '03',
        title: 'Pilih metode penerimaan pesanan',
        description: 'Memilih diantar atau diambil langsung di lokasi penjual, kemudian memilih metode pembayaran untuk menyelesaikan pesanan.',
        image: '/penerimaan.avif',
        alt: 'Pilihan metode penerimaan pesanan di ReBites',
    },
    {
        num: '04',
        title: 'Makanan berhasil diselamatkan',
        description: 'Menikmati makanan berkualitas dengan harga lebih terjangkau, sekaligus membantu mengurangi food loss dan food waste di Indonesia.',
        image: '/terselamatkan.avif',
        alt: 'Makanan surplus yang berhasil diselamatkan',
    },
];
export function HowItWorksSection() {
    return (<section id="cara-kerja" aria-labelledby="how-heading" className="grain-overlay bg-primary text-primary-foreground">

      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">

          <Reveal>

            <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/60">

              Alur ReBites

            </p>

            <h2 id="how-heading" className="mt-4 text-balance font-display text-[clamp(1.8rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary-foreground">

              Empat langkah,{' '}

              <span className="font-light italic">satu piring</span> yang

              terselamatkan.

            </h2>

          </Reveal>



          <Reveal delay={0.08}>

            <p className="max-w-xl text-[15px] leading-[1.8] text-primary-foreground/70 lg:pb-2">

              Alurnya sama sederhananya untuk penjual maupun pembeli: dari

              makanan diunggah, sampai piring terakhir dinikmati di rumah.

            </p>

          </Reveal>

        </div>



        <ol className="mt-12 grid gap-10 sm:mt-14 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 lg:gap-x-10 xl:grid-cols-4">

          {STEPS.map((step, index) => (<Reveal as="li" key={step.num} delay={0.05 + index * 0.07} className="list-none">

              <div className="flex items-center gap-3">

                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/30 font-display text-[11px] font-bold tabular-nums text-white">

                  {step.num}

                </span>

                <span aria-hidden className="hidden h-px flex-1 bg-white/20 xl:block"/>

              </div>



              <div className="relative mt-5 aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5">

                <Image src={step.image} alt={step.alt} fill sizes="(min-width: 1280px) 18rem, (min-width: 640px) 44vw, calc(100vw - 2rem)" className="object-cover"/>

              </div>



              <h3 className="mt-5 font-display text-base font-semibold leading-snug tracking-tight text-primary-foreground sm:text-lg">

                {step.title}

              </h3>

              <p className="mt-2 text-sm leading-[1.75] text-primary-foreground/65">

                {step.description}

              </p>

            </Reveal>))}

        </ol>

      </div>

    </section>);
}
