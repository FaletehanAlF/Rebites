"use client";

import { Reveal } from "@/app/components/shared/reveal";
import ReBitesStepCard, { type Step } from "@/app/components/ReBitesStepCard";

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
  return (
    <section
      id="cara-kerja"
      data-nav="green"
      className="flex min-h-[100svh] flex-col overflow-hidden bg-primary pt-20 pb-16 lg:pt-20 lg:pb-20"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
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

        <Reveal delay={0.15}>
          <div className="mt-10 lg:mt-12">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => (
                <ReBitesStepCard key={step.title} step={step} />
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
