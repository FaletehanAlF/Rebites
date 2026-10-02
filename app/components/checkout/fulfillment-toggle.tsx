'use client';

import { motion } from 'framer-motion';
import { Check, MapPin, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
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

export function FulfillmentToggle() {
  const { fulfillment, setFulfillment } = useCheckout();

  return (
    <section
      aria-label="Metode pengambilan pesanan"
      className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6"
    >
      <h3 className="font-display text-base font-medium text-foreground">
        Metode pengambilan
      </h3>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Pilih cara kamu menerima pesanan
      </p>

      <div role="radiogroup" className="mt-4 grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const selected = fulfillment === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setFulfillment(option.value)}
              className={cn(
                'group relative flex items-center gap-3.5 rounded-2xl border-2 p-4 text-left transition-all duration-200',
                selected
                  ? 'border-primary bg-primary/[0.05] shadow-lg shadow-primary/10'
                  : 'border-border bg-white hover:border-primary/30 hover:shadow-md'
              )}
            >
              <span
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200',
                  selected
                    ? 'bg-primary text-white'
                    : 'bg-muted text-primary'
                )}
              >
                <Icon className="h-5 w-5" />
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-sm font-semibold transition-colors duration-200',
                    selected ? 'text-primary' : 'text-foreground'
                  )}
                >
                  {option.title}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {option.subtitle}
                </span>
              </span>

              <span
                aria-hidden
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
                  selected ? 'border-primary' : 'border-primary/30'
                )}
              >
                {selected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.22, ease: EASE }}
                  >
                    <Check className="h-3 w-3 text-primary" strokeWidth={3} />
                  </motion.span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
