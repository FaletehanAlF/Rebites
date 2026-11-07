'use client';
import { motion } from 'framer-motion';
import { Check, MapPin, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah } from '@/lib/data';
import type { FulfillmentMode } from '@/lib/types';
import { useCheckout } from './checkout-context';
const EASE = [0.22, 1, 0.36, 1] as const;
const OPTIONS: {
    value: FulfillmentMode;
    icon: LucideIcon;
    title: string;
    subtitle: string;
}[] = [
    {
        value: 'pickup',
        icon: MapPin,
        title: 'Ambil Sendiri',
        subtitle: 'Ambil langsung di toko',
    },
    {
        value: 'delivery',
        icon: Truck,
        title: 'Diantar',
        subtitle: 'Pesanan dikirim ke alamatmu',
    },
];
function feeLabel(value: number, hasValue: boolean): string {
    if (!hasValue)
        return 'Hitung saat pilih alamat';
    if (value <= 0)
        return 'Gratis';
    return formatRupiah(value);
}
export function FulfillmentToggle() {
    const { draft, fulfillment, setFulfillment, summary, selectedShippingOption } = useCheckout();
    const visibleOptions = OPTIONS.filter((option) => option.value === 'pickup' ? draft.isPickup : draft.isDelivery);
    const deliveryFeeKnown = fulfillment === 'delivery' && selectedShippingOption != null;
    const costFor = (mode: FulfillmentMode): string => {
        if (mode === 'pickup')
            return 'Gratis';
        if (!deliveryFeeKnown)
            return 'Hitung saat pilih alamat';
        return feeLabel(summary.deliveryFee, true);
    };
    if (visibleOptions.length === 0) {
        return (<section aria-label="Metode pengambilan pesanan" className="rounded-2xl border border-sage-100 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="font-display text-base font-medium text-charcoal-900">
          Metode pengambilan
        </h3>
        <p className="mt-0.5 text-sm text-sage-500">
          Produk ini sedang tidak tersedia untuk dipesan.
        </p>
      </section>);
    }
    return (<section aria-label="Metode pengambilan pesanan" className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
      <h3 className="font-display text-base font-medium text-foreground">
        Metode pengambilan
      </h3>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Pilih cara kamu menerima pesanan
      </p>

      <div role="radiogroup" className="mt-4 grid gap-3 sm:grid-cols-2">
        {visibleOptions.map((option) => {
            const selected = fulfillment === option.value;
            const Icon = option.icon;
            return (<button key={option.value} type="button" role="radio" aria-checked={selected} onClick={() => setFulfillment(option.value)} className={cn('group relative flex items-center gap-3.5 rounded-2xl border-2 p-4 text-left transition-all duration-200', selected
                    ? 'border-primary bg-primary/[0.05] shadow-lg shadow-primary/10'
                    : 'border-border bg-white hover:border-primary/30 hover:shadow-md')}>
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200', selected
                    ? 'bg-primary text-white'
                    : 'bg-muted text-primary')}>
                <Icon className="h-5 w-5"/>
              </span>

              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-semibold transition-colors duration-200', selected ? 'text-primary' : 'text-foreground')}>
                  {option.title}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {option.subtitle}
                </span>
                <span className={cn('mt-1 block text-xs font-semibold tabular-nums', option.value === 'pickup'
                    ? 'text-primary'
                    : deliveryFeeKnown
                        ? 'text-charcoal-900'
                        : 'text-sage-500')}>
                  {costFor(option.value)}
                </span>
              </span>

              <span aria-hidden className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200', selected ? 'border-primary' : 'border-primary/30')}>
                {selected && (<motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.22, ease: EASE }}>
                    <Check className="h-3 w-3 text-primary" strokeWidth={3}/>
                  </motion.span>)}
              </span>
            </button>);
        })}
      </div>

      
      {fulfillment === 'pickup' && (<div className="mt-3 flex items-start gap-2 rounded-xl bg-cream-50 px-3 py-2.5">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden/>
          <div className="min-w-0 text-xs leading-relaxed">
            <p className="font-semibold text-charcoal-900">
              Ambil di {draft.vendorName}
            </p>
            {draft.pickupLocation ? (<p className="text-charcoal-500">{draft.pickupLocation}</p>) : null}
            <p className="text-charcoal-500">
              Tidak ada biaya pengiriman untuk metode ini.
            </p>
          </div>
        </div>)}
    </section>);
}
