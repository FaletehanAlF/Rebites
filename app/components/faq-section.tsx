"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/app/components/shared/reveal";
import { SmartImage } from "@/app/components/shared/SmartImage";

const FAQS = [
  {
    q: "Apa itu ReBites?",
    a: "ReBites adalah marketplace khusus makanan surplus yang masih layak konsumsi. ReBites mempertemukan pelaku UMKM dengan pembeli di Kota Depok untuk menjual makanan yang berpotensi menjadi food waste dengan harga lebih terjangkau. Dengan begitu, ReBites membantu mengurangi pemborosan pangan sekaligus membuka peluang tambahan pendapatan bagi UMKM.",
  },

  {
    q: "Bagaimana cara memesan makanan di ReBites?",
    a: "Buat akun, cari makanan surplus yang tersedia di sekitarmu, lalu lihat detail produk yang ingin dibeli. Tentukan jumlah pembelian, pilih metode penerimaan pesanan, yaitu diantar atau diambil langsung, kemudian pilih metode pembayaran dan selesaikan pembayaran.",
  },

  {
    q: "Apakah makanan surplus di ReBites aman dikonsumsi?",
    a: "Ya. Makanan yang dijual di ReBites merupakan makanan surplus yang masih layak konsumsi, seperti makanan yang memiliki kelebihan produksi atau belum habis terjual hingga akhir waktu operasional. Setiap penjual mencantumkan informasi produk dan waktu pengambilan agar makanan dapat diterima dan dikonsumsi dalam kondisi yang sesuai.",
  },

  {
    q: "Bagaimana cara UMKM mulai berjualan di ReBites?",
    a: "Daftarkan usahamu sebagai pelaku UMKM melalui halaman registrasi, lengkapi profil usaha, lalu tambahkan makanan surplus yang ingin dijual beserta harga, stok, dan waktu penjualannya. Kamu dapat memulai dengan paket Trial yang tersedia secara gratis.",
  },

  {
    q: "Berapa biaya untuk menggunakan ReBites?",
    a: "Untuk pembeli, tidak ada biaya langganan untuk menggunakan ReBites. Pembeli cukup membayar sesuai harga makanan dan biaya lain yang ditampilkan pada halaman pembayaran, jika ada. Untuk pelaku UMKM, tersedia pilihan paket langganan Trial, Standar, dan Premium yang dapat disesuaikan dengan kebutuhan usaha.",
  },

  {
    q: "Area mana saja yang sudah dilayani ReBites?",
    a: "Saat ini, ReBites beroperasi khusus di Kota Depok. Depok menjadi langkah awal untuk membangun ekosistem penyelamatan makanan sebelum ReBites berkembang ke wilayah lainnya.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("nama", (data.get("nama") as string) || "Pengunjung");
    data.set("pesan", (data.get("pesan") as string) || "");

    setStatus("sending");
    try {
      const res = await fetch("https://formspree.io/f/xdeoorwd", {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Gagal mengirim");
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  };

  return (
    <section
      id="faq"
      data-nav="cream"
      className="grain-overlay relative scroll-mt-28 overflow-hidden bg-cream lg:scroll-mt-32"
    >
      <div className="relative mx-auto max-w-7xl px-5 pt-20 pb-12 sm:px-8 lg:px-12 lg:pb-12 lg:pt-28">
        {/* Section label & heading */}
        <div className="mx-auto max-w-2xl text-center">
          <Reveal delay={0.05}>
            <span className="inline-flex items-center rounded-full border border-hairline bg-white px-5 py-2 font-sans text-xs font-bold uppercase tracking-[0.25em] text-forest">
              FAQ
            </span>
          </Reveal>

          <Reveal delay={0.1}>
            <h2 className="mt-6 font-display font-light leading-[1.05] tracking-[-0.02em] text-forest-dark [font-size:clamp(1.9rem,3.8vw,2.9rem)]">
              Pertanyaan yang Sering
            </h2>
            <p className="mt-1 font-display italic leading-[1.05] text-caramel [font-size:clamp(2.4rem,5vw,4rem)]">
              Diajukan
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid items-start gap-8 lg:grid-cols-[55fr_45fr] lg:items-stretch lg:gap-10">
          {/* Left - contact form */}
          <Reveal delay={0.15} className="h-full">
            <div className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-white p-6 shadow-[0_10px_30px_-24px_rgba(27,77,50,0.3)] transition-all duration-300 hover:-translate-y-1 hover:border-caramel/40 hover:shadow-[0_30px_60px_-28px_rgba(27,77,50,0.35)] sm:p-8 lg:p-9">
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Hubungi Kami
                </p>
                <h3 className="mt-2 font-display text-2xl font-medium tracking-tight text-primary sm:text-3xl">
                  Punya pertanyaan lain?
                </h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
                  Kirim pesan melalui formulir ini, tim kami akan segera
                  membalas ke email Anda.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-7 flex flex-1 flex-col gap-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="font-sans text-xs font-semibold text-primary">
                      Nama
                    </span>
                    <input
                      type="text"
                      name="nama"
                      required
                      placeholder="Nama Anda"
                      className="rounded-xl border border-hairline bg-cream px-4 py-3 font-sans text-sm text-primary placeholder:text-stone focus:border-caramel focus:outline-none focus:ring-2 focus:ring-caramel/30"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="font-sans text-xs font-semibold text-primary">
                      Email
                    </span>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="nama@email.com"
                      className="rounded-xl border border-hairline bg-cream px-4 py-3 font-sans text-sm text-primary placeholder:text-stone focus:border-caramel focus:outline-none focus:ring-2 focus:ring-caramel/30"
                    />
                  </label>
                </div>

                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="font-sans text-xs font-semibold text-primary">
                    Pesan
                  </span>
                  <textarea
                    name="pesan"
                    required
                    rows={5}
                    placeholder="Tulis pertanyaan atau pesan Anda di sini…"
                    className="flex-1 resize-none rounded-xl border border-hairline bg-cream px-4 py-3 font-sans text-sm text-primary placeholder:text-stone focus:border-caramel focus:outline-none focus:ring-2 focus:ring-caramel/30"
                  />
                </label>

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-primary px-7 py-3.5 font-sans text-sm font-semibold text-cream transition-all duration-300 hover:-translate-y-0.5 hover:bg-caramel hover:text-white disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:bg-primary"
                >
                  <Mail className="h-4 w-4" />
                  {status === "sending" ? "Mengirim…" : "Kirim Pesan"}
                </button>

                <AnimatePresence>
                  {status === "success" && (
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="font-sans text-sm font-medium text-forest"
                    >
                      Terima kasih! Pesan Anda sudah terkirim. Tim kami akan
                      segera menghubungi Anda.
                    </motion.p>
                  )}

                  {status === "error" && (
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="font-sans text-sm font-medium text-sale"
                    >
                      Gagal mengirim pesan. Silakan coba lagi.
                    </motion.p>
                  )}
                </AnimatePresence>
              </form>
            </div>
          </Reveal>

          {/* Right - FAQ card */}
          <Reveal delay={0.1} className="h-full">
            <div className="flex h-full flex-col sm:p-2">
              {/* Accordion bars */}
              <div className="flex flex-1 flex-col gap-3.5">
                {FAQS.map((faq, i) => {
                  const isOpen = open === i;
                  return (
                    <div
                      key={faq.q}
                      className={cn(
                        "overflow-hidden rounded-2xl bg-white transition-all duration-300",
                        isOpen
                          ? "shadow-[0_18px_40px_-28px_rgba(30,43,32,0.35)] ring-1 ring-caramel/40"
                          : "hover:ring-1 hover:ring-caramel/30",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : i)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <span className="font-sans text-sm font-semibold leading-snug tracking-tight text-primary sm:text-[15px]">
                          {faq.q}
                        </span>

                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-cream transition-transform duration-300">
                          <Plus
                            className={cn(
                              "h-4 w-4 transition-transform duration-300",
                              isOpen && "rotate-45",
                            )}
                          />
                        </span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              duration: 0.35,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="overflow-hidden"
                          >
                            <p className="px-5 pb-5 font-sans text-sm leading-[1.8] text-forest">
                              {faq.a}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Signature */}
        <Reveal delay={0.15}>
          <div className="mt-16 text-center lg:mt-20">
            <p className="font-script text-primary [font-size:clamp(2.2rem,4vw,3.2rem)]">
              dibuat dengan rasa
            </p>
            <p className="mt-3 font-sans text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              Untuk Setiap Gigitan
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
