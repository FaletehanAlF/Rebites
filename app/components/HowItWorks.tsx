"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
  const railRef = useRef<HTMLDivElement>(null);
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
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
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
          <div
            ref={railRef}
            aria-hidden
            className="absolute bottom-6 left-4 top-6 w-px bg-primary-foreground/25 sm:left-5"
          />
          <div
            aria-hidden
            className="absolute left-4 top-6 w-px origin-top bg-primary-foreground transition-[height] duration-150 sm:left-5"
            style={{
              height: railRef.current
                ? `${progress * (railRef.current.offsetHeight || 0)}px`
                : "0px",
            }}
          />

          <ol className="flex flex-col gap-10 lg:gap-14">
            {steps.map((step, i) => {
              const active = progress >= (i + 0.5) / steps.length - 0.05;
              return (
                <li key={step.title} className="relative pl-14 sm:pl-16">
                  <span
                    aria-hidden
                    className={`absolute left-4 top-1.5 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 transition-colors duration-300 sm:left-5 ${
                      active
                        ? "border-primary-foreground bg-primary-foreground"
                        : "border-primary-foreground/40 bg-primary"
                    }`}
                  />
                  <Reveal delay={0.05 * i}>
                    <h3 className="font-display text-xl font-medium text-primary-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2 max-w-xl font-sans text-sm leading-[1.7] text-primary-foreground/70">
                      {step.description}
                    </p>
                    <div className="relative mt-4 h-44 w-full overflow-hidden rounded-xl border border-primary-foreground/15 sm:h-56">
                      <Image
                        src={step.image}
                        alt={step.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 640px"
                        className="object-cover"
                      />
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
