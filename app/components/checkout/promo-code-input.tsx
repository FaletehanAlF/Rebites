'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgePercent, Check, X } from 'lucide-react';
import { useCheckout, usePromoInput } from './checkout-context';

export function PromoCodeInput() {
  const { promo } = useCheckout();
  const { promoInput, setPromoInput, promoError, applyPromo, clearPromo } =
    usePromoInput();
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-sage-100 pt-4">
      {promo ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between rounded-xl bg-primary/[0.06] px-3.5 py-2.5"
        >
          <div className="flex items-center gap-2">
            <BadgePercent className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">
              {promo.code} berlaku · diskon {promo.percentOff}%
            </span>
          </div>
          <button
            type="button"
            onClick={clearPromo}
            aria-label="Hapus kode promo"
            className="rounded-full p-1 text-sage-500 transition-colors hover:bg-sage-100 hover:text-caramel"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:text-caramel"
          >
            <BadgePercent className="h-4 w-4" />
            {open ? 'Tutup kode promo' : 'Punya Kode Promo?'}
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex gap-2">
                  <input
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyPromo();
                      }
                    }}
                    placeholder="Masukkan kode promo"
                    aria-label="Kode promo"
                    aria-invalid={promoError !== null}
                    className="w-full rounded-xl border border-sage-100 bg-white px-3.5 py-2.5 text-sm uppercase text-charcoal-900 placeholder:normal-case placeholder:text-sage-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={applyPromo}
                    className="shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-caramel"
                  >
                    Gunakan
                  </button>
                </div>
                {promoError ? (
                  <p
                    role="alert"
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    {promoError}
                  </p>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-sage-500">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    Coba kode <span className="font-semibold">REBITES26</span>{' '}
                    untuk diskon 5%
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
