'use client';

import { useCallback, useEffect, useState } from 'react';
import { Coins, Minus, Plus, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useAdminMe } from '@/hooks/use-admin-me';
import {
  AdminUsersApiError,
  adjustAdminUserCoins,
  fetchAdminUserCoins,
  type AdminCoinHistoryItem,
  type AdminUserCoinsResult,
} from '@/lib/admin-users';
import { formatTanggalWaktu } from './admin-format';
import { cn } from '@/lib/utils';

/**
 * Panel ReBites Coin pada halaman detail pengguna.
 *
 * DUA HAL YANG DIPISAH DENGAN SENGAJA
 * 1. Boleh melihat dan boleh mengubah adalah dua izin berbeda. Setiap admin
 *    bisa membaca saldo dan riwayat; hanya Super Admin yang mendapat tombol.
 * 2. Tombol yang disembunyikan BUKAN pengaman. Server memeriksa ulang
 *    keanggotaan Super Admin pada setiap POST, dan panel ini hanya mengikuti
 *    `canAdjust` dari server — bukan menghitung sendiri.
 *
 * Saldo tidak pernah disetel langsung. Setiap aksi menulis satu baris ledger
 * baru, sehingga riwayat user tetap menceritakan dari mana koinnya berasal.
 */

const LABEL_TIPE: Record<string, string> = {
  earned: 'Didapat dari pesanan',
  spent: 'Dipakai',
  refund: 'Dikembalikan',
  adjustment: 'Disesuaikan admin',
};

function labelTipe(item: AdminCoinHistoryItem): string {
  if (item.type === 'spent' && item.description.toLowerCase().startsWith('ditarik admin')) {
    return 'Ditarik admin';
  }
  return LABEL_TIPE[item.type] ?? item.type;
}

/** Penanda arah pada riwayat: pengurang tampil dengan tanda minus. */
function arahTanda(item: AdminCoinHistoryItem): string {
  const negatif = item.type === 'spent';
  return `${negatif ? '−' : '+'}${item.amount.toLocaleString('id-ID')}`;
}

