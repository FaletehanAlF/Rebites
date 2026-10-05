'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  RefreshCw,
  ShieldAlert,
  Store,
  XCircle,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { SmartImage } from '@/app/components/shared/SmartImage';
import {
  AdminApiError,
  fetchModerationHistory,
  type ModerationHistoryItem,
} from '@/lib/admin-moderation';

const PAGE_LIMIT = 20;

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function ModerationHistoryView() {
  const router = useRouter();
  const [items, setItems] = useState<ModerationHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(
    async (nextOffset: number) => {
      setStatus('loading');
      setErrorMsg('');
      try {
        const result = await fetchModerationHistory(PAGE_LIMIT, nextOffset);
        setItems(result.logs);
        setTotal(result.total);
        setOffset(result.offset);
        setStatus('ready');
      } catch (err) {
        if (err instanceof AdminApiError && err.status === 401) {
          router.replace('/auth/login');
          return;
        }
        if (err instanceof AdminApiError && err.status === 403) {
          setStatus('forbidden');
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat riwayat moderasi.');
        setStatus('error');
      }
    },
    [router]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_LIMIT, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_LIMIT < total;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/admin"
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-charcoal-500 transition-colors hover:bg-white hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard Admin
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-caramel">
            Admin · Riwayat
          </p>
          <h1 className="mt-1 font-display text-[clamp(1.6rem,3.5vw,2.4rem)] font-semibold tracking-tight text-primary">
            Riwayat Moderasi
          </h1>
          <p className="mt-1 text-sm text-sage-500">
            Riwayat tindakan verifikasi produk yang dilakukan oleh admin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-bold">
            {total} riwayat
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => load(offset)}
            disabled={status === 'loading'}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
        </div>
      </div>

      {status === 'loading' && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {status === 'forbidden' && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <ShieldAlert className="h-10 w-10 text-caramel" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">Akses ditolak</h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">
              Halaman ini hanya untuk admin. Akun kamu tidak memiliki hak melihat riwayat moderasi.
            </p>
            <Link href="/" className="mt-5">
              <Button type="button" variant="outline" size="sm">
                Kembali ke Beranda
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {status === 'error' && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <ShieldAlert className="h-10 w-10 text-caramel" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">Gagal memuat riwayat</h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">{errorMsg}</p>
            <Button type="button" size="sm" className="mt-5" onClick={() => load(offset)}>
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && items.length === 0 && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <History className="h-10 w-10 text-primary" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">Belum ada riwayat</h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">
              Tindakan approve dan reject yang dilakukan admin akan tercatat di sini.
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4">
            {items.map((item) => {
              const approved = item.action === 'approve';
              return (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                    <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-cream-100 sm:h-20 sm:w-20">
                      <SmartImage
                        src={item.productImageUrl ?? ''}
                        alt={item.productName}
                        sizes="(max-width: 640px) 100vw, 80px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={approved ? 'success' : 'destructive'}>
                          {approved ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {approved ? 'Disetujui' : 'Ditolak'}
                        </Badge>
                        <span className="text-[11px] text-sage-500">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                      <h2 className="mt-2 break-words font-sans text-base font-bold leading-snug text-charcoal-900">
                        {item.productName}
                      </h2>
                      <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-sage-500">
                        <Store className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.businessName}</span>
                      </p>
                      {!approved && item.reason?.trim() ? (
                        <p className="mt-2 break-words rounded-lg bg-red-50 px-3 py-2 text-[13px] leading-relaxed text-charcoal-700">
                          Alasan: {item.reason.trim()}
                        </p>
                      ) : null}
                      <p className="mt-2 text-[12px] text-sage-500">
                        Dimoderasi oleh {item.moderatorName}
                        {item.moderatorEmail ? ` (${item.moderatorEmail})` : ''}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-sage-500">
              Menampilkan {showingFrom}–{showingTo} dari {total} riwayat
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => load(Math.max(0, offset - PAGE_LIMIT))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => load(offset + PAGE_LIMIT)}
              >
                Berikutnya
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
