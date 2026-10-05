'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Clock3, TriangleAlert, Truck } from 'lucide-react';
import { formatRupiah } from '@/lib/data';
import { cn } from '@/lib/utils';
import type { ShippingRateOption } from '@/lib/types';
import { useCheckout } from './checkout-context';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Label tampilan untuk serviceType Biteship yang sudah dikenal.
 * Nilai yang belum dikenal: tampilkan serviceName dari API apa adanya
 * (jangan mengarang mapping, jangan memblokir pilihan).
 */
function knownServiceTypeLabel(serviceType: string): string | null {
  const t = serviceType.trim().toLowerCase();
  if (t === 'instant') return 'Instant';
  if (t === 'same_day') return 'Same Day';
  return null;
}

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: ShippingRateOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const typeLabel = knownServiceTypeLabel(option.serviceType);
  const duration = option.duration.trim();

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${option.courierName} ${option.serviceName}${
        duration ? `, estimasi ${duration}` : ''
      }, ${formatRupiah(option.price)}`}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-2xl border-2 p-4 text-left transition-all duration-200',
        selected
          ? 'border-primary bg-primary/[0.05] shadow-lg shadow-primary/10'
          : 'border-sage-100 bg-white hover:border-sage-500/50 hover:shadow-md'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200',
          selected ? 'bg-primary text-white' : 'bg-sage-100 text-primary'
        )}
      >
        <Truck className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'text-sm font-semibold transition-colors duration-200',
              selected ? 'text-primary' : 'text-charcoal-900'
            )}
          >
            {option.courierName}
          </span>
          {typeLabel && (
            <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-charcoal-500">
              {typeLabel}
            </span>
          )}
          {selected && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Dipilih
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs leading-snug text-charcoal-500">
          {option.serviceName}
        </span>
        {duration && (
          <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-charcoal-900">
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-primary" />
            Estimasi tiba {duration}
          </span>
        )}
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-sm font-bold tabular-nums text-charcoal-900">
          {formatRupiah(option.price)}
        </span>
        <span
          aria-hidden
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors duration-200',
            selected ? 'border-primary bg-primary' : 'border-sage-500/70'
          )}
        >
          {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        </span>
      </span>
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Menghitung ongkir">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3.5 rounded-2xl border-2 border-sage-100 bg-white p-4"
        >
          <div className="h-11 w-11 shrink-0 rounded-xl bg-sage-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/5 rounded-full bg-sage-100" />
            <div className="h-3 w-3/5 rounded-full bg-sage-100" />
          </div>
          <div className="h-4 w-16 shrink-0 rounded-full bg-sage-100" />
        </div>
      ))}
      <p className="text-center text-xs text-sage-500">Menghitung ongkir…</p>
    </div>
  );
}

/**
 * 7C-2B: pemilih layanan pengiriman (food-delivery style).
 * Hanya tampil untuk fulfillment delivery. Menyimpan identifier
 * (courierCode/serviceCode) via context; harga hanya display
 * (source of truth tetap server pada phase berikutnya).
 */
export function ShippingOptionSection() {
  const {
    fulfillment,
    shippingOptions,
    selectedShipping,
    setSelectedShipping,
    shippingLoading,
    shippingError,
  } = useCheckout();

  return (
    <AnimatePresence initial={false}>
      {fulfillment === 'delivery' && (
        <motion.section
          key="shipping-options"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="overflow-hidden"
          aria-label="Pilih pengiriman"
        >
          <div className="rounded-2xl border border-sage-100 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="font-display text-base font-medium text-charcoal-900">
              Pilih Pengiriman
            </h3>
            <p className="mt-0.5 text-sm text-sage-500">
              Kurir dan estimasi tiba untuk pesanan ini
            </p>

            <div className="mt-4">
              {shippingLoading ? (
                <LoadingSkeleton />
              ) : shippingError ? (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-2xl border border-caramel/30 bg-caramel/[0.07] px-4 py-3.5"
                >
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-caramel" />
                  <div>
                    <p className="text-sm font-semibold text-charcoal-900">
                      Ongkir belum bisa dihitung
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-charcoal-500">
                      {shippingError}
                    </p>
                  </div>
                </div>
              ) : shippingOptions.length === 0 ? (
                <p className="rounded-2xl border-2 border-dashed border-sage-500/50 px-4 py-6 text-center text-sm text-charcoal-500">
                  Belum ada pilihan pengiriman untuk alamat ini.
                </p>
              ) : (
                <div role="radiogroup" aria-label="Pilihan kurir" className="space-y-3">
                  {shippingOptions.map((option) => {
                    const selected =
                      selectedShipping?.courierCode === option.courierCode &&
                      selectedShipping?.serviceCode === option.serviceCode;
                    return (
                      <OptionCard
                        key={`${option.courierCode}::${option.serviceCode}`}
                        option={option}
                        selected={selected}
                        onSelect={() =>
                          setSelectedShipping({
                            courierCode: option.courierCode,
                            serviceCode: option.serviceCode,
                          })
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
