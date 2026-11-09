'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCheck,
  ClipboardList,
  Clock,
  Flame,
  MapPin,
  MessageCircle,
  Package,
  PackageOpen,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah } from '@/lib/data';
import type { StoredOrder } from '@/lib/types';
import {
  ORDERS_UPDATED_EVENT,
  getSellerOrders,
} from '@/lib/order-storage';
import { getSellerUmkm } from '@/lib/product-storage';
import { getSellerStoreSettings } from '@/lib/store-settings-storage';
import {
  SUB_STATUS_LABEL,
  formatOrderDateTime,
  getOrderSubStatus,
} from '@/lib/order-utils';
import {
  getSellerAction,
  needsSellerAction,
  resolveOrderPhase,
} from '@/lib/order-status-source';
import {
  transitionOrderStatus,
  getStatusLabel,
  getStatusColor,
} from '@/lib/order-state-machine';
import { SellerShell } from '@/app/components/seller/dashboard-penjual/SellerShell';
import { Card } from '@/app/components/seller/dashboard-penjual/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { CourierChat } from '@/app/components/buyer/order-history/courier-chat';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { CourierPositionPanel } from '@/app/components/buyer/order-history/courier-position-panel';
import { formatPrepRemaining } from '@/lib/prep-deadline';
import { useCourierLocation } from '@/hooks/use-courier-location';

type OrderTab = 'berlangsung' | 'butuh-aksi' | 'selesai' | 'semua';

const SWEEP_INTERVAL_MS = 5_000;

