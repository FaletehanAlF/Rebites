'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Hourglass,
  MapPin,
  Navigation,
  PackageCheck,
  TriangleAlert,
  Truck,
  XCircle,
} from 'lucide-react';
import type { StoredOrder } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatElapsedSince, resolveWaitSince } from '@/lib/delivery-wait-time';
import { useOrderStatusHistory } from '@/hooks/use-order-status-history';

/**
 * Panel status pengantaran untuk pembeli.
 *
 * Kejujuran data adalah aturan utama komponen ini:
 * - Tidak ada posisi kurir palsu. Live GPS dinyatakan BELUM AKTIF selama
 *   sumber lokasi tepercaya (tabel + RLS) belum tersedia.
 * - ETA hanya ditampilkan bila order benar-benar menyimpannya
 *   (`estimatedArrivalAt`); selain itu tidak ada angka yang dikarang.
 * - Setiap state menjelaskan situasi + tindakan berikutnya.
 *
 * TATA LETAK: panel ini hidup di kolom kanan selebar ~360–400px, tetapi
 * halaman desktop bisa jauh lebih lebar. Karena itu ukuran tidak boleh
 * ditentukan breakpoint viewport (`sm:flex-row`): pada layar 1920px aturan
 * itu aktif walaupun kartunya sendiri hanya 360px, dan teks status
 * terhimpit sampai menumpuk. Semua ukuran di sini relatif terhadap kartu —
 * tanpa breakpoint, tanpa ilustrasi selebar kartu.
 */

export type DeliveryPhase =
  | 'preparing'
  | 'waiting-courier'
  | 'on-the-way'
  | 'done'
  | 'cancelled';

