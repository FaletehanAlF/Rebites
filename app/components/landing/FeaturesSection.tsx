import { Bike, ClipboardCheck, Route, Search, Timer } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
const FILTER_CHIPS = ['Terdekat', 'Diskon terbesar', 'Segera habis'];
const FEATURES = [
    {
        icon: Timer,
        title: 'Flash sale & promo waktu terbatas',
        description: 'Menu dengan slot waktu terbatas muncul lengkap dengan hitung mundur, dan promo kode bisa dipakai saat pembayaran.',
    },
    {
        icon: Bike,
        title: 'Diantar atau ambil sendiri',
        description: 'Pilih metode penerimaan pesanan yang paling praktis untukmu, lengkap dengan estimasi yang ditampilkan di awal.',
    },
    {
        icon: Route,
        title: 'Lacak status pesanan',
        description: 'Pantau pesanan dari disiapkan, siap diambil, sampai diantar — semuanya terlihat di satu halaman.',
    },
    {
        icon: ClipboardCheck,
        title: 'Riwayat & ulasan',
        description: 'Semua pesanan tersimpan rapi, dan kamu bisa menilai makanan setelah diterima.',
    },
];
export function FeaturesSection() {
    return (<section id="fitur" aria-labelledby="features-heading" className="grain-overlay bg-secondary">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              Fitur utama
            </p>
            <h2 id="features-heading" className="mt-4 text-balance font-display text-[clamp(1.8rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary">
              Semua yang kamu butuhkan,{' '}
              <span className="font-light italic">dalam satu aplikasi</span>.
            </h2>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          <Reveal className="sm:col-span-2 lg:col-span-2">
            <div className="flex h-full flex-col justify-between gap-8 rounded-3xl bg-primary p-7 text-primary-foreground sm:p-9">
              <div className="max-w-xl">
                <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                  <Search className="h-5 w-5" strokeWidth={2.2}/>
                </span>
                <h3 className="mt-6 font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                  Kategori, pencarian & filter
                </h3>
                <p className="mt-3 text-sm leading-[1.8] text-primary-foreground/75 sm:text-base">
                  Delapan kategori kuliner, pencarian instan, dan beberapa mode
                  filter agar menu yang pas cepat ditemukan — tanpa perlu
                  menggali satu per satu.
                </p>
              </div>

              <ul className="flex flex-wrap gap-2">
                {FILTER_CHIPS.map((chip) => (<li key={chip} className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 font-secondary text-xs font-medium text-white">
                    {chip}
                  </li>))}
              </ul>
            </div>
          </Reveal>

          {FEATURES.map((feature, index) => (<Reveal key={feature.title} delay={0.04 + index * 0.05}>
              <div className="flex h-full flex-col rounded-3xl border border-border bg-white p-6 transition-colors duration-300 hover:border-primary/40 sm:p-7">
                <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-secondary text-primary">
                  <feature.icon className="h-5 w-5" strokeWidth={2}/>
                </span>
                <h3 className="mt-5 font-display text-base font-semibold tracking-tight text-primary sm:text-lg">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-[1.75] text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </Reveal>))}
        </div>
      </div>
    </section>);
}
