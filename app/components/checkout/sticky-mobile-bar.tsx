'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatRupiah } from '@/lib/data';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from './animated-number';
import { useCheckout } from './checkout-context';
export function StickyMobileBar() {
    const { summary, canPay, submitOrder, submitting } = useCheckout();
    const [show, setShow] = useState(false);
    useEffect(() => {
        const onScroll = () => {
            const el = document.getElementById('checkout-qty-card');
            const rect = el?.getBoundingClientRect();
            setShow(rect ? rect.top < window.innerHeight * 0.85 : false);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        onScroll();
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, []);
    return (<AnimatePresence>

      {show && (<motion.div initial={{ y: 96 }} animate={{ y: 0 }} exit={{ y: 96 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">

          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">

            <div>

              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">

                Total

              </p>

              <p className="font-display text-lg font-semibold tabular-nums text-primary">

                <AnimatedNumber value={summary.total} format={formatRupiah}/>

              </p>

            </div>



            <button type="button" disabled={!canPay} onClick={submitOrder} className={cn('rounded-full px-6 py-3 text-sm font-semibold transition-colors duration-200', canPay
                ? 'bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary-dark'
                : 'cursor-not-allowed bg-muted text-muted-foreground')}>

              {submitting ? 'Memproses…' : 'Pesan Sekarang'}

            </button>

          </div>

        </motion.div>)}

    </AnimatePresence>);
}
