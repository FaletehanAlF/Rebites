'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal } from '@/app/components/shared/reveal';

const FAQS = [
  {
    q: 'Apa itu ReBites?',
    a: 'ReBites adalah marketplace khusus makanan surplus yang masih layak konsumsi. ReBites mempertemukan pelaku UMKM dengan pembeli di Kota Depok untuk menjual makanan yang berpotensi menjadi food waste dengan harga lebih terjangkau — sekaligus membuka peluang pendapatan tambahan bagi UMKM.',
  },
  {
    q: 'Apakah makanan yang dijual masih layak dikonsumsi?',
    a: 'Ya. Makanan yang dijual merupakan surplus yang masih layak konsumsi, seperti makanan dengan kelebihan produksi atau yang belum habis terjual pada hari itu. Setiap penjual mencantumkan informasi produk dan waktu penerimaan agar makanan diterima dalam kondisi yang sesuai.',
  },
  {
    q: 'Bagaimana cara membeli makanan di ReBites?',
    a: 'Buat akun, lalu telusuri katalog lewat kategori atau kata kunci. Setiap produk menampilkan harga, sisa stok, dan jam ketersediaan sebelum kamu memesan. Setelah itu tentukan jumlah pembelian, pilih metode penerimaan pesanan — diantar atau diambil langsung di lokasi penjual — kemudian selesaikan pembayaran.',
  },
  {
    q: 'Bagaimana UMKM bisa bergabung?',
    a: 'Daftar melalui jalur penjual, lengkapi profil usaha dan jam operasional, lalu unggah makanan surplus beserta harga, stok, dan waktu penjualannya. Setelah itu menu langsung tampil ke pembeli di Depok, dan pesanan masuk bisa dipantau dari dashboard penjual.',
  },
  {
    q: 'Di mana ReBites tersedia?',
    a: 'Saat ini ReBites beroperasi khusus di Kota Depok. Depok menjadi langkah awal untuk membangun ekosistem penyelamatan makanan sebelum ReBites berkembang ke wilayah lainnya.',
  },
  {
    q: 'Bagaimana cara menghubungi ReBites?',
    a: 'Kirim pesan lewat halaman Hubungi Kami, atau email langsung ke halo@rebites.id. Sertakan detail pesanan atau kendala yang kamu alami agar bisa kami bantu lebih cepat.',
  },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * FAQ di ujung halaman landing — hanya akordeon, tanpa formulir. Kontak
 * dipindahkan ke halaman `/hubungi-kami` supaya pertanyaan dan cara
 * menghubungi tidak lagi bersaing dalam satu kartu.
 *
 * Tiap pertanyaan adalah heading `h3` berisi tombol sungguhan, dengan
 * `aria-expanded`/`aria-controls` dan region yang dilabeli — panel bisa
 * dibuka-tutup lewat keyboard.
 */
export function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="grain-overlay bg-secondary"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              Pertanyaan umum
            </p>
            <h2
              id="faq-heading"
              className="mt-4 text-balance font-display text-[clamp(1.8rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary"
            >
              Hal yang paling sering{' '}
              <span className="font-light italic">ditanyakan</span>.
            </h2>
            <p className="mt-5 text-[15px] leading-[1.8] text-muted-foreground">
              Tidak menemukan jawabannya?{' '}
              <Link
                href="/hubungi-kami"
                className={`font-medium text-primary underline underline-offset-4 hover:text-primary-dark ${FOCUS_RING}`}
              >
                Hubungi kami
              </Link>
              .
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mx-auto mt-10 max-w-3xl border-t border-border sm:mt-12">
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
                        'flex w-full items-start justify-between gap-5 py-5 text-left transition-colors duration-200',
                        FOCUS_RING,
                      )}
                    >
                      <span
                        className={cn(
                          'font-display text-[15px] font-semibold leading-snug tracking-tight transition-colors duration-200 sm:text-base',
                          isOpen
                            ? 'text-primary'
                            : 'text-foreground hover:text-primary',
                        )}
                      >
                        {faq.q}
                      </span>

                      <span
                        aria-hidden
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300',
                          isOpen
                            ? 'border-primary bg-primary text-white'
                            : 'border-border text-primary hover:border-primary',
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
                          duration: 0.3,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-2xl pb-5 pr-10 text-sm leading-[1.8] text-muted-foreground">
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
    </section>
  );
}