function useVendorOrders() {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [hydrated, setHydrated] = useState(false);
  /**
   * Toko sudah punya titik lokasi.
   *
   * Trigger `auto_assign_courier_to_delivery` membaca `umkm_profiles.latitude`
   * sebagai titik awal pengantaran; tanpa koordinat ia sengaja tidak menugaskan
   * kurir. Halaman ini memakainya untuk memberi tahu penjual SEBELUM dia
   * menekan tombol, bukan sesudah pesanan tertahan tanpa kurir.
   */
  const [storeHasPoint, setStoreHasPoint] = useState(false);

  const refresh = useCallback(async () => {
    const list = await getSellerOrders();
    setOrders(list);
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSellerStoreSettings()
      .then((settings) => {
        if (cancelled) return;
        const lat = settings?.latitude;
        const lng = settings?.longitude;
        setStoreHasPoint(
          typeof lat === 'number' &&
            typeof lng === 'number' &&
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            !(lat === 0 && lng === 0)
        );
      })
      .catch(() => {
        // Gagal membaca pengaturan toko bukan alasan memblokir pilihan;
        // penjual tetap melihat tombol antarnya.
        if (!cancelled) setStoreHasPoint(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    refresh();

    const onUpdate = () => refresh();
    window.addEventListener(ORDERS_UPDATED_EVENT, onUpdate);
    const intervalId = window.setInterval(onUpdate, SWEEP_INTERVAL_MS * 6);

    return () => {
      window.removeEventListener(ORDERS_UPDATED_EVENT, onUpdate);
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  const ongoing = useMemo(
    () =>
      orders
        .filter((order) => order.status === 'ongoing')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders]
  );

  const completed = useMemo(
    () =>
      orders
        .filter((order) => order.status === 'completed')
        .sort(
          (a, b) =>
            (b.completedAt ?? b.createdAt).localeCompare(
              a.completedAt ?? a.createdAt
            )
        ),
    [orders]
  );

  return { orders: [...ongoing, ...completed], ongoing, completed, hydrated, storeHasPoint };
}

function StatusChip({ order }: { order: StoredOrder }) {
  const subStatus = getOrderSubStatus(order);
  const isDone = subStatus === 'selesai';
  const orderStatus = order.orderStatus ?? 'processing';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]',
        isDone
          ? 'bg-muted text-muted-foreground'
          : 'bg-primary/10 text-primary'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isDone ? 'bg-muted-foreground' : 'bg-primary'
        )}
      />
      {getStatusLabel(orderStatus)}
    </span>
  );
}

function OrderRow({
  order,
  storeHasPoint,
  highlightWaiting = false,
  onStatusChange,
}: {
  order: StoredOrder;
  /** Toko punya titik lokasi, jadi kurir bisa ditugaskan otomatis. */
  storeHasPoint: boolean;
  /** Tiba di halaman lewat filter "Butuh Aksi": sorot kartunya sekali. */
  highlightWaiting?: boolean;
  onStatusChange?: (orderId: string) => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const isOngoing = order.status === 'ongoing';

  // Fase operacional berasal dari SATU sumber (lib/order-status-source.ts).
  // Sebelumnya syarat tombol memakai `!order.progressStatus`, dan
  // progress_status selalu berisi 'disiapkan' dari checkout — sehingga
  // tombol "Mulai Siapkan Pesanan" tidak pernah muncul dan UI jatuh ke
  // tombol cadangan yang mencoba `paid -> out_for_delivery`, transisi yang
  // ditolak trigger database.
  const phase = resolveOrderPhase(order);

  /**
   * Pesanan pengiriman dilewati langsung ke tahap antar begitu penyiapan
   * selesai — penjual tidak perlu menekan tombol kedua.
   *
   * Hanya berlaku bila toko sudah punya titik lokasi: trigger penugasan kurir
   * memerlukan koordinat toko sebagai titik awal, dan tanpa koordinat kurir
   * tidak akan ditugaskan. Pada toko tanpa titik lokasi, alur dua langkah
   * dipertahankan agar pesanan tidak bergerak tanpa kurir.
   */
  const canAutoDispatch =
    storeHasPoint && phase === 'processing' && order.fulfillment === 'delivery';

  const action = isOngoing
    ? getSellerAction(
        phase,
        order.fulfillment,
        canAutoDispatch ? { autoAdvanceTo: 'out_for_delivery' } : undefined
      )
    : null;

  /**
   * Tenggat penyiapan, berasal dari `estimated_completion_at` server.
   *
   * Jam diperbarui 30 detik sekali — cukup untuk teks "Siap dalam N menit"
   * tanpa memicu render tiap detik pada daftar yang bisa berisi banyak order.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isOngoing) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [isOngoing]);
  // Pesanan yang belum dibayar tidak diberi hitung mundur: jam persiapan
  // baru mulai setelah pembayaran diterima, jadi angka apa pun di sini akan
  // menyesatkan (checkout lama bisa tampil "Lewat 20 menit" padahal penjual
  // belum pernah menerima pesanannya).
  const prep =
    isOngoing && phase !== 'pending'
      ? formatPrepRemaining(order.estimatedCompletionAt, now)
      : null;

  const handleAction = async (targetStatus: string) => {
    if (processing) return;
    setProcessing(true);
    try {
      const result = await transitionOrderStatus(order.orderId, targetStatus);
      if (result.success) {
        onStatusChange?.(order.orderId);
        window.dispatchEvent(new Event(ORDERS_UPDATED_EVENT));
      } else {
        console.error('[pesanan] transition failed:', result.error);
        alert(result.error ?? 'Gagal mengubah status');
      }
    } catch (err) {
      console.error('[pesanan] transition error:', err);
    } finally {
      setProcessing(false);
    }
  };

  // Menunggu tindakan penjual (lihat `needsSellerAction`). Kartunya diberi
  // garis merah supaya pesanan yang butuh diketuk tidak hilang di antara
  // pesanan lain di tab "Semua".
  const waitingForSeller = isOngoing && needsSellerAction(phase);

  /**
   * Alat kurir hanya muncul saat pesanan BENAR-BENAR sedang diantar.
   *
   * Selama penyiapan (paid/processing) belum ada kurir yang ditugaskan —
   * trigger penugasan berjalan saat status berpindah ke out_for_delivery —
   * sehingga panel "Kurir belum mengirim posisi" dan tombol Chat Kurir pada
   * tahap itu hanya membingungkan penjual: tampak seperti ada urusan kurir
   * yang harus dia konfirmasi padahal dia hanya sedang memasak.
   */
  const courierToolsActive =
    order.fulfillment === 'delivery' && phase === 'out_for_delivery';
  const { location: courierLocation, freshness: courierFreshness } = useCourierLocation(order.dbId, courierToolsActive);
  const canChatWithCourier = courierToolsActive && Boolean(order.dbId);

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:p-4',
        waitingForSeller ? 'border-destructive/40' : 'border-border'
      )}
    >
      {/*
        Baris utama memakai grid dua kolom tetap pada layar lebar: konten di
        kiri, harga+aksi di kanan. Versi sebelumnya memakai flex dengan
        `sm:flex-col` pada blok harga, sehingga harga dan tombol bertumpuk di
        tengah dan kolom kiri terpotong saat panel kurir ikut jadi anak flex
        (panel itu membawa `sm:col-span-full`, kelas grid yang tidak berlaku
        pada flex).
      */}
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
            <SmartImage src={order.image} alt={`Foto ${order.productName}`} sizes="56px" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-foreground">
                {order.productName}
                {order.quantity > 1 && (
                  <span className="font-medium text-muted-foreground"> × {order.quantity}</span>
                )}
              </p>
              <StatusChip order={order} />
              {waitingForSeller && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white" />
                  Butuh aksi
                </span>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              <span className="whitespace-nowrap font-medium text-charcoal-500">{order.orderId}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 font-medium text-charcoal-700">
                {order.fulfillment === 'delivery' ? (
                  <Truck className="h-3 w-3 shrink-0" aria-hidden />
                ) : (
                  <Store className="h-3 w-3 shrink-0" aria-hidden />
                )}
                {order.fulfillment === 'delivery' ? 'Diantar' : 'Ambil sendiri'}
              </span>
              <span aria-hidden>·</span>
              <span>{formatOrderDateTime(order.createdAt)}</span>
            </p>
            {prep && (
              <p
                className={cn(
                  'mt-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  prep.overdue
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-primary/10 text-primary'
                )}
              >
                <Clock className="h-3 w-3 shrink-0" aria-hidden />
                {prep.text}
              </p>
            )}
            {order.fulfillment === 'delivery' && order.deliveryFee > 0 && (
              <p className="mt-1 text-xs text-sage-500">
                Ongkir {formatRupiah(order.deliveryFee)}
              </p>
            )}
            {order.fulfillment === 'delivery' && order.addressSnapshot && (
              <p className="mt-1 flex items-start gap-1 text-xs leading-relaxed text-muted-foreground">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                {/* Alamat boleh membungkus dua baris, bukan dipotong di tengah
                    jalan: penjual perlu tahu tujuan sebelum menekan tombol
                    pengantaran. */}
                <span className="line-clamp-2 min-w-0 break-words">
                  {order.addressSnapshot.fullAddress}
                </span>
              </p>
            )}
          </div>
        </div>

<div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
        <p className="text-sm font-bold text-primary">
          {formatRupiah(order.total)}
        </p>
        {action ? (
          <button
            type="button"
            disabled={processing}
            onClick={() => handleAction(action.targetStatus)}
            title={action.description}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              action.targetStatus === 'processing'
                ? 'bg-primary shadow-primary/25 hover:bg-primary-dark'
                : action.targetStatus === 'ready_for_pickup'
                  ? 'bg-emerald-600 shadow-emerald-600/25 hover:bg-emerald-700'
                  : 'bg-primary shadow-primary/25 hover:bg-primary-dark'
            )}
          >
            {action.targetStatus === 'processing' && <Package className="h-3.5 w-3.5" />}
            {action.targetStatus === 'ready_for_pickup' && <CheckCheck className="h-3.5 w-3.5" />}
            {action.targetStatus === 'out_for_delivery' && <Truck className="h-3.5 w-3.5" />}
            {action.targetStatus === 'completed' && <CheckCheck className="h-3.5 w-3.5" />}
            {processing ? 'Memproses...' : action.label}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5" />
            {phase === 'pending'
              ? 'Menunggu pembayaran'
              : order.status === 'completed'
                ? 'Selesai diproses'
                : 'Menunggu aksi'}
          </span>
        )}
        {/*
          Chat kurir ditaruh di baris aksi kartu supaya bisa diketuk langsung
          tanpa membuka detail pesanan lebih dulu. Penjual hanya MEMBACA:
          `canSend={false}` menyembunyikan kolom kirim — dia bukan pihak
          yang mengantar.
        */}
        {canChatWithCourier && (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            aria-expanded={chatOpen}
            className={cn(
              'inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              chatOpen
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-white text-foreground hover:border-primary/40 hover:text-primary'
            )}
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              Chat Kurir
            </button>
          )}
        </div>
      </div>
      {/*
        Panel posisi kurir membentang penuh di bawah baris pesanan. Sebelumnya
        ia membawa `sm:col-span-full`, kelas grid yang tidak berlaku karena
        induknya flex — akibatnya panel ikut berebut lebar dengan konten
        pesanan.

        Pelacak kurir live TIDAK dipasang di kartu penjual: sebelumnya
        komponen ini langsung memancarkan GPS perangkat ke kanal Broadcast
        publik. Penjual bukan kurir, dan kanal itu bisa diterima siapa pun yang
        mengetahui kode pesanan.

        Yang ditampilkan ke penjual hanyalah POSISI yang dibaca dari tabel
        ber-RLS (bukan koordinat perangkat penjual), lewat panel di bawah.
      */}
      {courierToolsActive && (
        <CourierPositionPanel
          location={courierLocation}
          freshness={courierFreshness}
          className="w-full border-t border-dashed border-border/70 sm:mt-1"
        />
      )}

      {/*
        Percakapan dengan kurir untuk pesanan ini. Sengaja dialog terpisah,
        bukan panel yang selalu terbuka: daftar pesanan bisa berisi banyak
        kartu, dan sepuluh kotak chat sekaligus membuat halaman tidak terbaca.
      */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="w-[min(480px,100vw-1rem)]">
          <DialogHeader>
            <DialogTitle className="font-display">Chat Kurir</DialogTitle>
            <DialogDescription className="text-xs text-charcoal-500">
              #{order.orderId} · {order.productName}
            </DialogDescription>
          </DialogHeader>
          <CourierChat orderDbId={order.dbId} canSend={false} />
        </DialogContent>
      </Dialog>
    </li>
  );
}

