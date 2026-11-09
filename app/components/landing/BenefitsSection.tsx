import { Reveal } from '@/app/components/shared/reveal';
const BENEFITS = [
    {
        label: 'Untukmu',
        description: 'Makanan enak dengan budget yang lebih terjaga — kualitas yang sama, harga yang jauh lebih masuk akal.',
    },
    {
        label: 'Untuk UMKM',
        description: 'Menu yang tidak terjual tetap menghasilkan pendapatan, alih-alih berakhir jadi limbah dapur.',
    },
    {
        label: 'Untuk lingkungan',
        description: 'Setiap porsi yang diselamatkan menekan food loss dan food waste di Indonesia.',
    },
];
export function BenefitsSection() {
    return (<section id="manfaat" aria-labelledby="benefits-heading" className="grain-overlay bg-primary text-primary-foreground">

      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">

        <Reveal>

          <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/60">

            Kenapa layak

          </p>

          <h2 id="benefits-heading" className="mt-4 max-w-3xl text-balance font-display text-[clamp(1.95rem,3.9vw,3.15rem)] font-semibold leading-[1.06] tracking-[-0.035em] text-primary-foreground">

            Menyelamatkan makanan terasa{' '}

            <span className="font-light italic">ringan</span> saat dilakukan

            bersama.

          </h2>

        </Reveal>



        <dl className="mt-11 grid gap-8 border-t border-white/15 pt-9 sm:mt-14 sm:grid-cols-3 sm:gap-0">

          {BENEFITS.map((benefit, index) => (<Reveal key={benefit.label} delay={0.05 + index * 0.06} className={index > 0
                ? 'sm:border-l sm:border-white/15 sm:pl-8 lg:pl-10'
                : 'sm:pr-8 lg:pr-10'}>

              <dt className="font-display text-lg font-semibold tracking-tight text-white sm:text-xl">

                {benefit.label}

              </dt>

              <dd className="mt-3 text-sm leading-[1.8] text-primary-foreground/70">

                {benefit.description}

              </dd>

            </Reveal>))}

        </dl>



        <Reveal delay={0.1}>

          <p className="mt-11 max-w-2xl border-l-2 border-white/30 pl-5 font-display text-base italic leading-relaxed text-primary-foreground/80 sm:mt-14 sm:text-lg">

            Satu porsi yang diselamatkan hari ini adalah satu porsi yang tidak

            berakhir di tempat sampah.

          </p>

        </Reveal>

      </div>

    </section>);
}
