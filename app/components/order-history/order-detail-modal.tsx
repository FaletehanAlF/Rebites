'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  CheckCheck,
  Flag,
  Coins,
  Copy,
  MapPin,
  RotateCcw,
  Star,
  Store,
  Truck,
} from 'lucide-react';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { ReportUserModal } from '@/app/components/shared/report-user-modal';
import { supabase } from '@/lib/supabase';
import { formatRupiah } from '@/lib/data';
import { fetchProductDetail } from '@/app/components/detail-product/detail-data';
import type { StoredOrder } from '@/lib/types';
import {
  getOrderSubStatus,
  mapsUrl,
  paymentMethodName,
} from '@/lib/order-utils';
import {
  formatOrderDate,
  formatOrderTime,
  SUB_STATUS_LABEL,
} from '@/lib/order-utils';
import { useCountdown, formatCountdown } from '@/lib/useCountdown';
import { getReviewFor, saveReview } from '@/lib/review-storage';
import { ShippingSimulationSection } from './shipping-simulation-panel';
import { DeliveryStatusPanel } from './delivery-status-panel';
import { OrderStatusTimeline } from './order-status-timeline';
import { transitionOrderStatus, getStatusLabel } from '@/lib/order-state-machine';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';

export function OrderDetailModal({
  order,
  userId,
  onClose,
  onReviewed,
}: {
  order: StoredOrder | null;
  userId: string | null;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [existingReview, setExistingReview] = useState<
    { rating: number; comment: string; createdAt: string } | undefined
  >(undefined);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ orderId: string; userId: string } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Target laporan terikat pada pesanan yang sedang dibuka. Tanpa reset ini,
  // reportTarget dari pesanan sebelumnya ikut terpakai sehingga laporan
  // terkirim ke pemilik toko yang salah.
  useEffect(() => {
    setReportOpen(false);
    setReportTarget(null);
    setReportLoading(false);
  }, [order?.orderId]);

  useEffect(() => {
    let mounted = true;
    if (!order || !userId) {
      setExistingReview(undefined);
      return;
    }
    getReviewFor(order.orderId, userId).then((review) => {
      if (mounted) setExistingReview(review);
    });
    return () => {
      mounted = false;
    };
  }, [order, userId]);

  const loadReportTarget = async () => {
    if (!order) return null;
    const slug = order.vendorSlug?.trim() ?? '';
    if (slug) {
      const { data, error } = await supabase
        .from('umkm_profiles')
        .select('user_id')
        .eq('slug', slug)
        .maybeSingle();
      if (!error && data?.user_id) return data.user_id as string;
    }
    // Order lama dapat menyimpan vendor_slug yang bukan slug toko. Resolusi
    // cadangan lewat umkm_id baris order (RLS: hanya pesanan milik pembeli)
    // agar pemilik toko yang benar tetap ditemukan.
    const { data: row, error: rowErr } = await supabase
      .from('orders')
      .select('umkm_id')
      .eq('order_code', order.orderId)
      .maybeSingle();
    const umkmId = (row as { umkm_id?: string | null } | null)?.umkm_id;
    if (rowErr || !umkmId) return null;
    const { data: store, error: storeErr } = await supabase
      .from('umkm_profiles')
      .select('user_id')
      .eq('id', umkmId)
      .maybeSingle();
    if (storeErr || !store?.user_id) return null;
    return store.user_id as string;
  };

  const handleOpenReport = async () => {
    if (reportLoading || reportOpen || !order) return;
    const orderId = order.orderId;
    setReportLoading(true);
    try {
      const target =
        reportTarget?.orderId === orderId ? reportTarget.userId : await loadReportTarget();
      if (!target) {
        toast({
          title: 'Tidak dapat melaporkan',
          description: 'Akun pemilik toko tidak ditemukan.',
        });
        return;
      }
      if (target === userId) {
        toast({
          title: 'Tidak dapat melaporkan',
          description: 'Anda tidak dapat melaporkan akun Anda sendiri.',
        });
        return;
      }
      setReportTarget({ orderId, userId: target });
      setReportOpen(true);
    } catch {
      toast({ title: 'Gagal', description: 'Laporan tidak dapat dibuka.' });
    } finally {
      setReportLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.orderId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast({ title: 'Order ID disalin' });
    } catch {
      toast({
        title: 'Gagal menyalin',
        description: `Salin manual: #${order.orderId}`,
      });
    }
  };

  const handleReorder = async () => {
    if (!order) return;
    const product = await fetchProductDetail(order.productId);
    if (!product) {
      toast({ title: 'Produk ini sudah tidak tersedia' });
      return;
    }
    router.push(
      `/detail/pesanan?product=${encodeURIComponent(order.productId)}&qty=${order.quantity}`
    );
  };

  const handleConfirmReceipt = async () => {
    if (!order || confirmingReceipt) return;
    setConfirmingReceipt(true);
    try {
      const result = await transitionOrderStatus(order.orderId, 'completed', 'Pesanan dikonfirmasi diterima oleh pembeli');
      if (result.success) {
        toast({ title: 'Pesanan dikonfirmasi diterima!', description: 'Terima kasih telah menggunakan ReBites.' });
        onReviewed();
        onClose();
        
        window.location.reload();
      } else {
        toast({ title: 'Gagal', description: result.error ?? 'Terjadi kesalahan' });
      }
    } catch (err) {
      toast({ title: 'Gagal mengkonfirmasi', description: 'Terjadi kesalahan' });
    } finally {
      setConfirmingReceipt(false);
    }
  };

  const orderStatus = order?.orderStatus ?? 'processing';
  const canConfirmReceipt = order?.status === 'ongoing' && (
    orderStatus === 'ready_for_pickup' || orderStatus === 'out_for_delivery'
  );

  return (
    <>
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92dvh] w-[min(560px,100vw-1rem)] flex-col sm:max-h-[85vh]">
        {order && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Detail Pesanan</DialogTitle>
              <DialogDescription className="sr-only">
                Rincian transaksi pesanan ReBites.
              </DialogDescription>
            </DialogHeader>

            <div className="-mx-1 mt-1 min-h-0 flex-1 overflow-y-auto px-1">
              {/* Ringkasan pesanan: kode, status, metode, total. */}
              <div className="rounded-xl bg-cream-100 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-display text-sm font-semibold tabular-nums text-charcoal-900">
                    #{order.orderId}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label="Salin kode pesanan"
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-semibold text-charcoal-900 transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Salin ID
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-charcoal-500">
                  <span className="inline-flex items-center gap-1 font-medium text-charcoal-700">
                    {order.fulfillment === 'delivery' ? (
                      <Truck className="h-3 w-3 shrink-0" aria-hidden />
                    ) : (
                      <Store className="h-3 w-3 shrink-0" aria-hidden />
                    )}
                    {order.fulfillment === 'delivery' ? 'Diantar' : 'Ambil sendiri'}
                  </span>
                  <span aria-hidden>·</span>
                  <span>{formatOrderDate(order.createdAt)}</span>
                  <span aria-hidden>·</span>
                  <span>{formatOrderTime(order.createdAt)}</span>
                </div>
              </div>

              {}
              <StatusStrip
                order={order}
                canConfirmReceipt={!!canConfirmReceipt}
                confirmingReceipt={confirmingReceipt}
                onConfirmReceipt={handleConfirmReceipt}
              />

              {}
              {order.fulfillment === 'delivery' && (
                // key per order: state simulasi (picker, GPS, record) tidak
                // pernah terbawa saat berpindah pesanan.
                <ShippingSimulationSection key={order.orderId} order={order} />
              )}

              {}
              {/* Panel pengantaran: status jujur tanpa ilustrasi posisi.
                  Tidak ada marker/posisi kurir palsu; lihat delivery-status-panel. */}
              {order.fulfillment === 'delivery' && (
                <>
                  <SectionTitle>Status Pengantaran</SectionTitle>
                  <DeliveryStatusPanel order={order} />
                </>
              )}

              {}
              {order.fulfillment === 'delivery' && order.biteshipOrderId && (
                <>
                  <SectionTitle>Lacak Pengiriman</SectionTitle>
                  <ShipmentTrackingSection order={order} />
                </>
              )}

              {}
              {order.fulfillment === 'pickup' && orderStatus === 'ready_for_pickup' && (
                <PickupReadyInfo order={order} />
              )}

              {}
              <SectionTitle>Produk</SectionTitle>
              <div className="mt-2 flex items-center gap-3 rounded-xl ring-1 ring-border p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <SmartImage src={order.image} alt={order.productName} sizes="64px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {order.productName}
                  </p>
                  <p className="text-xs text-muted-foreground">{order.vendorName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    × {order.quantity}
                    {typeof order.unitPrice === 'number'
                      ? ` · ${formatRupiah(order.unitPrice)} / porsi`
                      : ''}
                    {' · '}
                    Total sementara {formatRupiah(order.subtotal)}
                  </p>
                </div>
              </div>

              {}
              <SectionTitle>
                {order.fulfillment === 'delivery' ? 'Pengiriman' : 'Pengambilan'}
              </SectionTitle>
              <FulfillmentSection order={order} />

              {}
              <SectionTitle>Pembayaran</SectionTitle>
              <dl className="mt-2 space-y-2 rounded-xl ring-1 ring-border p-3.5 text-sm">
                <Row label="Total sementara" value={formatRupiah(order.subtotal)} />
                {order.discount > 0 && (
                  <Row
                    label={`Diskon promo${order.promoCode ? ` (${order.promoCode})` : ''}`}
                    value={`−${formatRupiah(order.discount)}`}
                    accent
                  />
                )}
                <Row label="Biaya admin" value={formatRupiah(order.serviceFee)} />
                {order.deliveryFee > 0 && (
                  <Row label="Biaya pengantaran" value={formatRupiah(order.deliveryFee)} />
                )}
                {(order.coinUsed ?? 0) > 0 && (
                  <Row
                    label="ReBites Coin digunakan"
                    value={`−${(order.coinUsed ?? 0).toLocaleString('id-ID')} Coin`}
                    accent
                  />
                )}
                <div className="flex items-center justify-between border-t border-border pt-2.5">
                  <dt className="font-display font-medium text-foreground">Total</dt>
                  <dd className="font-display text-lg font-semibold tabular-nums text-primary">
                    {formatRupiah(order.total)}
                  </dd>
                </div>
              </dl>

              {}
              {(order.coinEarned ?? 0) > 0 && (
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-primary/15 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Coins className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-display text-sm font-bold tabular-nums text-primary">
                      +{order.coinEarned.toLocaleString('id-ID')} Coin diperoleh
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reward pembelian masuk ke saldo Coin kamu
                    </p>
                  </div>
                </div>
              )}

              {}
              <SectionTitle>Riwayat Status</SectionTitle>
              <OrderStatusTimeline order={order} />

              {}
              <SectionTitle>Informasi Pesanan</SectionTitle>
              <dl className="mt-2 space-y-2 rounded-xl ring-1 ring-border p-3.5 text-sm">
                <Row label="ID Pesanan" value={`#${order.orderId}`} mono />
                <Row label="Tanggal" value={formatOrderDate(order.createdAt)} />
                <Row label="Waktu" value={formatOrderTime(order.createdAt)} />
                <Row label="Metode pembayaran" value={paymentMethodName(order.paymentMethodId)} />
                <Row
                  label="Status"
                  value={
                    order.status === 'completed'
                      ? 'Selesai'
                      : getStatusLabel(orderStatus)
                  }
                />
                {typeof order.co2eSavedKg === 'number' && (
                  <Row
                    label="CO₂e dicegah"
                    value={`≈ ${order.co2eSavedKg.toLocaleString('id-ID', {
                      maximumFractionDigits: 2,
                    })} kg`}
                  />
                )}
              </dl>

              {}
              {order.status === 'completed' && (
                <ReviewBlock
                  orderId={order.orderId}
                  vendorName={order.vendorName}
                  productName={order.productName}
                  userId={userId}
                  existing={existingReview}
                  onSaved={() => {
                    toast({ title: 'Penilaian tersimpan', description: 'Terima kasih atas ulasannya!' });
                    onReviewed();
                  }}
                />
              )}
            </div>

            {}
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              {canConfirmReceipt && (
                <button
                  type="button"
                  disabled={confirmingReceipt}
                  onClick={handleConfirmReceipt}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-600/25 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCheck className="h-4 w-4" />
                  {confirmingReceipt ? 'Memproses...' : 'Pesanan Sudah Saya Terima'}
                </button>
              )}
              {order.status === 'completed' && (
                <button
                  type="button"
                  onClick={handleReorder}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark"
                >
                  <RotateCcw className="h-4 w-4" />
                  Pesan Lagi
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenReport}
                disabled={reportLoading}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-destructive px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
              >
                <Flag className="h-4 w-4" />
                {reportLoading ? 'Memuat…' : 'Laporkan'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-primary px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary-dark/20"
              >
                Tutup
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    <ReportUserModal
      open={reportOpen}
      reportedUserId={reportTarget?.userId ?? null}
      reportedLabel="pemilik toko ini"
      onClose={() => setReportOpen(false)}
    />
  </>
  );
}

function StatusStrip({
  order,
  canConfirmReceipt,
  confirmingReceipt,
  onConfirmReceipt,
}: {
  order: StoredOrder;
  canConfirmReceipt: boolean;
  confirmingReceipt: boolean;
  onConfirmReceipt: () => void;
}) {
  const remaining = useCountdown(order.estimatedCompletionAt ?? order.createdAt);
  const orderStatus = order.orderStatus ?? 'processing';

  if (order.status === 'completed') {
    const at = order.completedAt ?? order.estimatedCompletionAt;
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
        <Check className="h-4 w-4" strokeWidth={3} />
        Selesai{at ? ` pada ${formatOrderDateTimeShort(at)}` : ''}
      </div>
    );
  }

  const statusLabel = getStatusLabel(orderStatus);
  const isPickupReady = orderStatus === 'ready_for_pickup';
  const isOutForDelivery = orderStatus === 'out_for_delivery';

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 py-2.5 ring-1 ring-primary/15">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          {statusLabel}
          {remaining !== null && remaining > 0 && (
            <span className="text-muted-foreground">
              ·{' '}
              {order.fulfillment === 'delivery'
                ? `Perkiraan tiba dalam ${Math.max(1, Math.ceil(remaining / 60))} menit`
                : `Siap diambil dalam ${Math.max(1, Math.ceil(remaining / 60))} menit`}
            </span>
          )}
        </span>
        <span className="font-display text-base font-semibold tabular-nums text-primary">
          {remaining !== null && remaining > 0
            ? formatCountdown(remaining)
            : '-'}
        </span>
      </div>

      {}
      {canConfirmReceipt && (
        <button
          type="button"
          disabled={confirmingReceipt}
          onClick={onConfirmReceipt}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/25 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex items-center justify-center gap-2">
            <CheckCheck className="h-4 w-4" />
            {confirmingReceipt ? 'Memproses...' : 'Pesanan Sudah Saya Terima'}
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * Label display status Biteship (status kurir saja).
 * Bukan order_status ReBites; tidak memengaruhi lifecycle.
 */
const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  confirmed: 'Pesanan dikonfirmasi',
  scheduled: 'Terjadwal',
  allocated: 'Kurir ditugaskan',
  picking_up: 'Kurir menuju toko',
  picked: 'Pesanan diambil kurir',
  in_transit: 'Dalam perjalanan',
  dropping_off: 'Kurir mengantar',
  delivered: 'Telah diterima',
  on_hold: 'Pengiriman ditahan',
  return_in_transit: 'Dalam proses pengembalian',
  returned: 'Pesanan dikembalikan',
  rejected: 'Pengiriman ditolak',
  cancelled: 'Pengiriman dibatalkan',
  disposed: 'Pengiriman dihentikan',
  courier_not_found: 'Kurir belum tersedia',
};

/**
 * section shipment buyer (display-only dari StoredOrder).
 * Hanya dirender bila delivery + biteshipOrderId ada (guard di caller).
 * shipmentError TIDAK PERNAH ditampilkan; tanpa API call; tanpa polling.
 */
function ShipmentTrackingSection({ order }: { order: StoredOrder }) {
  const [copiedResi, setCopiedResi] = useState(false);

  const courierLabel =
    order.courierServiceName?.trim() || order.courierCode?.trim() || null;
  const resi =
    order.biteshipWaybillId?.trim() || order.biteshipTrackingId?.trim() || null;
  const statusLabel =
    (order.shipmentStatus && SHIPMENT_STATUS_LABELS[order.shipmentStatus]) ||
    'Status pengiriman belum tersedia';

  const handleCopyResi = async () => {
    if (!resi) return;
    try {
      await navigator.clipboard.writeText(resi);
      setCopiedResi(true);
      window.setTimeout(() => setCopiedResi(false), 1600);
      toast({ title: 'Nomor resi disalin' });
    } catch {
      toast({
        title: 'Gagal menyalin',
        description: `Salin manual: ${resi}`,
      });
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl ring-1 ring-hairline p-3.5 text-sm">
      {courierLabel && <Row label="Kurir" value={courierLabel} />}
      <div className="flex items-start justify-between gap-4">
        <dt className="shrink-0 text-charcoal-500">Nomor resi</dt>
        {resi ? (
          <dd className="flex min-w-0 items-center justify-end gap-2 text-right font-medium tabular-nums text-charcoal-900">
            <span className="break-all">{resi}</span>
            <button
              type="button"
              onClick={handleCopyResi}
              aria-label="Salin nomor resi"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-white text-charcoal-900 transition-colors hover:border-sage-500/50 hover:text-caramel"
            >
              {copiedResi ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </dd>
        ) : (
          <dd className="text-right text-charcoal-500">Nomor resi belum tersedia</dd>
        )}
      </div>
      <Row label="Status" value={statusLabel} />
    </div>
  );
}

function PickupReadyInfo({ order }: { order: StoredOrder }) {
  return (
    <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-emerald-600" />
        <p className="text-sm font-semibold text-emerald-700">Pesanan Siap Diambil</p>
      </div>
      <p className="mt-1 text-xs text-emerald-600">
        Silakan ambil pesananmu di toko <strong>{order.vendorName}</strong>.
      </p>
      {order.vendorAddress && (
        <a
          href={mapsUrl(order.vendorAddress)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
        >
          <MapPin className="h-3 w-3" /> Lihat Lokasi Toko
        </a>
      )}
    </div>
  );
}

function FulfillmentSection({ order }: { order: StoredOrder }) {
  const isDelivery = order.fulfillment === 'delivery';

  return (
    <div className="mt-2 space-y-3 rounded-xl ring-1 ring-border p-3.5">
      {}
      <div className="flex items-start gap-3">
        <span
          className={
            isDelivery
              ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'
              : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary'
          }
        >
          <Store className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">
            {isDelivery ? 'Dari toko' : 'Ambil di'}
          </p>
          <p className="text-[13px] text-foreground">{order.vendorName}</p>
          <p className="text-xs text-muted-foreground">{order.vendorAddress ?? '-'}</p>
          {!isDelivery && order.vendorOpenHours && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Jam operasional {order.vendorOpenHours}
            </p>
          )}
          <a
            href={mapsUrl(order.vendorAddress ?? '')}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <MapPin className="h-3 w-3" /> Lihat Lokasi
          </a>
        </div>
      </div>

      {}
      {isDelivery && order.addressSnapshot && (
        <>
          <div className="ml-4 h-px bg-border" style={{ width: 24 }} />
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Truck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">
                Ke {order.addressSnapshot.label}
              </p>
              <p className="text-[13px] text-foreground">
                {order.addressSnapshot.receiverName} · {order.addressSnapshot.phone}
              </p>
              <p className="break-words text-xs text-muted-foreground">
                {order.addressSnapshot.fullAddress}, {order.addressSnapshot.district},{' '}
                {order.addressSnapshot.city}, {order.addressSnapshot.province}
                {/* kode pos jika ada; order lama tanpa postal tetap tampil. */}
                {order.addressSnapshot.postalCode ? ` ${order.addressSnapshot.postalCode}` : ''}
              </p>
              {order.addressSnapshot.note && (
                <p className="mt-0.5 text-xs italic text-muted-foreground">
                  Catatan: {order.addressSnapshot.note}
                </p>
              )}
              {typeof order.distanceKm === 'number' && (
                <p className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  Jarak {order.distanceKm.toLocaleString('id-ID')} km · estimasi{' '}
                  {order.estimatedMinutes ?? '-'} menit
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {!isDelivery && typeof order.preparationMinutes === 'number' && (
        <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
          Estimasi siap diambil ± {order.preparationMinutes} menit setelah pesanan dibuat.
        </p>
      )}
    </div>
  );
}

function ReviewBlock({
  orderId,
  vendorName,
  productName,
  userId,
  existing,
  onSaved,
}: {
  orderId: string;
  vendorName: string;
  productName: string;
  userId: string | null;
  existing:
    | { rating: number; comment: string; createdAt: string }
    | undefined;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [saving, setSaving] = useState(false);

  if (existing) {
    return (
      <div className="mt-6">
        <SectionTitle>Penilaianmu</SectionTitle>
        <div className="mt-2 rounded-xl ring-1 ring-border p-3.5">
          <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary">
            <Check className="h-4 w-4" strokeWidth={3} />
            Sudah dinilai
          </p>
          <div className="mt-1.5 flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={
                  n <= existing.rating
                    ? 'h-4 w-4 fill-primary text-primary'
                    : 'h-4 w-4 text-border'
                }
              />
            ))}
          </div>
          {existing.comment && (
            <p className="mt-2 break-words text-[13px] text-foreground">
              &ldquo;{existing.comment}&rdquo;
            </p>
          )}
        </div>
      </div>
    );
  }

  const submit = () => {
    if (saving || !userId || rating < 1) return;
    setSaving(true);
    saveReview({
      orderId,
      userId,
      rating,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
    })
      .then(() => {
        onSaved();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : '';
        toast({
          title: 'Gagal menyimpan penilaian',
          description: msg || 'Coba lagi sebentar.',
        });
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="mt-6">
      <SectionTitle>Bagaimana pengalamanmu?</SectionTitle>
      <p className="mt-1 text-xs text-muted-foreground">
        Nilai pesanan {productName} dari {vendorName}.
      </p>
      <div className="mt-2 rounded-xl ring-1 ring-border p-3.5">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Beri ${n} bintang`}
              onClick={() => setRating(n)}
              className="rounded p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={
                  n <= rating
                    ? 'h-6 w-6 fill-primary text-primary'
                    : 'h-6 w-6 text-border'
                }
              />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ceritakan pengalamanmu (opsional)…"
          rows={2}
          className="mt-2.5 w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary"
        />
        <button
          type="button"
          onClick={submit}
          disabled={rating < 1 || saving}
          className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          Beri Penilaian
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 first:mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </h3>
  );
}

function Row({
  label,
  value,
  accent = false,
  mono = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          accent
            ? 'text-right font-medium tabular-nums text-primary'
            : mono
              ? 'text-right font-medium tabular-nums text-foreground'
              : 'text-right font-medium text-foreground'
        }
      >
        {value}
      </dd>
    </div>
  );
}

function formatOrderDateTimeShort(iso: string): string {
  return `${formatOrderDate(iso)}, ${formatOrderTime(iso)}`;
}
