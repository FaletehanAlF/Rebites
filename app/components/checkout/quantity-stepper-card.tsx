'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCheckout } from './checkout-context';
export function QuantityStepperCard() {
    const { draft, quantity, increment, decrement, canDecrement, canIncrement, } = useCheckout();
    return (<div className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">

      <div className="flex items-center justify-between gap-4">

        <div>

          <h3 className="font-display text-base font-medium text-foreground">

            Jumlah porsi

          </h3>

          <p className="mt-0.5 text-sm text-muted-foreground">

            Sisa {draft.stockRemaining} porsi

          </p>

        </div>



        <div className="flex items-center gap-3 sm:gap-4">

          <button type="button" aria-label="Kurangi porsi" disabled={!canDecrement} onClick={decrement} className={cn('flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-90', canDecrement
            ? 'border-primary text-primary hover:bg-primary-dark hover:text-white'
            : 'cursor-not-allowed border-border text-primary-foreground')}>

            <Minus className="h-4 w-4"/>

          </button>



          <div className="w-10 text-center">

            <AnimatePresence mode="popLayout" initial={false}>

              <motion.span key={quantity} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18, ease: 'easeOut' }} className="inline-block font-display text-xl font-semibold tabular-nums text-foreground">

                {quantity}

              </motion.span>

            </AnimatePresence>

          </div>



          <button type="button" aria-label="Tambah porsi" disabled={!canIncrement} onClick={increment} className={cn('flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 active:scale-90', canIncrement
            ? 'bg-primary text-white shadow-md shadow-primary/25 hover:bg-primary-dark'
            : 'cursor-not-allowed bg-muted text-muted-foreground/60')}>

            <Plus className="h-4 w-4"/>

          </button>

        </div>

      </div>

    </div>);
}
