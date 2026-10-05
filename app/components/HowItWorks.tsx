"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/app/components/reveal";

type Step = {
  title: string;
  description: string;
  image: string;
};

const steps: Step[] = [
  {
    title: "Pelaku UMKM Mendaftar & Mengunggah",
    description:
      "Pelaku UMKM mendaftar akun, melengkapi profil usaha, lalu mengunggah makanan surplus yang masih layak konsumsi beserta harga, stok, dan waktu penjualannya.",
    image: "/penjual-login.jpg",
  },
  {
    title: "Pembeli Mencari & Memesan",
    description:
      "Pembeli mencari dan melihat detail produk surplus di sekitarnya, lalu menentukan jumlah pembelian dan menambahkan catatan pesanan.",
    image: "/pembeli-mencaro.jpg",
  },
  {
    title: "Pilih Metode Penerimaan Pesanan",
    description:
      "Pembeli memilih metode penerimaan pesanan, yaitu diantar atau diambil langsung di lokasi penjual, serta memilih metode pembayaran.",
    image: "/penerimaan.jpg",
  },
  {
    title: "Makanan Berhasil Diselamatkan!",
    description:
      "Nikmati makanan berkualitas dengan harga yang lebih terjangkau, sekaligus membantu mengurangi food waste dan food loss di Indonesia.",
    image: "/terselamatkan.jpg",
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const viewport = window.innerHeight;
      const total = rect.height - viewport * 0.4;
      const passed = viewport * 0.6 - rect.top;
      setProgress(Math.min(1, Math.max(0, passed / Math.max(total, 1))));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section
      id="cara-kerja"
      data-nav="green"
      ref={sectionRef}
      className="flex flex-col overflow-hidden bg-primary pt-20 pb-16 lg:pt-20 lg:pb-20"
    >
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal delay={0.05}>
          <h2 className="text-center font-display text-[clamp(2rem,4vw,3.375rem)] font-light leading-[1.1] tracking-[-0.01em] text-primary-foreground">
            Cara Kerja ReBites
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mx-auto mt-3 max-w-[560px] text-center font-sans text-sm font-normal leading-relaxed text-primary-foreground/70 lg:text-base">
            Langkah mudah untuk menjual dan membeli makanan surplus yang masih
            layak konsumsi, sekaligus membantu mengurangi food waste di
            Indonesia.
          </p>
        </Reveal>

        <div className="relative mt-12 lg:mt-16">
          {/* Center rail (md+) / left rail (mobile) */}
          <div
            aria-hidden
            className="absolute bottom-6 left-4 top-6 w-px bg-primary-foreground/20 md:left-1/2"
          />
          <div
            aria-hidden
            className="absolute left-4 top-6 w-px bg-caramel transition-[height] duration-150 md:left-1/2"
            style={{ height: `calc(${Math.min(progress, 1) * 100}% - 3rem)` }}
          />

          <ol className="flex flex-col gap-6 md:gap-8">
            {steps.map((step, i) => {
              const active = progress >= (i + 0.5) / steps.length - 0.05;
              const right = i % 2 === 1;
              return (
                <li
                  key={step.title}
                  className="relative pl-12 md:grid md:grid-cols-2 md:gap-12 md:pl-0"
                >
                  <span
                    aria-hidden
                    className={`absolute left-4 top-2 h-4 w-4 -translate-x-1/2 rounded-full border-2 transition-colors duration-300 md:left-1/2 md:top-6 ${
                      active
                        ? "border-caramel bg-caramel"
                        : "border-primary-foreground/40 bg-primary"
                    }`}
                  />

                  <div
                    className={`${
                      right ? "md:col-start-2" : "md:col-start-1"
                    }`}
                  >
                    <Reveal
                      once={false}
                      delay={0.08}
                      duration={0.9}
                      variants={{
                        hidden: {
                          opacity: 0,
                          y: 48,
                          scale: 0.96,
                          filter: "blur(10px)",
                        },
                        visible: {
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          filter: "blur(0px)",
                        },
                      }}
                    >
                      <div className="rounded-xl border border-primary-foreground/10 bg-white p-5 text-left shadow-[0_12px_40px_-24px_rgba(0,0,0,0.45)]">
                        <span className="inline-block rounded bg-caramel px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-wider text-white">
                          Langkah {i + 1}
                        </span>
                        <h3 className="mt-3 font-display text-lg font-medium text-primary">
                          {step.title}
                        </h3>
                        <p className="mt-1.5 font-sans text-sm leading-[1.6] text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </Reveal>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
