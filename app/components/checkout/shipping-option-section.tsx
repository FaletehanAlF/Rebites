'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Clock3, MapPin, TriangleAlert, Truck } from 'lucide-react';
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
  const etaLabel = option.etaLabel.trim();
  const distanceLabel = option.distanceLabel.trim();
  // Untuk pembaca layar: sebut waktu dulu, jarak sebagai tambahan. Kalau
  // waktu kosong, jangan sebut "estimasi" sama sekali.
  const ariaDuration = etaLabel
    ? `, estimasi tiba ${etaLabel}${distanceLabel ? `, jarak ${distanceLabel}` : ''}`
    : '';

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${option.courierName} ${option.serviceName}${ariaDuration}, ${formatRupiah(option.price)}`}
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
        {etaLabel ? (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-charcoal-900">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              Estimasi tiba {etaLabel}
            </span>
            {distanceLabel && (
              <span className="font-normal text-charcoal-500">· {distanceLabel}</span>
            )}
          </span>
        ) : (
          // Waktu tidak dapat dihitung: tampilkan HANYA jaraknya. Kalimat
          // "Estimasi tiba" tanpa angka adalah janji kosong.
          distanceLabel && (
            <span className="mt-1 flex items-center gap-1 text-xs text-charcoal-500">
              <Clock3 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              Jarak {distanceLabel}
            </span>
          )
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
 * pemilih layanan pengiriman (food-delivery style).
 * Hanya tampil untuk fulfillment delivery. Menyimpan identifier
 * (courierCode/serviceCode) via context; harga hanya display
 * (source of truth tetap server pada phase berikutnya).
 */
export function ShippingOptionSection() {
  const {
    draft,
    fulfillment,
    shippingOptions,
    selectedShipping,
    setSelectedShipping,
    shippingLoading,
    shippingError,
    shippingErrorCode,
    selectedAddress,
  } = useCheckout();

  const selectedOption =
    selectedShipping && shippingOptions.length > 0
      ? (shippingOptions.find(
          (o) =>
            o.courierCode === selectedShipping.courierCode &&
            o.serviceCode === selectedShipping.serviceCode
        ) ?? null)
      : null;

  // Alamat tujuan aktif — konfirmasi visual bahwa ongkir dihitung untuk alamat ini.
  const destinationLabel = selectedAddress
    ? [selectedAddress.label, selectedAddress.district].filter(Boolean).join(' · ')
    : null;

  /**
   * Alamat tujuan sudah punya titik lokasi yang sah.
   *
   * Saat belum, kartu "Dikirim ke" menampilkan peringatan yang sama dengan
   * bagian Alamat Pengiriman, supaya pembeli tidak menelusuri dua kotak untuk
   * mencari tahu mengapa ongkir kosong.
   */
  const destinationHasPoint = (() => {
    const lat = selectedAddress?.latitude;
    const lng = selectedAddress?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat === 0 && lng === 0) return false;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  })();

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
            <p className="mt-1 text-xs text-sage-500">
              Estimasi dihitung ulang saat alamat pengiriman berubah. Harga final
              tetap dihitung ulang server saat checkout.
            </p>

            <div className="mt-4">
              {/* Konteks tujuan: memastikan tarif dihitung untuk alamat yang benar. */}
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-cream-50 px-3 py-2.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sage-500">
                    Dikirim ke
                  </p>
                  <p className="truncate text-[13px] font-medium text-charcoal-900">
                    {destinationLabel ?? 'Belum ada alamat terpilih'}
                  </p>
                  {selectedAddress && !destinationHasPoint && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] leading-relaxed text-caramel-dark">
                      <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      Belum ada titik lokasi di alamat ini — tandai dulu di bagian Alamat Pengiriman.
                    </p>
                  )}
                </div>
              </div>

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
                    {shippingErrorCode === 'product_no_weight' && (
                      <p className="mt-1.5 text-xs leading-relaxed text-charcoal-900">
                        {draft.isPickup
                          ? 'Kamu masih bisa melanjutkan pesanan dengan memilih “Ambil Sendiri” di atas, atau tunggu penjual melengkapi berat produk ini.'
                          : 'Penjual perlu melengkapi berat produk ini agar kurir dapat dihitung.'}
                      </p>
                    )}
                    {shippingErrorCode === 'origin_postal_missing' && (
                      <p className="mt-1.5 text-xs leading-relaxed text-charcoal-900">
                        {draft.isPickup
                          ? 'Kamu masih bisa melanjutkan pesanan dengan memilih “Ambil Sendiri” di atas.'
                          : 'Toko belum mengisi lokasinya. Coba lagi nanti atau pilih Ambil Sendiri.'}
                      </p>
                    )}
                    {(shippingErrorCode === 'origin_coordinates_missing' ||
                      shippingErrorCode === 'dest_coordinates_missing' ||
                      shippingErrorCode === 'dest_postal_missing') && (
                      <p className="mt-1.5 text-xs leading-relaxed text-charcoal-900">
                        {shippingErrorCode === 'origin_coordinates_missing'
                          ? 'Toko belum menandai titik lokasinya, jadi jarak antar belum bisa diukur.'
                          : 'Alamat pengiriman belum punya titik lokasi. Buka bagian Alamat Pengiriman, pilih atau tandai titik lokasimu, lalu ongkir dihitung ulang otomatis.'}
                      </p>
                    )}
                    {shippingErrorCode === 'provider_balance' && (
                      <p className="mt-1.5 text-xs leading-relaxed text-charcoal-900">
                        {draft.isPickup
                          ? 'Kamu masih bisa melanjutkan pesanan dengan memilih “Ambil Sendiri” di atas.'
                          : 'Coba lagi nanti atau hubungi admin agar layanan ongkir aktif kembali.'}
                      </p>
                    )}
                    {shippingErrorCode === 'provider_quota' && (
                      <p className="mt-1.5 text-xs leading-relaxed text-charcoal-900">
                        Silakan coba beberapa saat lagi.
                      </p>
                    )}
                  </div>
                </div>
              ) : shippingOptions.length === 0 ? (
                <p className="rounded-2xl border-2 border-dashed border-sage-500/50 px-4 py-6 text-center text-sm text-charcoal-500">
                  Belum ada pilihan pengiriman untuk alamat ini.
                </p>
              ) : (
                <>
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

                  {/* Transparansi tarif: jarak adalah estimasi, bukan rute resmi. */}
                  {selectedOption && (
                    <div className="mt-3 rounded-xl bg-cream-50 px-3.5 py-3">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-charcoal-500">Ongkir diantar</span>
                        <span className="font-semibold tabular-nums text-charcoal-900">
                          {formatRupiah(selectedOption.price)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-charcoal-500">
                        Tarif estimasi lokal ReBites, dihitung dari jarak titik toko ke
                        titik alamatmu. Bukan tarif kurir resmi; jumlah akhir tetap
                        dihitung ulang server saat checkout.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