export function resolveDeliveryPhase(order: StoredOrder): DeliveryPhase {
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

/** Tahapan perjalanan yang ditampilkan sebagai track progres. */
const PHASE_STEPS: { phase: DeliveryPhase; label: string }[] = [
  { phase: 'preparing', label: 'Disiapkan' },
  { phase: 'waiting-courier', label: 'Siap' },
  { phase: 'on-the-way', label: 'Diantar' },
  { phase: 'done', label: 'Selesai' },
];

const PHASE_INDEX: Record<DeliveryPhase, number> = {
  preparing: 0,
  'waiting-courier': 1,
  'on-the-way': 2,
  done: 3,
  cancelled: -1,
};

function formatClock(d: Date): string {
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Sisa waktu menuju ETA dalam kata.
 *
 * ETA yang sudah lewat TIDAK disembunyikan: pembeli yang menunggu 10 menit
 * lebih lama berhak tahu, dan menyembunyikan angka hanya membuat halaman
 * tampak "macet" tanpa penjelasan. Yang tidak boleh adalah mengarang angka
 * pengganti — jadi yang ditampilkan adalah fakta "sudah lewat X menit".
 */
function formatEtaRemaining(arrivalAt: Date, now: number): { text: string; overdue: boolean } | null {
  const diffMs = arrivalAt.getTime() - now;
  if (!Number.isFinite(diffMs)) return null;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin <= 0) {
    const late = Math.abs(diffMin);
    return {
      text: late < 1 ? 'sudah lewat estimasi' : `sudah lewat ${late} menit`,
      overdue: true,
    };
  }
  if (diffMin === 1) return { text: '±1 menit lagi', overdue: false };
  if (diffMin < 60) return { text: `±${diffMin} menit lagi`, overdue: false };
  const jam = Math.floor(diffMin / 60);
  const sisa = diffMin % 60;
  return {
    text: sisa === 0 ? `±${jam} jam lagi` : `±${jam} jam ${sisa} menit lagi`,
    overdue: false,
  };
}

function PhaseIcon({ phase, className }: { phase: DeliveryPhase; className?: string }) {
  const Icon =
    phase === 'done'
      ? CheckCircle2
      : phase === 'cancelled'
        ? XCircle
        : phase === 'on-the-way'
          ? Truck
          : phase === 'waiting-courier'
            ? Clock3
            : PackageCheck;
  return <Icon className={className} aria-hidden />;
}

/** Warna aksen per fase — satu sumber untuk ikon, chip, dan track progres. */
function phaseTone(phase: DeliveryPhase) {
  switch (phase) {
    case 'done':
      return { chip: 'bg-green-50 text-green-700', ring: 'ring-green-600/15', icon: 'bg-green-50 text-green-700', bar: 'bg-green-600' };
    case 'on-the-way':
      return { chip: 'bg-primary/10 text-primary', ring: 'ring-primary/15', icon: 'bg-primary/10 text-primary', bar: 'bg-primary' };
    case 'cancelled':
      return { chip: 'bg-destructive/10 text-destructive', ring: 'ring-destructive/15', icon: 'bg-destructive/10 text-destructive', bar: 'bg-destructive' };
    default:
      return { chip: 'bg-cream-100 text-charcoal-700', ring: 'ring-hairline', icon: 'bg-cream-100 text-charcoal-700', bar: 'bg-sage-500' };
  }
}

export function DeliveryStatusPanel({
  order,
  variant = 'compact',
}: {
  order: StoredOrder;
  /** `full` dipakai halaman detail (panel besar); `compact` untuk modal. */
  variant?: 'compact' | 'full';
}) {
  const phase = resolveDeliveryPhase(order);
  const copy = PHASE_COPY[phase];
  const dest = order.addressSnapshot;
  const tone = phaseTone(phase);
  const isFull = variant === 'full';

  const arrivalAt = order.estimatedArrivalAt ? new Date(order.estimatedArrivalAt) : null;
  const arrivalValid = arrivalAt != null && Number.isFinite(arrivalAt.getTime());
  // Nilai primitif, bukan objek Date. `new Date(...)` menghasilkan objek baru
  // tiap render, sehingga dipakai sebagai dependency effect ia akan memicu
  // pemasangan ulang interval 30 detik terus-menerus.
  const arrivalTs = arrivalValid ? (arrivalAt as Date).getTime() : null;
  const distanceKm =
    typeof order.distanceKm === 'number'
      ? order.distanceKm
      : typeof order.deliveryDistanceKm === 'number'
        ? order.deliveryDistanceKm
        : null;

  /**
   * Jam berdenyut.
   *
   * Diperbarui 30 detik sekali — cukup untuk teks "±X menit lagi" dan
   * "sudah menunggu X" tanpa memicu render tiap detik pada panel yang
   * mungkin ada di halaman dengan peta aktif.
   *
   * Interval JALAN selama pesanan masih berjalan, walaupun tidak ada ETA:
   * kalau hanya berjalan saat ada ETA, teks "sudah menunggu" akan basi
   * pada pesanan yang estimasinya belum terisi.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase === 'done' || phase === 'cancelled') return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [phase]);

  /**
   * Berapa lama pembeli sudah menunggu pada tahap yang sedang berjalan.
   *
   * Dihitung dari perubahan status TERAKHIR yang tercatat, bukan dari waktu
   * pesanan dibuat — yang penting bagi pembeli adalah sudah menunggu berapa
   * lama di tahap ini, bukan umur pesanan.
   */
  const { lastStatusChangeAt } = useOrderStatusHistory(order.dbId);
  const waitSince = resolveWaitSince(order, lastStatusChangeAt);
  const waited = formatElapsedSince(waitSince, now);

  const eta =
    arrivalTs != null && phase !== 'done'
      ? formatEtaRemaining(new Date(arrivalTs), now)
      : null;

  const liveUnavailable = phase === 'on-the-way';
  const activeIndex = PHASE_INDEX[phase];
  const chipLabel =
    phase === 'on-the-way'
      ? 'GPS belum aktif'
      : phase === 'done'
        ? 'Pengantaran selesai'
        : phase === 'cancelled'
          ? 'Dibatalkan'
          : 'Menunggu pengantaran';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl bg-white ring-1 ring-hairline',
        !isFull && 'mt-2'
      )}
    >
      {/* Kepala: ikon status kecil (bukan ilustrasi selebar kartu) + judul
          yang boleh membungkus selebar kartu. */}
      <div className={cn('flex items-start gap-3', isFull ? 'p-4 sm:p-5' : 'p-3.5')}>
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full ring-1',
            tone.icon,
            tone.ring,
            isFull ? 'h-10 w-10' : 'h-8 w-8'
          )}
        >
          <PhaseIcon phase={phase} className={isFull ? 'h-5 w-5' : 'h-4 w-4'} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p
              className={cn(
                'font-semibold leading-snug text-charcoal-900',
                isFull ? 'text-[15px]' : 'text-[13px]'
              )}
            >
              {copy.title}
            </p>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                tone.chip
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  phase === 'on-the-way' ? 'bg-primary animate-pulse motion-reduce:animate-none' : 'bg-current'
                )}
                aria-hidden
              />
              {chipLabel}
            </span>
          </div>
          <p
            className={cn(
              'mt-1 leading-relaxed text-charcoal-500',
              isFull ? 'text-[13px]' : 'text-xs'
            )}
          >
            {copy.body}
          </p>
        </div>
      </div>

      {/* Track progres: memberi tahu "di mana saya" tanpa harus membaca teks.
          Disk`aria-hidden` — pembaca layar sudah mendapat status dari judul. */}
      {isFull && phase !== 'cancelled' && (
        <div className="px-4 pb-4 sm:px-5" aria-hidden>
          <div className="flex items-center">
            {PHASE_STEPS.map((step, index) => {
              const reached = index <= activeIndex;
              const isLast = index === PHASE_STEPS.length - 1;
              return (
                <div key={step.phase} className={cn('flex items-center', !isLast && 'flex-1')}>
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold transition-colors',
                        reached
                          ? cn('border-transparent text-white', tone.bar)
                          : 'border-hairline bg-white text-sage-500'
                      )}
                    >
                      {reached ? '✓' : index + 1}
                    </span>
                    <span
                      className={cn(
                        'whitespace-nowrap text-[10px] font-medium',
                        reached ? 'text-charcoal-900' : 'text-sage-500'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <span
                      className={cn(
                        'mx-1 mb-4 h-0.5 flex-1 rounded-full',
                        index < activeIndex ? tone.bar : 'bg-hairline'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <dl className="divide-y divide-hairline border-t border-hairline">
        {waited && (
          <div className={cn('flex items-start justify-between gap-3', isFull ? 'px-4 py-3 sm:px-5' : 'px-3.5 py-2.5')}>
            <dt className="flex items-center gap-1.5 text-xs text-charcoal-500">
              <Hourglass className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Sudah menunggu
            </dt>
            <dd className="font-semibold tabular-nums text-charcoal-900 text-right">
              {waited}
            </dd>
          </div>
        )}

        {arrivalValid && (
          <div className={cn('flex items-start justify-between gap-3', isFull ? 'px-4 py-3 sm:px-5' : 'px-3.5 py-2.5')}>
            <dt className="flex items-center gap-1.5 text-xs text-charcoal-500">
              <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Estimasi tiba
            </dt>
            <dd className={cn('text-right', isFull ? 'text-sm' : 'text-xs')}>
              <span className="block font-semibold tabular-nums text-charcoal-900">
                {formatClock(arrivalAt as Date)}
              </span>
              {/* Sisa waktu dalam kata: angka jam saja memaksa pembeli
                  menguranginya sendiri. ETA yang sudah lewat ditampilkan
                  apa adanya, bukan disembunyikan. */}
              {eta && (
                <span
                  className={cn(
                    'block text-[10px] font-medium',
                    eta.overdue ? 'text-caramel-dark' : 'text-charcoal-500'
                  )}
                >
                  {eta.text}
                </span>
              )}
            </dd>
          </div>
        )}

        {distanceKm != null && (
          <div className={cn('flex items-start justify-between gap-3', isFull ? 'px-4 py-3 sm:px-5' : 'px-3.5 py-2.5')}>
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
          <div className={cn('flex items-start justify-between gap-3', isFull ? 'px-4 py-3 sm:px-5' : 'px-3.5 py-2.5')}>
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
          className="flex items-start gap-2 border-t border-hairline bg-cream-50 px-4 py-2.5 sm:px-5"
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
