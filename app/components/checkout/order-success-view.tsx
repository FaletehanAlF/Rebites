'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Coins, Clock, MapPin, ReceiptText, Truck, XCircle, } from 'lucide-react';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { formatRupiah } from '@/lib/data';
import { getOrderById, rowToStoredOrder } from '@/lib/order-storage';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth, getValidAuthHeader } from '@/lib/auth-token';
import type { StoredOrder } from '@/lib/types';
import { AnimatedNumber } from './animated-number';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from '@/app/components/ui/dialog';
import { cn } from '@/lib/utils';
const EASE = [0.22, 1, 0.36, 1] as const;
function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
const PAYMENT_NAMES: Record<string, string> = {
    qris: 'QRIS',
    gopay: 'GoPay',
    ovo: 'OVO',
    dana: 'DANA',
    shopeepay: 'ShopeePay',
    'transfer-bank': 'Transfer Bank',
    xendit: 'Xendit',
    'rebites-coin': 'ReBites Coin',
};
export function OrderSuccessView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const [order, setOrder] = useState<StoredOrder | null | undefined>(undefined);
    const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
    const [showPopup, setShowPopup] = useState(true);
    const [countdown, setCountdown] = useState(5);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isPending = paymentStatus === 'unpaid' || paymentStatus === null;
    const isFailed = paymentStatus === 'failed';
    const isPaid = !isPending && !isFailed;
    useEffect(() => {
        if (!orderId)
            return;
        let mounted = true;
        let attempts = 0;
        const loadOrder = async (): Promise<boolean> => {
            const direct = await getOrderById(orderId);
            if (direct) {
                if (mounted)
                    setOrder(direct);
                return true;
            }
            try {
                const authHeader = await getValidAuthHeader();
                try {
                    const res = await fetchWithAuth(`/api/orders/${encodeURIComponent(orderId)}`, {
                        headers: { Authorization: authHeader },
                    });
                    if (res.ok) {
                        const json = (await res.json().catch(() => null)) as {
                            order?: Record<string, unknown>;
                        } | null;
                        if (json?.order) {
                            if (mounted)
                                setOrder(rowToStoredOrder(json.order));
                            return true;
                        }
                    }
                }
                catch {
                }
            }
            catch {
            }
            return false;
        };
        const run = async () => {
            const found = await loadOrder();
            if (found || !mounted)
                return;
            const maxAttempts = 5;
            retryRef.current = setInterval(async () => {
                if (!mounted && retryRef.current) {
                    clearInterval(retryRef.current);
                    return;
                }
                const ok = await loadOrder();
                attempts += 1;
                if (ok || attempts >= maxAttempts) {
                    if (retryRef.current)
                        clearInterval(retryRef.current);
                    if (!ok && mounted)
                        setOrder(null);
                }
            }, 2000);
        };
        void run();
        return () => {
            mounted = false;
            if (retryRef.current)
                clearInterval(retryRef.current);
        };
    }, [orderId]);
    useEffect(() => {
        if (!orderId || order === undefined)
            return;
        let cancelled = false;
        let elapsed = 0;
        const fetchStatus = async () => {
            try {
                const authHeader = await getValidAuthHeader();
                await fetchWithAuth('/api/checkout/xendit/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: authHeader,
                    },
                    body: JSON.stringify({ orderCode: orderId }),
                });
            }
            catch {
            }
            const { data } = await supabase
                .from('orders')
                .select('payment_status')
                .eq('order_code', orderId)
                .maybeSingle();
            if (cancelled || !data)
                return;
            const row = data as Record<string, unknown>;
            setPaymentStatus((row.payment_status as string) ?? null);
            if (row.payment_status === 'paid' ||
                row.payment_status === 'failed' ||
                row.payment_status === 'refunded') {
                if (pollRef.current)
                    clearInterval(pollRef.current);
            }
            if (row.payment_status === 'paid')
                setShowPopup(true);
        };
        fetchStatus();
        pollRef.current = setInterval(() => {
            elapsed += 15000;
            if (elapsed >= 180000 && pollRef.current) {
                clearInterval(pollRef.current);
                return;
            }
            fetchStatus();
        }, 15000);
        return () => {
            cancelled = true;
            if (pollRef.current)
                clearInterval(pollRef.current);
        };
    }, [orderId, order]);
    useEffect(() => {
        if (isPaid && showPopup)
            setCountdown(5);
    }, [isPaid, showPopup]);
    useEffect(() => {
        if (!isPaid || !showPopup)
            return;
        if (countdown <= 0) {
            router.push('/home');
            return;
        }
        const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown, isPaid, showPopup, router]);
    if (!orderId) {
        return (<main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-secondary px-6 text-center">
        <p className="font-sans text-lg font-bold text-foreground">Order ID tidak ditemukan</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">Link pembayaran tidak valid.</p>
        <Link href="/home" className="mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
          Kembali ke Beranda
        </Link>
      </main>);
    }
    if (order === undefined) {
        return <main className="min-h-screen bg-secondary"/>;
    }
    if (order === null) {
        return (<main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-secondary px-6 text-center">
        <p className="font-sans text-lg font-bold text-foreground">Pesanan tidak ditemukan</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">Pesanan #{orderId} tidak ada atau sudah dihapus.</p>
        <Link href="/home" className="mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
          Kembali ke Beranda
        </Link>
      </main>);
    }
    const estimasiText = order.estimatedMinutes
        ? `${order.estimatedMinutes} menit`
        : '-';
    const jarakText = typeof order.distanceKm === 'number' ? `${order.distanceKm} km` : null;
    const prepText = typeof order.preparationMinutes === 'number' ? `${order.preparationMinutes} menit persiapan` : null;
    return (<main className="relative min-h-screen bg-secondary">
      
      <div className={cn('flex min-h-screen items-center justify-center px-5 py-16 transition-all duration-300', showPopup && (isPaid || isPending || isFailed) ? 'blur-[5px] pointer-events-none select-none scale-[0.98]' : '')} aria-hidden={showPopup}>
        <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: EASE }} className="w-full max-w-md overflow-hidden rounded-[28px] border border-border bg-white shadow-[0_40px_80px_-30px_rgba(47,66,53,0.25)]">
          
          <div className="bg-secondary px-5 pb-6 pt-9 text-center sm:px-8">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-muted-foreground-400 shadow">
              <ReceiptText className="h-8 w-8"/>
            </span>
            <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground">Detail Pesanan</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">#{order.orderId} · {formatDateTime(order.createdAt)}</p>
            {order.estimatedMinutes && (<p className="mt-2 inline-flex rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                Estimasi selesai {estimasiText} {jarakText ? `· ${jarakText}` : ''}
              </p>)}
          </div>

          <div className="px-6 pt-4">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35, ease: EASE }} className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/15 px-4 py-3.5 shadow-md shadow-primary/25">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow">
                <Coins className="h-5 w-5"/>
              </span>
              <div>
                <p className="font-display text-xl font-bold tabular-nums text-primary">
                  +<AnimatedNumber value={order.coinEarned} format={(v) => v.toLocaleString('id-ID')}/> ReBites Coin
                </p>
                <p className="text-xs text-muted-foreground">Coin akan ditambahkan ke saldo kamu</p>
              </div>
            </motion.div>
          </div>

          <div className="px-6 pb-7 pt-5">
            <div className="flex items-start gap-4 rounded-2xl border border-border bg-secondary p-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                <SmartImage src={order.image} alt={order.productName} sizes="64px"/>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{order.productName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {order.quantity} porsi · {formatDateTime(order.createdAt)}
                </p>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {order.fulfillment === 'delivery' ? (<>
                      <Truck className="h-3 w-3"/> Diantar {jarakText ? `· ${jarakText}` : ''}
                    </>) : (<>
                      <MapPin className="h-3 w-3"/> Ambil Sendiri {prepText ? `· ${prepText}` : ''}
                    </>)}
                </span>
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Total sementara" value={formatRupiah(order.subtotal)}/>
              {order.discount > 0 && <Row label="Diskon promo" value={`−${formatRupiah(order.discount)}`} accent/>}
              <Row label="Biaya admin" value={formatRupiah(order.serviceFee)}/>
              {order.deliveryFee > 0 && <Row label="Biaya pengantaran" value={formatRupiah(order.deliveryFee)}/>}
              {(order.coinUsed ?? 0) > 0 && <Row label="ReBites Coin" value={`−${formatRupiah(order.coinUsed ?? 0)}`} accent/>}
              <div className="flex items-center justify-between border-t border-border pt-2.5">
                <dt className="font-display font-medium text-foreground">Total</dt>
                <dd className="font-display text-lg font-semibold tabular-nums text-primary">{formatRupiah(order.total)}</dd>
              </div>
              <Row label="Metode pembayaran" value={PAYMENT_NAMES[order.paymentMethodId] ?? '-'}/>
              {order.estimatedMinutes && <Row label="Estimasi selesai" value={estimasiText}/>}
              {jarakText && order.fulfillment === 'delivery' && <Row label="Jarak toko" value={jarakText}/>}
            </dl>
          </div>
        </motion.div>
      </div>

      
      <Dialog open={showPopup} onOpenChange={(open) => setShowPopup(open)}>
        <DialogContent className="max-h-[90dvh] gap-0 overflow-hidden border-0 bg-white p-0 sm:max-w-md sm:rounded-[28px] [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="sr-only">
            <DialogTitle>{isFailed ? 'Pembayaran Gagal' : isPending ? 'Menunggu Pembayaran' : 'Pembayaran Berhasil'}</DialogTitle>
            <DialogDescription>Status pembayaran pesanan {order.orderId}</DialogDescription>
          </DialogHeader>

          {isFailed ? (<div className="bg-destructive px-5 pb-10 pt-9 text-center text-white sm:px-8">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-destructive shadow-lg">
                <XCircle className="h-8 w-8" strokeWidth={2.5}/>
              </span>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight">Pembayaran Gagal</h2>
              <p className="mt-1.5 text-sm text-white/85">Pembayaran untuk pesanan #{order.orderId} kadaluarsa atau dibatalkan.</p>
              <p className="mt-2 text-xs text-white/70">Stok telah dikembalikan.</p>
            </div>) : isPending ? (<div className="bg-primary px-5 pb-6 pt-9 text-center text-white sm:px-8">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary shadow-lg">
                <Clock className="h-8 w-8" strokeWidth={2.2}/>
              </span>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight">Menunggu Pembayaran</h2>
              <p className="mt-1.5 text-sm text-white/85">Selesaikan pembayaran di halaman Xendit. Halaman ini akan otomatis ter-update.</p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tabular-nums">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white"/>
                #{order.orderId} · memverifikasi…
              </p>
            </div>) : (<div className="relative overflow-hidden bg-primary px-5 pb-6 pt-9 text-center text-white sm:px-8">
              <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.15 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary shadow-lg">
                <Check className="h-8 w-8" strokeWidth={3}/>
              </motion.span>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight">Pembayaran Berhasil!</h2>
              <p className="mt-1.5 text-sm text-white/85">
                Pesanan kamu sedang diproses oleh <span className="font-semibold">{order.vendorName}</span>
              </p>
              <p className="mt-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tabular-nums">#{order.orderId}</p>
              {order.estimatedMinutes && (<p className="mt-2 text-xs text-white/80">
                  Estimasi selesai <span className="font-semibold">{estimasiText}</span>{' '}
                  {order.fulfillment === 'delivery' && jarakText ? `· jarak ${jarakText}` : ''}
                  {prepText ? ` · ${prepText}` : ''}
                </p>)}
            </div>)}

          
          {!isFailed && (<div className="bg-white px-6 pt-4">
              <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/15 px-4 py-3.5 shadow-sm">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow">
                  <Coins className="h-5 w-5"/>
                </span>
                <div>
                  <p className="font-display text-xl font-bold tabular-nums text-primary">
                    +<AnimatedNumber value={order.coinEarned} format={(v) => v.toLocaleString('id-ID')}/> ReBites Coin
                  </p>
                  <p className="text-xs text-muted-foreground">Coin akan ditambahkan ke saldo kamu</p>
                </div>
              </div>
            </div>)}

          <div className="px-6 pb-7 pt-5">
            
            <div className="flex items-start gap-4 rounded-2xl border border-border bg-secondary p-4">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                <SmartImage src={order.image} alt={order.productName} sizes="48px"/>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{order.productName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{order.quantity} porsi · {order.vendorName}</p>
              </div>
              <p className="shrink-0 font-display text-sm font-semibold tabular-nums text-primary">{formatRupiah(order.total)}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {isFailed ? (<>
                  <Link href={`/detail/pesanan?product=${encodeURIComponent(order.productId)}&qty=${order.quantity}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-primary px-4 py-3 text-sm font-semibold text-primary hover:bg-primary-dark hover:text-white" onClick={() => setShowPopup(false)}>
                    <ArrowRight className="h-4 w-4 rotate-180"/> Coba Lagi
                  </Link>
                  <Link href="/home" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-dark" onClick={() => setShowPopup(false)}>
                    Beranda
                  </Link>
                </>) : isPending ? (<>
                  <button type="button" onClick={() => setShowPopup(false)} className="inline-flex items-center justify-center gap-2 rounded-full border border-border-300 bg-white px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary">
                    Lihat Detail
                  </button>
                  <Link href={`/riwayatPesanan?orderId=${encodeURIComponent(order.orderId)}`} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-dark">
                    <ReceiptText className="h-4 w-4"/> Riwayat
                  </Link>
                </>) : (<>
                  <Link href="/home" className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-dark" onClick={() => setShowPopup(false)}>
                    Beranda <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5"/>
                  </Link>
                  <Link href={`/riwayatPesanan?orderId=${encodeURIComponent(order.orderId)}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-primary bg-white px-4 py-3 text-sm font-semibold text-primary hover:bg-primary-dark hover:text-white" onClick={() => setShowPopup(false)}>
                    <ReceiptText className="h-4 w-4"/> Riwayat
                  </Link>
                </>)}
            </div>

            {!isFailed && (<button type="button" onClick={() => setShowPopup(false)} className="mt-3 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground">
                Lihat detail pesanan di belakang
              </button>)}

            {isPaid && (<p className="mt-3 text-center text-xs text-muted-foreground">
                Beranda dalam <span className="font-semibold tabular-nums text-muted-foreground">{countdown}</span> detik…
              </p>)}
          </div>
        </DialogContent>
      </Dialog>
    </main>);
}
function Row({ label, value, accent = false, }: {
    label: string;
    value: string;
    accent?: boolean;
}) {
    return (<div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={accent ? 'font-medium tabular-nums text-primary' : 'font-medium tabular-nums text-foreground'}>
        {value}
      </dd>
    </div>);
}
