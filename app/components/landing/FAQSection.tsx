'use client';
import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal } from '@/app/components/shared/reveal';
const FAQS = [
    {
        q: 'Apa itu ReBites?',
        a: 'ReBites adalah marketplace khusus makanan surplus yang masih layak konsumsi. ReBites mempertemukan pelaku UMKM dengan pembeli di Kota Depok untuk menjual makanan yang berpotensi menjadi food waste dengan harga lebih terjangkau — sekaligus membuka peluang pendapatan tambahan bagi UMKM.',
    },
    {
        q: 'Siapa saja yang bisa menggunakan ReBites?',
        a: 'Siapa pun. Pembeli cukup membuat akun pembeli untuk mulai menjelajahi dan memesan. Pelaku UMKM mendaftar melalui jalur penjual, melengkapi profil usaha, lalu mulai mengunggah makanan surplus yang dijual.',
    },
    {
        q: 'Bagaimana cara menemukan makanan di ReBites?',
        a: 'Buka katalog, telusuri lewat kategori atau kata kunci, lalu gunakan filter seperti terdekat, diskon terbesar, atau segera habis. Setiap produk menampilkan detail berupa harga, sisa stok, dan jam ketersediaan sebelum kamu memesan.',
    },
    {
        q: 'Bagaimana cara memesan makanan di ReBites?',
        a: 'Buat akun, pilih makanan yang ingin dibeli, lalu lihat detail produknya. Tentukan jumlah pembelian, pilih metode penerimaan pesanan — diantar atau diambil langsung di lokasi penjual — kemudian pilih metode pembayaran dan selesaikan pembayaran.',
    },
    {
        q: 'Apakah makanan surplus di ReBites aman dikonsumsi?',
        a: 'Ya. Makanan yang dijual merupakan surplus yang masih layak konsumsi, seperti makanan dengan kelebihan produksi atau yang belum habis terjual pada hari itu. Setiap penjual mencantumkan informasi produk dan waktu penerimaan agar makanan diterima dalam kondisi yang sesuai.',
    },
    {
        q: 'Berapa biaya untuk menggunakan ReBites?',
        a: 'Untuk pembeli tidak ada biaya langganan; kamu hanya membayar sesuai harga makanan dan biaya lain yang ditampilkan pada halaman pembayaran. Untuk pelaku UMKM tersedia paket langganan Basic, Standar, dan Max yang bisa disesuaikan dengan kebutuhan usaha.',
    },
    {
        q: 'Area mana saja yang sudah dilayani ReBites?',
        a: 'Saat ini ReBites beroperasi khusus di Kota Depok. Depok menjadi langkah awal untuk membangun ekosistem penyelamatan makanan sebelum ReBites berkembang ke wilayah lainnya.',
    },
];
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
export function FAQSection() {
    const [open, setOpen] = useState<number | null>(0);
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        data.set('nama', (data.get('nama') as string) || 'Pengunjung');
        data.set('pesan', (data.get('pesan') as string) || '');
        setStatus('sending');
        try {
            const res = await fetch('https://formspree.io/f/xdeoorwd', {
                method: 'POST',
                body: data,
                headers: { Accept: 'application/json' },
            });
            if (!res.ok)
                throw new Error('Gagal mengirim');
            setStatus('success');
            form.reset();
        }
        catch {
            setStatus('error');
        }
    };
    return (<section id="faq" aria-labelledby="faq-heading" className="grain-overlay bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <Reveal>
          <div className="max-w-2xl">
            <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              Pertanyaan umum
            </p>
            <h2 id="faq-heading" className="mt-4 text-balance font-display text-[clamp(1.8rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary">
              Hal yang paling sering{' '}
              <span className="font-light italic">ditanyakan</span>.
            </h2>
          </div>
        </Reveal>

        <div className="mt-10 grid items-start gap-8 sm:mt-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
          <Reveal>
            <div className="border-t border-border">
              {FAQS.map((faq, index) => {
            const isOpen = open === index;
            const panelId = `faq-panel-${index}`;
            const buttonId = `faq-button-${index}`;
            return (<div key={faq.q} className="border-b border-border">
                    <h3>
                      <button type="button" id={buttonId} aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpen(isOpen ? null : index)} className={cn('flex w-full items-start justify-between gap-5 py-5 text-left transition-colors duration-200', FOCUS_RING)}>
                        <span className={cn('font-display text-[15px] font-semibold leading-snug tracking-tight transition-colors duration-200 sm:text-base', isOpen
                    ? 'text-primary'
                    : 'text-foreground hover:text-primary')}>
                          {faq.q}
                        </span>

                        <span aria-hidden className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300', isOpen
                    ? 'border-primary bg-primary text-white'
                    : 'border-border text-primary hover:border-primary')}>
                          <Plus className={cn('h-4 w-4 transition-transform duration-300', isOpen && 'rotate-45')}/>
                        </span>
                      </button>
                    </h3>

                    <AnimatePresence initial={false}>
                      {isOpen && (<motion.div id={panelId} role="region" aria-labelledby={buttonId} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{
                        duration: 0.3,
                        ease: [0.22, 1, 0.36, 1],
                    }} className="overflow-hidden">
                          <p className="max-w-2xl pb-5 pr-10 text-sm leading-[1.8] text-muted-foreground">
                            {faq.a}
                          </p>
                        </motion.div>)}
                    </AnimatePresence>
                  </div>);
        })}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="rounded-3xl border border-border bg-secondary p-6 sm:p-8">
              <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                Hubungi kami
              </p>
              <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-primary sm:text-2xl">
                Masih ada pertanyaan?
              </h3>
              <p className="mt-2 text-sm leading-[1.75] text-muted-foreground">
                Kirim pesan lewat formulir ini, tim kami akan membalas ke email
                kamu. Atau langsung saja ke{' '}
                <a href="mailto:halo@rebites.id" className="font-medium text-primary underline underline-offset-4 hover:text-primary-dark">
                  halo@rebites.id
                </a>
                .
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="font-secondary text-xs font-semibold text-primary">
                    Nama
                  </span>
                  <input type="text" name="nama" required placeholder="Nama Anda" className="mt-1.5 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"/>
                </label>

                <label className="block">
                  <span className="font-secondary text-xs font-semibold text-primary">
                    Email
                  </span>
                  <input type="email" name="email" required placeholder="nama@email.com" className="mt-1.5 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"/>
                </label>

                <label className="block">
                  <span className="font-secondary text-xs font-semibold text-primary">
                    Pesan
                  </span>
                  <textarea name="pesan" required rows={4} placeholder="Tulis pertanyaan atau pesan Anda di sini…" className="mt-1.5 w-full resize-none rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"/>
                </label>

                <button type="submit" disabled={status === 'sending'} className={cn('inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-secondary text-sm font-semibold text-white transition-colors duration-300 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70', FOCUS_RING)}>
                  <Mail className="h-4 w-4" aria-hidden/>
                  {status === 'sending' ? 'Mengirim…' : 'Kirim Pesan'}
                </button>

                <AnimatePresence>
                  {status === 'success' && (<motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm font-medium text-primary">
                      Terima kasih! Pesan Anda sudah terkirim.
                    </motion.p>)}
                  {status === 'error' && (<motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm font-medium text-sale">
                      Gagal mengirim pesan. Silakan coba lagi.
                    </motion.p>)}
                </AnimatePresence>
              </form>
            </div>
          </Reveal>
        </div>
      </div>
    </section>);
}
