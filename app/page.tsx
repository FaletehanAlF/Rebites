
"use client";

import { useEffect, useState } from "react";
import { SmoothScroll } from "@/app/components/smooth-scroll";
import { Preloader } from "@/app/components/preloader";
import { SiteFooter } from "@/app/components/site-footer";
import { Reveal } from "./components/shared/reveal";
import { Marquee } from "@/app/components/shared/marquee";
import HowItWorks from "@/app/components/HowItWorks";
import { HeroSection } from "@/app/components/hero-section";
import { HeroFoodCarousel } from "@/app/components/hero-food-carousel";
import { SmartImage } from "./components/shared/SmartImage";
import { SubscriptionSection } from "@/app/components/subscription/subscription-section";
import { FaqSection } from "@/app/components/faq-section";
import { FlashSaleGrid } from "@/app/components/flash-sale-grid";
import { TestimonialsColumn } from "@/app/components/ui/testimonials";
import { fetchVendors } from "@/lib/catalog";

type Testimonial = {
  name: string;
  role: string;
  quote: string;
  rating: number;
  initials: string;
  photo: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Rina Astuti",
    role: "Pemilik Dapur Ibu Sri",
    quote:
      "Awalnya mencoba paket Trial karena penasaran, dan hasilnya melebihi ekspektasi. Makanan yang biasanya tersisa kini lebih cepat habis, serta laporan penjualannya mudah dipahami.",
    rating: 5,
    initials: "RA",
    photo:
      "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop",
  },
  {
    name: "Arga Zanuar",
    role: "Pembeli setia",
    quote:
      "Sekarang pada jam makan siang saya selalu mengecek ReBites lebih dulu. Harganya lebih hemat, tetapi kualitas makanannya tetap terjaga. Sangat membantu untuk kebutuhan harian.",
    rating: 5,
    initials: "AZ",
    photo:
      "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop",
  },
  {
    name: "Dewi Lestari",
    role: "Kue Mbok Darmi",
    quote:
      "Sejak menggunakan paket Standar, produk saya semakin sering dilihat pembeli. Beberapa pelanggan baru bahkan mengenal usaha kami melalui ReBites dan turut memperluas jangkauan bisnis.",
    rating: 5,
    initials: "DL",
    photo:
      "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop",
  },
  {
    name: "Abdurrahman Kaysan",
    role: "Pelanggan rutin",
    quote:
      "Saya kerap memesan ketika tidak sempat keluar rumah. Soto Mie Bogornya lezat dengan harga yang wajar. Sudah beberapa kali membeli dan selalu merasa puas.",
    rating: 4,
    initials: "AK",
    photo:
      "https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop",
  },
  {
    name: "Mang Teten",
    role: "Warung Mang Teten",
    quote:
      "Dulu makanan yang tidak habis sering menjadi kebingungan. Kini saya dapat menawarkannya melalui ReBites sehingga makanan tidak terbuang sia-sia sekaligus menambah pemasukan.",
    rating: 5,
    initials: "MT",
    photo:
      "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop",
  },
  {
    name: "Falen Darmawan",
    role: "Mahasiswa",
    quote:
      "Sebagai perantau, ReBites sangat membantu. Saya bisa mendapatkan makanan berkualitas dengan harga yang lebih hemat dan selalu mengeceknya sebelum membeli.",
    rating: 5,
    initials: "FD",
    photo:
      "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop",
  },
];

const FALLBACK_STORES = [
  "Dapur Ibu Sri",
  "Kue Mbok Darmi",
  "Warung Mang Teten",
  "Soto Mie Bogor",
  "Kopi Nusantara",
  "Bakso Pak Joko",
  "Ayam Geprek Sambal",
  "Es Teh Segar",
];

