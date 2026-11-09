'use client';
import { Navigation, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPositionAge, type LocationFreshness } from '@/lib/courier-location';
import type { LiveCourierLocation } from '@/hooks/use-courier-location';
export function CourierPositionPanel({ location, freshness, className, }: {
    location: LiveCourierLocation | null;
    freshness: LocationFreshness;
    className?: string;
}) {
    const age = formatPositionAge(location?.recordedAt, Date.now());
    return (<div className={cn('flex items-start gap-2 rounded-xl border border-hairline bg-cream-50 px-3 py-2', className)}>

      {freshness === 'aktif' ? (<Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden/>) : (<TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-caramel-dark" aria-hidden/>)}

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

    </div>);
}
