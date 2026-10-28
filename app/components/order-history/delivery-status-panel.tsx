'use client';

import { Clock3, MapPin, Navigation, TriangleAlert } from 'lucide-react';
import type { StoredOrder } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DeliveryCourierIllustration } from '@/app/components/shared/delivery-courier-illustration';

/**
 * Panel status pengantaran untuk pembeli.
 *
 * Kejujuran data adalah aturan utama komponen ini:
 * - Tidak ada posisi kurir palsu. Live GPS dinyatakan BELUM AKTIF selama
 *   sumber lokasi tepercaya (tabel + RLS) belum tersedia; kanal Broadcast
 *   publik sengaja tidak dipakai karena lokasi kurir bisa diterima siapa pun
 *   yang mengetahui kode pesanan.
 * - ETA hanya ditampilkan bila order benar-benar menyimpannya
 *   (`estimatedArrivalAt`); selain itu tidak ada angka yang dikarang.
 * - Setiap state menjelaskan situasi + tindakan berikutnya.
 */

type DeliveryPhase =
  | 'preparing'
  | 'waiting-courier'
  | 'on-the-way'
  | 'done'
  | 'cancelled';

function resolvePhase(order: StoredOrder): DeliveryPhase {
  if (order.status === 'completed') return 'done';
  const os = order.orderStatus ?? 'processing';
  if (os === 'cancelled' || os === 'refunded' || os === 'failed') return 'cancelled';
  if (os === 'out_for_delivery') return 'on-the-way';
  if (os === 'ready_for_pickup' || os === 'ready') return 'waiting-courier';
  return 'preparing';
}

const PHASE_COPY: Record<DeliveryPhase, { title: string; body: string }> = {
  preparing: {
    title: 'Menyiapkan pesanan',
    body: 'Toko sedang menyiapkan pesananmu. Kurir ditugaskan setelah pesanan siap.',
  },
  'waiting-courier': {
    title: 'Menunggu kurir memulai perjalanan',
    body: 'Pesanan sudah siap. Pengantaran dimulai saat kurir berangkat ke alamatmu.',
  },
  'on-the-way': {
    title: 'Pesanan sedang diantar',
    body: 'Pesananmu sedang menuju alamat tujuan.',
  },
  done: {
    title: 'Pesanan sudah diterima',
    body: 'Pengantaran selesai. Terima kasih sudah memesan di ReBites.',
  },
  cancelled: {
    title: 'Pengantaran dibatalkan',
    body: 'Pesanan ini tidak dilanjutkan. Hubungi toko bila kamu sudah melakukan pembayaran.',
  },
};

function formatClock(d: Date): string {
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function DeliveryStatusPanel({
  order,
  variant = 'compact',
}: {
  order: StoredOrder;
  /** `full` dipakai halaman detail (panel besar); `compact` untuk modal. */
  variant?: 'compact' | 'full';
}) {
  const phase = resolvePhase(order);
  const copy = PHASE_COPY[phase];
  const dest = order.addressSnapshot;

  const arrivalAt = order.estimatedArrivalAt ? new Date(order.estimatedArrivalAt) : null;
  const arrivalValid = arrivalAt != null && Number.isFinite(arrivalAt.getTime());
  const distanceKm =
    typeof order.distanceKm === 'number'
      ? order.distanceKm
      : typeof order.deliveryDistanceKm === 'number'
        ? order.deliveryDistanceKm
        : null;

  const liveUnavailable = phase === 'on-the-way';
  const isFull = variant === 'full';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl ring-1 ring-hairline',
        isFull ? 'bg-white' : 'mt-2'
      )}
    >
      {/* Permukaan status: ilustrasi motor kontekstual, bukan peta.
          Peta hanya boleh muncul bila koordinat kurir sah tersedia. */}
      <div
        className={cn(
          'flex items-center gap-4 bg-cream-50',
          isFull ? 'flex-col items-start px-5 py-5 sm:flex-row sm:items-center' : 'px-3.5 py-3'
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-xl bg-white/70 ring-1 ring-hairline',
            isFull ? 'h-28 w-full sm:h-24 sm:w-40' : ''
          )}
        >
          <DeliveryCourierIllustration
            tone={phase === 'done' ? 'done' : phase === 'on-the-way' ? 'active' : 'neutral'}
            className={isFull ? 'h-24 w-36' : 'h-12 w-20'}
          />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              'font-semibold text-charcoal-900',
              isFull ? 'font-display text-lg' : 'text-[13px]'
            )}
          >
            {copy.title}
          </p>
          <p
            className={cn(
              'mt-0.5 leading-relaxed text-charcoal-500',
              isFull ? 'text-sm' : 'text-xs'
            )}
          >
            {copy.body}
          </p>
          {isFull && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-charcoal-700 ring-1 ring-hairline">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  phase === 'on-the-way'
                    ? 'bg-caramel'
                    : phase === 'done'
                      ? 'bg-green-600'
                      : 'bg-sage-500'
                )}
                aria-hidden
              />
              {phase === 'on-the-way'
                ? 'GPS belum aktif'
                : phase === 'done'
                  ? 'Pengantaran selesai'
                  : 'Menunggu pengantaran'}
            </p>
          )}
        </div>
      </div>

      <dl className="divide-y divide-hairline">
        {arrivalValid && (
          <div className={cn('flex items-start justify-between gap-3', isFull ? 'px-5 py-3' : 'px-3.5 py-2.5')}>
            <dt className="flex items-center gap-1.5 text-xs text-charcoal-500">
              <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Estimasi tiba
            </dt>
            <dd className={cn('font-semibold tabular-nums text-charcoal-900', isFull ? 'text-sm' : 'text-xs')}>
              {formatClock(arrivalAt)}
            </dd>
          </div>
        )}

        {distanceKm != null && (
          <div className={cn('flex items-start justify-between gap-3', isFull ? 'px-5 py-3' : 'px-3.5 py-2.5')}>
            <dt className="flex items-center gap-1.5 text-xs text-charcoal-500">
              <Navigation className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Jarak estimasi
            </dt>
            <dd className={cn('font-semibold tabular-nums text-charcoal-900', isFull ? 'text-sm' : 'text-xs')}>
              {distanceKm.toLocaleString('id-ID', { maximumFractionDigits: 1 })} km
            </dd>
          </div>
        )}

        {dest?.fullAddress && (
          <div className={cn('flex items-start justify-between gap-3', isFull ? 'px-5 py-3' : 'px-3.5 py-2.5')}>
            <dt className="flex items-center gap-1.5 text-xs text-charcoal-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Tujuan
            </dt>
            <dd className="max-w-[62%] text-right text-xs font-medium leading-relaxed text-charcoal-900">
              {dest.fullAddress}
            </dd>
          </div>
        )}
      </dl>

      {liveUnavailable && (
        <div
          role="status"
          className="flex items-start gap-2 border-t border-hairline bg-cream-50 px-3.5 py-2.5"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-caramel-dark" aria-hidden />
          <p className="text-xs leading-relaxed text-charcoal-500">
            <span className="font-semibold text-charcoal-900">Posisi kurir belum tersedia.</span>{' '}
            Pelacakan lokasi langsung belum diaktifkan; status pengantaran di atas selalu
            diperbarui dari sistem pesanan.
          </p>
        </div>
      )}
    </div>
  );
}