export default function Home() {
  const [partners, setPartners] = useState<string[]>([]);

  // Ambil nama mitra langsung dari database.
  useEffect(() => {
    let active = true;

    fetchVendors().then((vendors) => {
      if (active) {
        setPartners(vendors.map((vendor) => vendor.name).filter(Boolean));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const stores = partners.length > 0 ? partners : FALLBACK_STORES;

  return (
    <SmoothScroll>
      <Preloader />

      {/* HERO */}
      <div className="flex min-h-screen flex-col">
        <div id="top" className="flex flex-1 flex-col">
          <HeroSection />
        </div>

        {/* PARTNER MARQUEE */}
        <section
          data-nav="cream"
          aria-label="Mitra ReBites"
          className="border-y border-hairline bg-cream py-5 lg:py-6"
        >
          <div className="[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <Marquee pauseOnHover>
              {stores.map((store, index) => (
                <span
                  key={`${store} -${index} `}
                  className="mx-6 flex items-center font-display text-lg font-light tracking-tight text-primary/45 lg:text-xl"
                >
                  {store}

                  <span
                    aria-hidden
                    className="ml-6 h-1 w-1 rounded-full bg-caramel/70"
                  />
                </span>
              ))}
            </Marquee>
          </div>
        </section>
      </div>

      {/* REKOMENDASI */}
      <div id="rekomendasi">
        <HeroFoodCarousel />
        <FlashSaleGrid />
      </div>

      {/* ABOUT */}
      <section
        id="about"
        data-nav="cream"
        className="grain-overlay relative flex min-h-[100svh] scroll-mt-28 flex-col justify-center overflow-hidden bg-cream pt-24 pb-14 text-forest-dark lg:scroll-mt-32 lg:pt-32 lg:pb-16"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-primary/[0.06] blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal delay={0.05}>
            <div className="mb-10 text-center lg:mb-14">
              <h2 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] font-light leading-[1.05] tracking-[-0.02em] text-forest-dark">
                Kenali{" "}
                <span className="italic text-caramel">ReBites</span>
              </h2>

              <p className="mt-2 font-display text-[clamp(1.25rem,2.2vw,1.75rem)] font-light italic tracking-[-0.01em] text-caramel/90">
                lebih dalam
              </p>
            </div>
          </Reveal>

          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
            {/* LEFT */}
            <div>
              <Reveal delay={0.15}>
                <h2 className="font-display text-[clamp(2rem,4vw,3.2rem)] font-light leading-[1.02] tracking-[-0.02em] text-forest-dark">
                  <span className="block whitespace-nowrap">
                    Bukan sekadar
                  </span>

                  <span className="block whitespace-nowrap">
                    menyelamatkan makanan.
                  </span>
                </h2>
              </Reveal>

              <Reveal delay={0.1}>
                <div className="relative mt-5 h-[21rem] w-full max-w-[34rem] overflow-hidden rounded-3xl shadow-[0_20px_40px_-24px_rgba(0,0,0,0.55)]">
                  <SmartImage
                    src="https://images.pexels.com/photos/30684081/pexels-photo-30684081.jpeg?auto=compress&cs=tinysrgb&w=1200"
                    alt="Makanan terbuang yang seharusnya bisa diselamatkan dari food waste"
                    sizes="(min-width: 1024px) 30vw, 100vw"
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
                      className="border-t border-hairline pt-4"
                    >
                      <p className="whitespace-nowrap font-display text-[clamp(1.6rem,2.6vw,2.2rem)] font-light leading-none tracking-[-0.02em] text-forest-dark">
                        <span
                          className={
                            stat.compact ? "text-[0.82em]" : undefined
                          }
                        >
                          {stat.value}
                        </span>
                      </p>

                      <p className="mt-1 font-sans text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {stat.unit}
                      </p>

                      <p className="mt-2 font-sans text-xs leading-[1.6] text-forest-dark/80">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* RIGHT */}
            <div className="flex flex-col gap-6">
              <Reveal delay={0.15}>
                <h3 className="font-display text-[clamp(1.5rem,2.6vw,2rem)] font-light leading-[1.1] tracking-[-0.02em] text-forest-dark">
                  Untuk <span className="text-caramel">UMKM</span>. Untuk{" "}
                  <span className="text-caramel">masyarakat</span>. Untuk{" "}
                  <span className="text-caramel">lingkungan</span>.
                </h3>
              </Reveal>

              <div className="grid gap-4 sm:grid-cols-3">
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
                ].map((item, index) => (
                  <Reveal
                    key={item.num}
                    delay={0.2 + index * 0.08}
                  >
                    <div className="group flex h-full cursor-pointer flex-col rounded-[var(--radius)] border border-hairline bg-white p-6 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 hover:border-caramel sm:p-7">
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
                <p className="mt-2 max-w-xl font-sans text-sm leading-[1.85] text-forest-dark">
                  <span className="font-semibold text-caramel">
                    ReBites
                  </span>{" "}
                  adalah marketplace khusus bagi pelaku UMKM untuk menjual
                  makanan surplus yang masih layak konsumsi. Pangan yang
                  berpotensi terbuang kembali bernilai — pelaku usaha
                  memperoleh pendapatan tambahan, pembeli menikmati makanan
                  berkualitas dengan harga yang lebih terjangkau.
                </p>
              </Reveal>

              <Reveal delay={0.25}>
                <p className="max-w-xl font-sans text-sm leading-[1.85] text-forest-dark">
                  Saat ini{" "}
                  <span className="font-semibold text-caramel">
                    ReBites
                  </span>{" "}
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

      {/* HOW IT WORKS */}
      <HowItWorks />

      {/* SUBSCRIPTION */}
      <SubscriptionSection />

      {/* TESTIMONIALS */}
      <section
        id="testimoni"
        data-nav="green"
        className="grain-overlay relative scroll-mt-28 overflow-hidden bg-primary pt-16 pb-16 lg:scroll-mt-32 lg:pt-20 lg:pb-20"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary-foreground/[0.06] blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
              <Reveal delay={0.1}>
                <h2 className="mt-6 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[1.02] tracking-[-0.02em] text-primary-foreground">
                  Apa kata mereka setelah{" "}
                  <span>menggunakan</span> ReBites.
                </h2>
              </Reveal>

              <Reveal delay={0.15}>
                <p className="mx-auto mt-5 max-w-md font-sans text-sm leading-relaxed text-primary-foreground/70 lg:mx-0">
                  Simak pengalaman pelaku UMKM dan pembeli dalam menjual serta
                  menikmati makanan berkualitas dengan lebih hemat.
                </p>
              </Reveal>
            </div>
          </div>

          <Reveal delay={0.1}>
            <div className="relative mt-12 flex max-h-[620px] justify-center gap-6 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)] lg:mt-16">
              {[0, 1, 2].map((column) => (
                <TestimonialsColumn
                  key={column}
                  className={`max-h-full w-full max-w-xs ${
                    column === 1
                      ? "hidden sm:block"
                      : column === 2
                        ? "hidden lg:block"
                        : ""
                  }`}
                  testimonials={TESTIMONIALS.filter(
                    (_, index) => index % 3 === column,
                  )}
                  duration={
                    column === 1 ? 14 : column === 2 ? 18 : 12
                  }
                />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection />

      {/* FOOTER */}
      <SiteFooter />
    </SmoothScroll>
  );
}
