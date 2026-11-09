'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from './animated-number';
import { useCheckout } from './checkout-context';
const EASE = [0.22, 1, 0.36, 1] as const;
function CoinSwitch({ checked, onChange, disabled, }: {
    checked: boolean;
    onChange: (on: boolean) => void;
    disabled?: boolean;
}) {
    return (<button type="button" role="switch" aria-checked={checked} aria-label="Gunakan ReBites Coin" disabled={disabled} onClick={() => onChange(!checked)} className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full px-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50', checked ? 'bg-primary' : 'bg-primary/40', disabled && 'cursor-not-allowed opacity-40')}>

      <motion.span animate={{ x: checked ? 20 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} className="h-4 w-4 rounded-full bg-white shadow-sm"/>

    </button>);
}
export function UseCoinsCard() {
    const { coinBalance, useCoins, toggleUseCoins, summary } = useCheckout();
    const hasCoins = coinBalance > 0;
    const cappedByTotal = hasCoins && summary.coinUsed > 0 && coinBalance > summary.totalBeforeCoin;
    return (<div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-3">

      <div className="flex items-center gap-3">

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm">

          <Coins className="h-4 w-4"/>

        </span>



        <div className="min-w-0 flex-1">

          <p className="text-xs font-semibold text-foreground">

            Gunakan ReBites Coin

          </p>

          <p className="text-[11px] leading-snug text-muted-foreground">

            {hasCoins ? (<>

                Saldo kamu:{' '}

                <span className="font-semibold tabular-nums text-foreground">

                  {coinBalance.toLocaleString('id-ID')} Coin

                </span>{' '}

                · 1 Coin = Rp1

              </>) : ('Kamu belum memiliki Coin.')}

          </p>

        </div>



        <CoinSwitch checked={useCoins && hasCoins} onChange={toggleUseCoins} disabled={!hasCoins}/>

      </div>



      <AnimatePresence initial={false}>

        {hasCoins && useCoins && summary.coinUsed > 0 && (<motion.div key="coin-used-detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-primary/30 pt-2.5">

              <p className="text-[11px] leading-snug text-muted-foreground">

                {cappedByTotal ? 'Menggunakan maksimal' : 'Menggunakan'}{' '}

                <span className="font-semibold tabular-nums text-foreground">

                  <AnimatedNumber value={summary.coinUsed} format={(v) => v.toLocaleString('id-ID')}/>

                </span>{' '}

                Coin{' '}

                <span className="text-muted-foreground">

                  (sisa {summary.remainingCoin.toLocaleString('id-ID')} Coin)

                </span>

              </p>

              <p className="text-xs font-semibold text-primary">

                Hemat{' '}

                <AnimatedNumber value={summary.coinDiscount} format={(v) => `Rp${v.toLocaleString('id-ID')}`}/>

              </p>

            </div>

          </motion.div>)}

      </AnimatePresence>

    </div>);
}
