'use client';

import { useMemo } from 'react';
import { Coins, TrendingDown, TrendingUp } from 'lucide-react';
import { useRebitesCoins } from '@/hooks/use-rebites-coins';
import type { CoinTransaction } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Riwayat ReBites Coin untuk pengguna.
 *
 * Halaman ini dibuat karena panel admin sekarang bisa memberi dan menarik
 * koin. Tanpa halaman ini, user tidak punya tempat untuk melihat dari mana
 * koinnya berasal — dan "ReBites Coin" di Pengaturan sudah menjanjikan hal
 * itu sejak awal.
 *
 * Sumber data: `useRebitesCoins()`, hook yang sama dengan dipakai saat
 * checkout. Jadi angka saldo di sini sama persis dengan yang dipakai untuk
 * memotong pembayaran — tidak ada hitungan kedua yang bisa berbeda.
 */

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

/**
 * Label per transaksi.
 *
 * Penarikan admin memakai tipe `spent` yang sama dengan potongan pesanan, jadi
 * Bedakan lewat deskripsinya. Tanpa ini, user melihat "Dipakai untuk pesanan"
 * padahal koinnya memang ditarik admin.
 */
function labelTransaksi(tx: CoinTransaction): string {
  const deskripsi = (tx.description ?? '').toLowerCase();
  if (tx.type === 'spent' && deskripsi.includes('admin')) {
    return 'Ditarik oleh tim ReBites';
  }
  return LABEL_TIPE[tx.type] ?? 'Perubahan koin';
}

/** Pengurang: `spent`. Penambah: sisanya. */
function adalahPengurang(tx: CoinTransaction): boolean {
  return tx.type === 'spent';
}

/** Kelompokkan transaksi per bulan, terbaru di atas. */
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

  const kelompok = useMemo(() => kelompokkan(transactions), [transactions]);
  const totalDipakai = useMemo(
    () =>
      transactions
        .filter(adalahPengurang)
        .reduce((total, tx) => total + tx.amount, 0),
    [transactions]
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-12 lg:pt-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
        ReBites Coin
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Saldo koinmu dan riwayatnya. Koin bisa dipakai sebagai potongan saat checkout.
      </p>

      <section
        aria-label="Ringkasan koin"
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
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

      <section aria-labelledby="riwayat-koin" className="mt-8">
        <h2 id="riwayat-koin" className="text-sm font-bold text-charcoal-900">
          Riwayat transaksi
        </h2>

        {transactions.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-border bg-white px-4 py-6 text-center text-sm text-muted-foreground">
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
                      <li
                        key={tx.id}
                        className="flex items-start justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-charcoal-900">
                            {labelTransaksi(tx)}
                          </p>
                          {tx.description && (
                            <p
                              className="truncate text-xs text-muted-foreground"
                              title={tx.description}
                            >
                              {tx.description}
                            </p>
                          )}
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatWaktu(tx.createdAt)}
                            {tx.orderId ? ` · ${tx.orderId}` : ''}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 text-sm font-bold tabular-nums',
                            pengurang ? 'text-destructive' : 'text-primary'
                          )}
                        >
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
    </div>
  );
}
