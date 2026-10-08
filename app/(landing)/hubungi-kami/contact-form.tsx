'use client';

import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Formulir kontak di `/hubungi-kami`.
 *
 * Menggunakan endpoint Formspree yang sama seperti bekas formulir di
 * halaman landing — tidak ada API route baru yang dibuat hanya untuk
 * redesign ini. status `idle | sending | success | error` ditampilkan lewat
 * pesan yang di-`aria-live`, jadi pengguna pembaca layar ikut tahu hasilnya.
 */
export function ContactForm() {
  const [status, setStatus] = useState<
    'idle' | 'sending' | 'success' | 'error'
  >('idle');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus('sending');
    try {
      const res = await fetch('https://formspree.io/f/xdeoorwd', {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Gagal mengirim');
      setStatus('success');
      form.reset();
    } catch {
      setStatus('error');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[1.75rem] border border-border bg-secondary p-6 sm:p-8"
    >
      <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
        Kirim pesan
      </p>
      <h2 className="mt-3 font-display text-xl font-semibold tracking-tight text-primary sm:text-2xl">
        Tulis pertanyaanmu di sini.
      </h2>
      <p className="mt-2 text-sm leading-[1.75] text-muted-foreground">
        Kami akan membalas ke email yang kamu cantumkan.
      </p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="font-secondary text-xs font-semibold text-primary">
            Nama
          </span>
          <input
            type="text"
            name="nama"
            required
            autoComplete="name"
            placeholder="Nama Anda"
            className="mt-1.5 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </label>

        <label className="block">
          <span className="font-secondary text-xs font-semibold text-primary">
            Email
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="nama@email.com"
            className="mt-1.5 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </label>

        <label className="block">
          <span className="font-secondary text-xs font-semibold text-primary">
            Pesan
          </span>
          <textarea
            name="pesan"
            required
            rows={5}
            placeholder="Tulis pertanyaan atau pesan Anda di sini…"
            className="mt-1.5 w-full resize-none rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </label>

        <button
          type="submit"
          disabled={status === 'sending'}
          className={cn(
            'inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 font-secondary text-sm font-semibold text-white transition-colors duration-300 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70',
            FOCUS_RING,
          )}
        >
          <Mail className="h-4 w-4" aria-hidden />
          {status === 'sending' ? 'Mengirim…' : 'Kirim Pesan'}
        </button>

        <div aria-live="polite">
          <AnimatePresence>
            {status === 'success' && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium text-primary"
              >
                Terima kasih! Pesan Anda sudah terkirim.
              </motion.p>
            )}
            {status === 'error' && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium text-sale"
              >
                Gagal mengirim pesan. Silakan coba lagi atau kirim email
                langsung ke halo@rebites.id.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </form>
  );
}
