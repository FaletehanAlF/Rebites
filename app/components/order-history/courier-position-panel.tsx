'use client';

import { Navigation, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourierLocation } from '@/hooks/use-courier-location';
import { formatPositionAge } from '@/lib/courier-location';

/**
 * Panel posisi kurir untuk PENJUAL.
 *
 * Penjual boleh melihat posisi kurir (keputusan eksplisit): dia pihak yang
 * pneumoniae di perjalanan pengantaran, dan sering perlu tahu kurir sudah
 * sampai atau belum.
 *
 * Yang ditampilkan jujur:
 * - ada posisi segar  -> "Posisi diperbarui {N} lalu"
 * - ada posisi basi   -> "Posisi terlambat {N} lalu"
 * - belum ada posisi  -> "Kurir belum mengirim posisi"
 *
 * Tidak ada koordinat yang dikarang. Ketika posisi tidak ada, panel ini
 * hanya menyatakan facts dan tidak menunjuk lokasi apa pun.
 */
export function CourierPositionPanel({
  orderDbId,
  className,
}: {
  /** UUID baris `orders.id`. */
  orderDbId: string | null | undefined;
  className?: string;
}) {
  const { location, freshness } = useCourierLocation(orderDbId, Boolean(orderDbId));
  const age = formatPositionAge(location?.recordedAt, Date.now());

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border border-hairline bg-cream-50 px-3 py-2',
        className
      )}
    >
      {freshness === 'aktif' ? (
        <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      ) : (
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-caramel-dark" aria-hidden />
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-charcoal-900">
          {freshness === 'aktif'
            ? 'Posisi kurir diperbarui otomatis'
            : freshness === 'terlambat'
              ? 'Posisi kurir terlambat'
              : 'Kurir belum mengirim posisi'}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-charcoal-500">
          {freshness === 'aktif'
            ? `Data posisi terakhir diterima ${age ?? 'sebentar lalu'}.`
            : freshness === 'terlambat'
              ? `Data posisi terakhir diterima ${age ?? 'beberapa waktu lalu'}, jadi posisinya mungkin sudah tidak akurat.`
              : 'Kurir akan mengirim posisi otomatis selama mengantar. Status pengantaran tetap diperbarui dari sistem pesanan.'}
        </p>
      </div>
    </div>
  );
}
