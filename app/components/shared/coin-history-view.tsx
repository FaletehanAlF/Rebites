'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Coins, TrendingDown, TrendingUp } from 'lucide-react';
import { useRebitesCoins } from '@/hooks/buyer/use-rebites-coins';
import { useOrders } from '@/hooks/buyer/use-orders';
import { REBITES_COIN_RATE } from '@/hooks/buyer/use-order-calculation';
import type { CoinTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';

const LABEL_TIPE: Record<string, string> = {
    earned: 'Didapat dari pesanan',
    spent: 'Dipakai untuk pesanan',
    refund: 'Dikembalikan',
    adjustment: 'Diberikan oleh tim ReBites',
};
const ZONA_WAKTU = 'Asia/Jakarta';
const TANGGAL = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: ZONA_WAKTU,
});
const JAM = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ZONA_WAKTU,
});
function formatWaktu(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${TANGGAL.format(date)} · ${JAM.format(date)}`;
}
function labelTransaksi(tx: CoinTransaction): string {
    const deskripsi = (tx.description ?? '').toLowerCase();
    if (tx.type === 'spent' && deskripsi.includes('admin')) {
        return 'Ditarik oleh tim ReBites';
    }
    return LABEL_TIPE[tx.type] ?? 'Perubahan koin';
}
function adalahPengurang(tx: CoinTransaction): boolean {
    return tx.type === 'spent';
}
function kelompokkan(transactions: CoinTransaction[]) {
    const peta = new Map<string, CoinTransaction[]>();
    for (const tx of transactions) {
        const date = new Date(tx.createdAt);
        if (Number.isNaN(date.getTime())) continue;
        const kunci = new Intl.DateTimeFormat('id-ID', {
            month: 'long',
            year: 'numeric',
            timeZone: ZONA_WAKTU,
        }).format(date);
        const daftar = peta.get(kunci) ?? [];
        daftar.push(tx);
        peta.set(kunci, daftar);
    }
    return Array.from(peta.entries());
}

export function CoinHistoryView() {
    const { balance, totalEarned, transactions } = useRebitesCoins();
    const { orders, loading: ordersLoading } = useOrders();
    const kelompok = useMemo(() => kelompokkan(transactions), [transactions]);
    const totalDipakai = useMemo(() => transactions
        .filter(adalahPengurang)
        .reduce((total, tx) => total + tx.amount, 0), [transactions]);
    const ordersWithCoins = useMemo(() => orders
        .filter((order) => (order.coinEarned ?? 0) > 0)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [orders]);

    return (
        <div className="min-h-screen bg-white pb-28 lg:pb-12">
            <section className="border-b border-border/70 bg-white">
                <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
                    <Link
                        href="/pengaturan"
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-border bg-white px-4 text-xs font-semibold text-primary shadow-sm transition-colors hover:border-primary/30 hover:bg-secondary"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                        Kembali ke Pengaturan
                    </Link>

                    <div className="mt-5 max-w-2xl">
                        <h1 className="font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.03em] text-primary">
                            ReBites Coin
                        </h1>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            Saldo koinmu dan riwayatnya. Koin bisa dipakai sebagai potongan saat checkout.
                        </p>
                    </div>
                </div>
            </section>

            <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <section aria-label="Ringkasan koin" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                            <Coins aria-hidden className="h-3.5 w-3.5" />
                            Saldo
                        </span>
                        <p className="mt-1.5 text-2xl font-bold tabular-nums text-charcoal-900">
                            {balance.toLocaleString('id-ID')}
                        </p>
                        <p className="text-xs text-muted-foreground">Coin tersedia</p>
                    </div>

                    <div className="rounded-2xl border border-border bg-white p-4">
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            <TrendingUp aria-hidden className="h-3.5 w-3.5" />
                            Total didapat
                        </span>
                        <p className="mt-1.5 text-2xl font-bold tabular-nums text-charcoal-900">
                            {totalEarned.toLocaleString('id-ID')}
                        </p>
                        <p className="text-xs text-muted-foreground">Coin masuk</p>
                    </div>

                    <div className="rounded-2xl border border-border bg-white p-4">
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            <TrendingDown aria-hidden className="h-3.5 w-3.5" />
                            Total dipakai
                        </span>
                        <p className="mt-1.5 text-2xl font-bold tabular-nums text-charcoal-900">
                            {totalDipakai.toLocaleString('id-ID')}
                        </p>
                        <p className="text-xs text-muted-foreground">Coin keluar</p>
                    </div>
                </section>

                <section aria-labelledby="perkiraan-koin" className="mt-8">
                    <h2 id="perkiraan-koin" className="text-sm font-bold text-charcoal-900">
                        Perkiraan koin dari pembelian
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Setiap pesanan memberi{' '}
                        {(REBITES_COIN_RATE * 100).toLocaleString('id-ID', {
                            maximumFractionDigits: 2,
                        })}
                        % dari total harga produk sebagai koin (dibulatkan ke bawah). Koin
                        masuk otomatis setelah pesanan selesai.
                    </p>

                    {ordersLoading ? (
                        <div role="status" aria-label="Memuat perkiraan koin" className="mt-3 space-y-2">
                            <div className="h-16 animate-pulse rounded-2xl border border-border bg-white" />
                            <div className="h-16 animate-pulse rounded-2xl border border-border bg-white" />
                        </div>
                    ) : ordersWithCoins.length === 0 ? (
                        <p className="mt-3 rounded-2xl border border-border bg-white px-4 py-6 text-sm text-muted-foreground">
                            Belum ada pesanan yang memberi koin. Pesan makanan dulu untuk mulai
                            mengumpulkan koin.
                        </p>
                    ) : (
                        <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-white">
                            {ordersWithCoins.map((order) => (
                                <li key={order.orderId} className="flex items-start justify-between gap-3 px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-charcoal-900">
                                            {order.productName}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                            {order.vendorName}
                                            {order.quantity > 1 ? ` · ${order.quantity} porsi` : ''}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                                            {formatWaktu(order.createdAt)}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                                        +{order.coinEarned.toLocaleString('id-ID')}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section aria-labelledby="riwayat-koin" className="mt-8">
                    <h2 id="riwayat-koin" className="text-sm font-bold text-charcoal-900">
                        Riwayat transaksi
                    </h2>

                    {transactions.length === 0 ? (
                        <p className="mt-3 rounded-2xl border border-border bg-white px-4 py-6 text-sm text-muted-foreground">
                            Belum ada transaksi koin. Koin didapat setiap kali pesananmu selesai.
                        </p>
                    ) : (
                        <div className="mt-3 space-y-6">
                            {kelompok.map(([bulan, daftar]) => (
                                <div key={bulan}>
                                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                        {bulan}
                                    </h3>
                                    <ul className="mt-2 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-white">
                                        {daftar.map((tx) => {
                                            const pengurang = adalahPengurang(tx);
                                            return (
                                                <li key={tx.id} className="flex items-start justify-between gap-3 px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-charcoal-900">
                                                            {labelTransaksi(tx)}
                                                        </p>
                                                        {tx.description && (
                                                            <p className="truncate text-xs text-muted-foreground" title={tx.description}>
                                                                {tx.description}
                                                            </p>
                                                        )}
                                                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                            {formatWaktu(tx.createdAt)}
                                                            {tx.orderId ? ` · ${tx.orderId}` : ''}
                                                        </p>
                                                    </div>
                                                    <span className={cn('shrink-0 text-sm font-bold tabular-nums', pengurang ? 'text-destructive' : 'text-primary')}>
                                                        {pengurang ? '−' : '+'}
                                                        {tx.amount.toLocaleString('id-ID')}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </section>
        </div>
    );
}