function EmptyState({ hasAnyOrders }: { hasAnyOrders: boolean }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-4 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-primary">
        {hasAnyOrders ? (
          <PackageOpen className="h-6 w-6" />
        ) : (
          <ShoppingBag className="h-6 w-6" />
        )}
      </span>
      <div className="max-w-sm">
        <p className="text-sm font-bold text-foreground">
          {hasAnyOrders ? 'Tidak ada pesanan pada tab ini' : 'Belum ada pesanan masuk'}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {hasAnyOrders
            ? 'Coba buka tab lain untuk melihat pesanan berlangsung atau selesai.'
            : 'Pesanan dari pembeli akan muncul di sini. Untuk demo, buat pesanan lewat halaman toko sebagai pembeli, datanya langsung tersinkron.'}
        </p>
      </div>
    </Card>
  );
}

export default function PesananMasukPage() {
  const { orders, ongoing, completed, hydrated, storeHasPoint } = useVendorOrders();
  const [tab, setTab] = useState<OrderTab>('berlangsung');
  const [storeName, setStoreName] = useState('');

  /**
   * Pesanan berlangsung yang menunggu penjual (belum dibayar tidak dihitung).
   * Angka ini yang ditampilkan di tab dan di judul, supaya penjual langsung
   * tahu ada berapa yang harus diketuk.
   */
  const waitingOrders = useMemo(
    () => ongoing.filter((order) => needsSellerAction(resolveOrderPhase(order))),
    [ongoing]
  );

  useEffect(() => {
    let cancelled = false;
    getSellerUmkm().then((umkm) => {
      if (!cancelled && umkm) setStoreName(umkm.businessName);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs = [
    {
      value: 'berlangsung' as const,
      label: `Berlangsung (${ongoing.length})`,
      badge: 0,
    },
    {
      value: 'butuh-aksi' as const,
      label: `Butuh Aksi (${waitingOrders.length})`,
      badge: waitingOrders.length,
    },
    { value: 'selesai' as const, label: `Selesai (${completed.length})`, badge: 0 },
    { value: 'semua' as const, label: `Semua (${orders.length})`, badge: 0 },
  ];

  const visibleOrders =
    tab === 'berlangsung'
      ? ongoing
      : tab === 'butuh-aksi'
        ? waitingOrders
        : tab === 'selesai'
          ? completed
          : orders;

  return (
    <SellerShell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <h1 className="mt-1 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight tracking-[-0.02em] text-primary">
          Pesanan Masuk
        </h1>
      </motion.div>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter status pesanan">
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors',
              tab === item.value
                ? 'bg-primary text-white'
                : 'border border-border bg-white text-muted-foreground hover:text-foreground'
            )}
          >
            {item.label}
            {/*
              Penanda merah pada tab filter: jumlah pesanan yang benar-benar
              menunggu diketuk. Hanya muncul saat ada, supaya tidak menjadi
              hiasan permanen yang berhenti dibaca orang.
            */}
            {item.badge > 0 && tab !== item.value && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {!hydrated ? (
          <div className="space-y-3" aria-label="Memuat pesanan">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden
                className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-3 sm:p-4 animate-pulse sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="h-14 w-14 shrink-0 rounded-xl bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-48 rounded-full bg-muted" />
                  <div className="h-3 w-32 rounded-full bg-muted" />
                  <div className="h-3 w-24 rounded-full bg-muted" />
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  <div className="h-5 w-20 rounded-full bg-muted" />
                  <div className="h-8 w-24 rounded-full bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleOrders.length === 0 ? (
          <EmptyState hasAnyOrders={orders.length > 0} />
        ) : (
          <ul className="space-y-3">
            {visibleOrders.map((order) => (
              <OrderRow
                key={order.orderId}
                order={order}
                storeHasPoint={storeHasPoint}
                onStatusChange={() => {}}
              />
            ))}
          </ul>
        )}
      </div>
    </SellerShell>
  );
}
