import { Reveal, RevealWords } from "@/app/components/shared/reveal";
import { SmartImage } from "@/app/components/shared/SmartImage";
import { LandingShell } from "@/app/components/landing/landing-shell";
import { PartnerMarquee } from "@/app/components/landing/partner-marquee";
import { CatalogSections } from "@/app/components/landing/catalog-sections";
import { TestimonialSection } from "@/app/components/landing/testimonial-section";
import { HeroSection } from "@/app/components/hero-section";
import HowItWorks from "@/app/components/HowItWorks";
import { SubscriptionSection } from "@/app/components/subscription/subscription-section";
import { FaqSection } from "@/app/components/faq-section";
import { SiteFooter } from "@/app/components/site-footer";

/**
 * Landing page is a Server Component: the "about" copy, stats and grid below
 * are static markup, so they render to HTML once and never enter the client
 * bundle or the hydration pass. Only the parts that need the browser are
 * client components — hero, catalog sections, marquee, testimonials, FAQ.
 */
export default function Home() {
  return (
    <LandingShell>
      <div className="flex min-h-screen flex-col">
        <div id="top" className="flex flex-1 flex-col">
          <HeroSection />
        </div>

        <PartnerMarquee />
      </div>

      <section
        id="about"
        data-nav="green"
        className="grain-overlay relative flex min-h-[100svh] scroll-mt-28 flex-col justify-center overflow-hidden bg-primary pt-24 pb-14 text-primary-foreground lg:scroll-mt-32 lg:pt-32 lg:pb-16"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-primary-foreground/[0.06] blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal delay={0.05}>
            <div className="mb-10 text-center lg:mb-14">
              <h2 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] font-light leading-[1.05] tracking-[-0.02em] text-primary-foreground">
                Kenali <span className="italic text-caramel">ReBites</span>
              </h2>
              <p className="mt-2 font-display text-[clamp(1.25rem,2.2vw,1.75rem)] font-light italic tracking-[-0.01em] text-caramel/90">
                lebih dalam
              </p>
            </div>
          </Reveal>

          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
            <div>
              <Reveal delay={0.15}>
                {/* `whitespace-nowrap` (desain asli: 2 baris) baru aman mulai
                    breakpoint sm. Di 320-400px kalimat "menyelamatkan
                    makanan." lebih lebar dari kolomnya dan terpotong oleh
                    overflow-hidden section — jadi di bawah sm biarkan wrap. */}
                <h2 className="font-display text-[clamp(2rem,4vw,3.2rem)] font-light leading-[1.02] tracking-[-0.02em] text-primary-foreground">
                  <span className="block sm:whitespace-nowrap">
                    <RevealWords text="Bukan sekadar" />
                  </span>
                  <span className="block sm:whitespace-nowrap">
                    <RevealWords text="menyelamatkan" />{" "}
                    <RevealWords text="makanan." />
                  </span>
                </h2>
              </Reveal>

              <Reveal delay={0.1}>
                <div className="relative mt-5 h-[21rem] w-full max-w-[34rem] overflow-hidden rounded-3xl shadow-[0_20px_40px_-24px_rgba(0,0,0,0.55)]">
                  <SmartImage
                    src="https://images.pexels.com/photos/30684081/pexels-photo-30684081.jpeg?auto=compress&cs=tinysrgb&w=1200"
                    alt="Makanan terbuang yang seharusnya bisa diselamatkan dari food waste"
                    sizes="(min-width: 1024px) 34rem, (min-width: 640px) min(34rem, calc(100vw - 3rem)), calc(100vw - 2rem)"
                  />
                </div>
              </Reveal>

              <Reveal delay={0.15}>
                <div className="mt-8 grid w-full max-w-[34rem] grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3">
                  {[
                    {
                      value: "23–48",
                      unit: "juta ton",
                      label: "Food loss & waste setiap tahun",
                    },
                    {
                      value: "29–47%",
                      unit: "populasi",
                      label: "Bisa diberi makan dari pangan terbuang",
                    },
                    {
                      value: "Rp213–551",
                      unit: "triliun per tahun",
                      label: "Perkiraan kerugian ekonomi dari food waste",
                      compact: true,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="border-t border-primary-foreground/15 pt-4"
                    >
                      <p className="whitespace-nowrap font-display text-[clamp(1.6rem,2.6vw,2.2rem)] font-light leading-none tracking-[-0.02em] text-cream">
                        <span className={stat.compact ? "text-[0.82em]" : undefined}>
                          {stat.value}
                        </span>
                      </p>
                      <p className="mt-1 font-sans text-xs font-medium uppercase tracking-wide text-primary-foreground/80">
                        {stat.unit}
                      </p>
                      <p className="mt-2 font-sans text-xs leading-[1.6] text-primary-foreground/90">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            <div className="flex flex-col gap-6">
              <Reveal delay={0.15}>
                <h3 className="font-display text-[clamp(1.5rem,2.6vw,2rem)] font-light leading-[1.1] tracking-[-0.02em] text-primary-foreground">
                  Untuk <span className="text-caramel">UMKM</span>. Untuk{" "}
                  <span className="text-caramel">masyarakat</span>. Untuk{" "}
                  <span className="text-caramel">lingkungan</span>.
                </h3>
              </Reveal>

                {/* Di 1024-1279px kolom kanan sempit (±417px): 3 kartu berarti
                    konten hanya 70px, sementara judul "Masyarakat"/"Lingkungan"
                    butuh ±106px — teks meluber ke luar kartu dan tak terbaca di
                    atas background hijau. 2 kolom di rentang itu, kembali ke 3
                    sejak xl saat kolomnya sudah cukup lebar. */}
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {[
                  {
                    num: "01",
                    title: "UMKM",
                    desc: "Mendapatkan pendapatan tambahan dari makanan surplus yang masih layak konsumsi.",
                  },
                  {
                    num: "02",
                    title: "Masyarakat",
                    desc: "Menikmati makanan berkualitas dengan harga yang lebih terjangkau.",
                  },
                  {
                    num: "03",
                    title: "Lingkungan",
                    desc: "Mengurangi food loss dan food waste lewat pemanfaatan pangan secara optimal.",
                  },
                ].map((item, i) => (
                  <Reveal key={item.num} delay={0.2 + i * 0.08}>
                    <div className="group flex h-full cursor-pointer flex-col rounded-[var(--radius)] border border-white/10 bg-white p-6 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 hover:border-caramel sm:p-7">
                      <span className="font-sans text-sm italic tracking-[0.2em] text-caramel">
                        {item.num}
                      </span>

                      <h3 className="mt-4 font-sans text-xl font-semibold tracking-tight text-primary">
                        {item.title}
                      </h3>

                      <p className="mt-3 font-sans text-sm leading-[1.8] text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>

              <Reveal delay={0.2}>
                <p className="mt-2 max-w-xl font-sans text-sm leading-[1.85] text-primary-foreground">
                  <span className="font-semibold text-caramel">ReBites</span>{" "}
                  adalah marketplace khusus bagi pelaku UMKM untuk menjual
                  makanan surplus yang masih layak konsumsi. Pangan yang
                  berpotensi terbuang kembali bernilai - pelaku usaha
                  memperoleh pendapatan tambahan, pembeli menikmati makanan
                  berkualitas dengan harga yang lebih terjangkau.
                </p>
              </Reveal>

              <Reveal delay={0.25}>
                <p className="max-w-xl font-sans text-sm leading-[1.85] text-primary-foreground">
                  Saat ini{" "}
                  <span className="font-semibold text-caramel">ReBites</span>{" "}
                  beroperasi di{" "}
                  <span className="font-semibold text-caramel">
                    Kota Depok
                  </span>{" "}
                  sebagai langkah awal menghadirkan ekosistem penyelamatan
                  pangan, sebelum meluas ke kota lain.
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <CatalogSections />

      <HowItWorks />

      <SubscriptionSection />

      <TestimonialSection />

      <FaqSection />

      <SiteFooter />
    </LandingShell>
  );
}
