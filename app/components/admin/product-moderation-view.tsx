'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  Store,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Textarea } from '@/app/components/ui/textarea';
import { Toaster } from '@/app/components/ui/toaster';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { toast } from '@/hooks/use-toast';
import {
  AdminApiError,
  approveProduct,
  fetchPendingProducts,
  rejectProduct,
  type PendingProduct,
} from '@/lib/admin-moderation';

const PAGE_LIMIT = 20;
const MAX_REASON_LENGTH = 500;

const formatPrice = (value: number | null | undefined) =>
  `Rp${Number(value ?? 0).toLocaleString('id-ID')}`;

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

export function ProductModerationView() {
  const router = useRouter();
  const [items, setItems] = useState<PendingProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingProduct | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  const load = useCallback(
    async (nextOffset: number) => {
      setStatus('loading');
      setErrorMsg('');
      try {
        const result = await fetchPendingProducts(PAGE_LIMIT, nextOffset);
        setItems(result.products);
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
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat antrean verifikasi.');
        setStatus('error');
      }
    },
    [router]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  const removeFromList = useCallback(
    (id: string, nextTotal: number) => {
      const rest = items.filter((p) => p.id !== id);
      setTotal(nextTotal);
      if (rest.length === 0 && nextTotal > 0) {
        // Halaman kosong setelah aksi - kembali ke halaman terisi terakhir.
        const clamped = Math.max(0, Math.min(offset, Math.max(0, nextTotal - 1)));
        load(clamped - (clamped % PAGE_LIMIT));
        return;
      }
      setItems(rest);
    },
    [items, offset, load]
  );

  const handleApprove = async (product: PendingProduct) => {
    if (busyId) return;
    setBusyId(product.id);
    try {
      await approveProduct(product.id);
      removeFromList(product.id, Math.max(0, total - 1));
      toast({ title: 'Produk disetujui', description: `${product.name} kini tampil di marketplace.` });
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        router.replace('/auth/login');
        return;
      }
      if (err instanceof AdminApiError && err.status === 409) {
        removeFromList(product.id, Math.max(0, total - 1));
        toast({ title: 'Sudah dimoderasi', description: 'Produk ini sudah ditangani (mungkin oleh admin lain).' });
        return;
      }
      toast({
        title: 'Gagal menyetujui',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (product: PendingProduct) => {
    setRejectTarget(product);
    setReason('');
    setReasonError('');
  };

  const handleReject = async () => {
    if (!rejectTarget || rejectBusy) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError('Alasan penolakan wajib diisi.');
      return;
    }
    setRejectBusy(true);
    try {
      await rejectProduct(rejectTarget.id, trimmed);
      const done = rejectTarget;
      setRejectTarget(null);
      setReason('');
      removeFromList(done.id, Math.max(0, total - 1));
      toast({ title: 'Produk ditolak', description: `${done.name} dikembalikan ke penjual dengan alasan.` });
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        router.replace('/auth/login');
        return;
      }
      if (err instanceof AdminApiError && err.status === 409) {
        const done = rejectTarget;
        setRejectTarget(null);
        removeFromList(done.id, Math.max(0, total - 1));
        toast({ title: 'Sudah dimoderasi', description: 'Produk ini sudah ditangani (mungkin oleh admin lain).' });
        return;
      }
      toast({
        title: 'Gagal menolak',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setRejectBusy(false);
    }
  };

  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_LIMIT, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_LIMIT < total;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <Toaster />

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-charcoal-500 transition-colors hover:bg-white hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Beranda
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-caramel">
            Admin · Verifikasi
          </p>
          <h1 className="mt-1 font-display text-[clamp(1.6rem,3.5vw,2.4rem)] font-semibold tracking-tight text-primary">
            Moderasi Produk
          </h1>
          <p className="mt-1 text-sm text-sage-500">
            Tinjau produk UMKM yang menunggu persetujuan sebelum tampil di marketplace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-bold">
            {total} menunggu
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
              Halaman ini hanya untuk admin. Akun kamu tidak memiliki hak moderasi produk.
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
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">Gagal memuat antrean</h2>
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
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">Semua sudah dimoderasi</h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">
              Tidak ada produk pending saat ini. Produk baru dari penjual akan muncul di sini.
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((product) => {
              const busy = busyId === product.id;
              return (
                <Card key={product.id} className="flex flex-col overflow-hidden">
                  <div className="relative h-44 w-full bg-cream-100">
                    <SmartImage
                      src={product.image_url ?? ''}
                      alt={product.name}
                      sizes="(max-width: 640px) 100vw, 33vw"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-caramel px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                      Menunggu verifikasi
                    </span>
                  </div>
                  <CardContent className="flex flex-1 flex-col p-4">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-sage-500">
                      <Store className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {product.umkm?.business_name ?? 'UMKM'}
                      </span>
                    </p>
                    <h2 className="mt-1.5 font-sans text-base font-bold leading-snug text-charcoal-900">
                      {product.name}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[11px]">
                        {product.category}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        Stok {product.stock}
                      </Badge>
                    </div>
                    {product.description?.trim() ? (
                      <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-charcoal-500">
                        {product.description.trim()}
                      </p>
                    ) : null}
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-sans text-lg font-bold text-primary">
                        {formatPrice(product.surplus_price)}
                      </span>
                      <span className="text-xs text-charcoal-500 line-through">
                        {formatPrice(product.original_price)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-sage-500">
                      Dibuat {formatDate(product.created_at)}
                    </p>
                    <div className="mt-4 grid flex-1 grid-cols-2 content-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleApprove(product)}
                      >
                        {busy ? 'Memproses…' : 'Approve'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => openReject(product)}
                      >
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-sage-500">
              Menampilkan {showingFrom}–{showingTo} dari {total} produk
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

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open && !rejectBusy) setRejectTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak produk?</DialogTitle>
            <DialogDescription>
              {rejectTarget
                ? `“${rejectTarget.name}” akan dikembalikan ke penjual beserta alasan di bawah ini.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Textarea
              value={reason}
              maxLength={MAX_REASON_LENGTH}
              rows={4}
              placeholder="Contoh: Foto produk buram, mohon upload ulang foto yang jelas."
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError('');
              }}
            />
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-[11px] text-red-600">{reasonError || <span>&nbsp;</span>}</p>
              <p className="text-[11px] text-sage-500">
                {reason.trim().length}/{MAX_REASON_LENGTH}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={rejectBusy}
              onClick={() => setRejectTarget(null)}
            >
              Batal
            </Button>
            <Button type="button" variant="destructive" disabled={rejectBusy} onClick={handleReject}>
              {rejectBusy ? 'Menolak…' : 'Tolak produk'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