function Riwayat({ items }: { items: AdminCoinHistoryItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-[var(--radius)] bg-cream-50 px-4 py-3 text-sm text-sage-500">
        Belum ada transaksi koin untuk pengguna ini.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-charcoal-900">
              {labelTipe(item)}
            </p>
            {item.description && (
              <p className="truncate text-xs text-sage-500" title={item.description}>
                {item.description}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-sage-500">
              {formatTanggalWaktu(item.createdAt)}
              {item.orderCode ? ` · ${item.orderCode}` : ''}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 text-sm font-bold tabular-nums',
              item.type === 'spent' ? 'text-destructive' : 'text-primary'
            )}
          >
            {arahTanda(item)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CoinAdjustmentPanel({ userId }: { userId: string | null }) {
  const { me, status: meStatus } = useAdminMe();
  const [data, setData] = useState<AdminUserCoinsResult | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [mode, setMode] = useState<'tambah' | 'tarik' | null>(null);
  const [nominal, setNominal] = useState('');
  const [alasan, setAlasan] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setStatus('ready');
      setData(null);
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const result = await fetchAdminUserCoins(userId);
      setData(result);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat koin pengguna.');
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // `me` sengaja ikut: status Super Admin bisa selesai SEBELUM atau SESUDAH
  // data koin, dan tombol harus mengikuti jawaban server terakhir.
  const bolehUbah = data?.canAdjust === true && meStatus === 'verified' && me?.isSuperAdmin === true;

  const deltaTerpilih = () => {
    const angka = Number(nominal.replace(/\D/g, ''));
    if (!Number.isFinite(angka) || angka <= 0) return 0;
    return mode === 'tarik' ? -angka : angka;
  };

  const kirim = async () => {
    if (!userId || busy) return;
    const delta = deltaTerpilih();
    if (delta === 0) {
      toast({ title: 'Jumlah belum diisi', description: 'Masukkan jumlah koin lebih dari 0.' });
      return;
    }
    setBusy(true);
    try {
      const result = await adjustAdminUserCoins(userId, delta, alasan);
      setData((prev) => (prev ? { ...prev, balance: result.balance } : prev));
      setMode(null);
      setNominal('');
      setAlasan('');
      toast({
        title: delta > 0 ? 'Koin ditambahkan' : 'Koin ditarik',
        description: `${Math.abs(delta).toLocaleString('id-ID')} koin. Saldo sekarang ${result.balance.toLocaleString('id-ID')}.`,
      });
      // Muat ulang agar riwayat ikut memuat baris baru.
      void load();
    } catch (err) {
      const pesan =
        err instanceof AdminUsersApiError ? err.message : 'Gagal menyesuaikan koin.';
      toast({ title: 'Penyesuaian gagal', description: pesan });
    } finally {
      setBusy(false);
    }
  };

  const bisaKirim =
    bolehUbah &&
    !busy &&
    deltaTerpilih() !== 0 &&
    alasan.trim().length >= 10;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins aria-hidden className="h-4 w-4 text-primary" />
          ReBites Coin
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {status === 'loading' && (
          <p className="text-sm text-sage-500" role="status" aria-live="polite">
            Memuat koin pengguna…
          </p>
        )}

        {status === 'error' && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-destructive">{errorMsg}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Coba lagi
            </Button>
          </div>
        )}

        {status === 'ready' && data && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-[var(--radius)] bg-cream-50 px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-sage-500">
                  Saldo saat ini
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-charcoal-900">
                  {data.balance.toLocaleString('id-ID')}{' '}
                  <span className="text-sm font-semibold text-sage-500">Coin</span>
                </p>
              </div>
              {bolehUbah && mode === null && (
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => setMode('tambah')}>
                    <Plus aria-hidden className="mr-1 h-3.5 w-3.5" />
                    Beri koin
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setMode('tarik')}
                  >
                    <Minus aria-hidden className="mr-1 h-3.5 w-3.5" />
                    Tarik koin
                  </Button>
                </div>
              )}
            </div>

            {/*
              Keterangan untuk admin biasa: tanpa kalimat ini, tidak adanya
              tombol terasa seperti halaman rusak, bukan batasan hak akses.
            */}
            {data.canAdjust === false && (
              <p className="flex items-start gap-2 rounded-[var(--radius)] border border-border bg-white px-4 py-3 text-xs text-sage-500">
                <ShieldAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Hanya Super Admin yang dapat mengubah koin pengguna. Anda dapat melihat
                saldo dan riwayatnya.
              </p>
            )}

            {bolehUbah && mode !== null && (
              <div className="grid gap-3 rounded-[var(--radius)] border border-border bg-white p-4">
                <p className="text-sm font-semibold text-charcoal-900">
                  {mode === 'tambah' ? 'Beri koin ke pengguna ini' : 'Tarik koin dari pengguna ini'}
                </p>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-charcoal-700">Jumlah koin</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={nominal}
                    onChange={(e) => setNominal(e.target.value.replace(/\D/g, ''))}
                    placeholder="0"
                    className="h-10 rounded-[var(--radius)] border border-border bg-white px-3 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-[11px] text-sage-500">
                    Maksimal {data.maxPerAction.toLocaleString('id-ID')} koin per aksi.
                    {deltaTerpilih() !== 0 && (
                      <>
                        {' '}
                        Saldo setelah aksi:{' '}
                        <strong className="tabular-nums">
                          {Math.max(0, data.balance + deltaTerpilih()).toLocaleString('id-ID')}{' '}
                          Coin
                        </strong>
                      </>
                    )}
                  </span>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-charcoal-700">
                    Alasan (wajib, minimal 10 karakter)
                  </span>
                  <textarea
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="Contoh: kompensasi pesanan terlambat"
                    className="resize-none rounded-[var(--radius)] border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-[11px] text-sage-500">
                    Alasan terlihat oleh pengguna di riwayat koin dan tercatat di audit admin.
                  </span>
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={!bisaKirim} onClick={() => void kirim()}>
                    {busy ? 'Menyimpan…' : 'Simpan'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setMode(null);
                      setNominal('');
                      setAlasan('');
                    }}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-sage-500">
                Riwayat terakhir
              </p>
              <Riwayat items={data.history} />
              {data.history.length >= data.historyLimit && (
                <p className="mt-2 text-[11px] text-sage-500">
                  Menampilkan {data.historyLimit} transaksi terakhir. Saldo di atas dihitung
                  dari seluruh transaksi.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
