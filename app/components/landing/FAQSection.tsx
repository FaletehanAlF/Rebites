'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Lottie } from 'lottie-react';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Reveal } from '@/app/components/shared/reveal';

type FAQItem = {
  q: string;
  a: string;
};

const FAQS: FAQItem[] = [
  {
    q: 'Apa itu ReBites?',
    a: 'ReBites adalah marketplace makanan surplus yang masih layak konsumsi. ReBites mempertemukan UMKM dengan pembeli di Kota Depok agar makanan berlebih bisa dijual dengan harga lebih terjangkau sekaligus membuka peluang pendapatan tambahan bagi penjual.',
  },
  {
    q: 'Apakah makanan yang dijual masih layak dikonsumsi?',
    a: 'Ya. Makanan yang ditawarkan merupakan surplus yang masih layak konsumsi, misalnya makanan berlebih dari produksi harian atau yang belum terjual. Perhatikan informasi produk, kondisi, dan waktu penerimaan yang dicantumkan penjual sebelum memesan.',
  },
  {
    q: 'Bagaimana cara membeli makanan di ReBites?',
    a: 'Buat akun, lalu jelajahi katalog berdasarkan kategori atau kata kunci. Periksa harga, stok, dan waktu ketersediaan produk. Setelah memilih jumlah, ikuti petunjuk pemesanan dan pilih metode penerimaan yang tersedia.',
  },
  {
    q: 'Bagaimana UMKM bisa bergabung?',
    a: 'Daftar melalui halaman registrasi penjual, lengkapi informasi usaha dan jam operasional, lalu tambahkan produk surplus beserta harga, stok, dan waktu ketersediaannya. Penjual dapat mengelola produk dan memantau pesanan melalui dashboard.',
  },
  {
    q: 'Di mana ReBites tersedia?',
    a: 'Saat ini ReBites berfokus di Kota Depok. Wilayah ini menjadi langkah awal untuk membangun ekosistem penyelamatan makanan sebelum pengembangan ke daerah lainnya.',
  },
  {
    q: 'Bagaimana cara menghubungi ReBites?',
    a: 'Kamu dapat mengunjungi halaman Hubungi Kami atau mengirim email ke halo@rebites.id. Sertakan informasi yang relevan agar pertanyaan atau kendalamu lebih mudah ditindaklanjuti.',
  },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAnimation() {
      try {
        const response = await fetch('/lottie_animation/question.json', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Gagal memuat animasi: ${response.status}`);
        }

        const data: object = await response.json();

        if (!controller.signal.aborted) {
          setAnimationData(data);
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Gagal memuat animasi FAQ:', error);
        }
      }
    }

    loadAnimation();

    return () => controller.abort();
  }, []);

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="border-t border-border bg-white"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          {/* Kolom kiri */}
          <Reveal>
            <div className="lg:sticky lg:top-24">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                FAQ
              </p>

              <h2
                id="faq-heading"
                className="max-w-md text-balance font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-primary"
              >
                Ada yang ingin kamu ketahui?
              </h2>

              <p className="mt-4 max-w-md text-[15px] leading-[1.8] text-muted-foreground">
                Temukan jawaban seputar ReBites, cara membeli makanan surplus,
                dan kesempatan bergabung bagi UMKM.
              </p>

              <div
                aria-hidden="true"
                className="mt-7 hidden w-full max-w-[450px] origin-center lg:block relative -translate-y-20"
              >
                {animationData && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className="transition-transform duration-300 ease-out hover:scale-[1.03]"
                  >
                    <Lottie
                      src="/lottie_animation/question.json"
                      autoplay
                      loop
                      className="h-auto w-full"
                    />
                  </motion.div>
                )}
              </div>

              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                Belum menemukan jawaban?{' '}
                <Link
                  href="/hubungi-kami"
                  className={cn(
                    'font-medium text-primary underline underline-offset-4 hover:text-primary-dark',
                    FOCUS_RING,
                  )}
                >
                  Hubungi kami
                </Link>
                .
              </p>
            </div>
          </Reveal>

          {/* Kolom kanan: accordion */}
          <Reveal delay={0.08}>
            <div className="border-t border-border">
              {FAQS.map((faq, index) => {
                const isOpen = open === index;
                const panelId = `faq-panel-${index}`;
                const buttonId = `faq-button-${index}`;

                return (
                  <div key={faq.q} className="border-b border-border">
                    <h3>
                      <button
                        type="button"
                        id={buttonId}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => setOpen(isOpen ? null : index)}
                        className={cn(
                          'flex w-full items-start justify-between gap-4 py-5 text-left transition-colors duration-200',
                          FOCUS_RING,
                        )}
                      >
                        <span
                          className={cn(
                            'font-display text-sm font-semibold leading-snug tracking-tight transition-colors duration-200 sm:text-[15px]',
                            isOpen
                              ? 'text-primary'
                              : 'text-foreground hover:text-primary',
                          )}
                        >
                          {faq.q}
                        </span>

                        <span
                          aria-hidden="true"
                          className={cn(
                            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
                            isOpen
                              ? 'bg-primary text-white'
                              : 'text-primary',
                          )}
                        >
                          <Plus
                            className={cn(
                              'h-4 w-4 transition-transform duration-300',
                              isOpen && 'rotate-45',
                            )}
                          />
                        </span>
                      </button>
                    </h3>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={panelId}
                          role="region"
                          aria-labelledby={buttonId}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            duration: 0.28,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="overflow-hidden"
                        >
                          <p className="max-w-2xl pb-5 pr-8 text-[13px] leading-[1.85] text-muted-foreground sm:text-sm">
                            {faq.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}