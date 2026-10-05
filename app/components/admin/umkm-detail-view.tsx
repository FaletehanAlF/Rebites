'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  RefreshCw,
  ShieldAlert,
  Store,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Toaster } from '@/app/components/ui/toaster';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { toast } from '@/hooks/use-toast';
import {
  AdminUmkmApiError,
  fetchAdminUmkmDetail,
  toggleUmkmVerification,
  type AdminUmkmDetailResult,
} from '@/lib/admin-umkm';

const formatPrice = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-';
  return `Rp${Number(value).toLocaleString('id-ID')}`;
};

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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sage-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-charcoal-900">{value}</p>
    </div>
  );
}

export function UmkmDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<AdminUmkmDetailResult | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const result = await fetchAdminUmkmDetail(id);
      setData(result);
      setStatus('ready');
    } catch (err) {
      if (err instanceof AdminUmkmApiError && err.status === 401) {
        router.replace('/auth/login');
        return;
      }
      if (err instanceof AdminUmkmApiError && err.status === 403) {
        setStatus('forbidden');
        return;
      }
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat detail UMKM.');
      setStatus('error');
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async () => {
    if (verifyBusy) return;
    setVerifyBusy(true);
    try {
      const result = await toggleUmkmVerification(id);
      setData((prev) =>
        prev ? { ...prev, umkm: { ...prev.umkm, is_verified: result.is_verified } } : prev
      );
      setConfirmOpen(false);
      toast({
        title: result.is_verified ? 'UMKM diverifikasi' : 'Verifikasi dibatalkan',
        description: result.is_verified
          ? 'Toko kini berstatus Terverifikasi.'
          : 'Toko kini berstatus Belum Terverifikasi.',
      });
    } catch (err) {
      toast({
        title: 'Gagal mengubah status',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setVerifyBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (status === 'forbidden') {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <ShieldAlert className="h-10 w-10 text-caramel" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">Akses ditolak</h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">
              Halaman ini hanya untuk admin.
            </p>
            <Link href="/" className="mt-5">
              <Button type="button" variant="outline" size="sm">
                Kembali ke Beranda
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <ShieldAlert className="h-10 w-10 text-caramel" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">Gagal memuat detail</h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">{errorMsg}</p>
            <Button type="button" size="sm" className="mt-5" onClick={load}>
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { umkm, owner, subscription, products } = data;
  const verified = umkm.is_verified;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <Toaster />
      <Link
        href="/dashboard/admin/umkm"
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-charcoal-500 transition-colors hover:bg-white hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Daftar UMKM
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-cream-100">
            <SmartImage
              src={umkm.logo_url ?? ''}
              alt={umkm.business_name}
              sizes="80px"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={verified ? 'success' : 'secondary'}>
                {verified ? <BadgeCheck className="h-3 w-3" /> : null}
                {verified ? 'Terverifikasi' : 'Belum Terverifikasi'}
              </Badge>
              {umkm.category && (
                <span className="text-[11px] text-sage-500">{umkm.category}</span>
              )}
            </div>
            <h1 className="mt-1 break-words font-display text-[clamp(1.4rem,3vw,2rem)] font-semibold tracking-tight text-primary">
              {umkm.business_name}
            </h1>
            <p className="mt-1 text-sm text-sage-500">
              {umkm.city ?? 'Kota belum tersedia'} · Bergabung {formatDate(umkm.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={load}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
          <Button
            type="button"
            size="sm"
            variant={verified ? 'destructive' : 'default'}
            onClick={() => setConfirmOpen(true)}
          >
            {verified ? 'Batalkan Verifikasi' : 'Verifikasi UMKM'}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Toko</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Deskripsi" value={umkm.description?.trim() ? umkm.description : '-'} />
            <Field label="Alamat" value={umkm.address?.trim() ? umkm.address : '-'} />
            <Field label="Jam Operasional" value={umkm.open_hours?.trim() ? umkm.open_hours : '-'} />
            <Field
              label="Status Toko"
              value={umkm.is_open === null ? '-' : umkm.is_open ? 'Buka' : 'Tutup'}
            />
            <Field label="Slug" value={umkm.slug ?? '-'} />
            <Field label="Rating" value={umkm.rating !== null ? String(umkm.rating) : '-'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pemilik</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nama Pemilik (Toko)" value={umkm.owner_name?.trim() ? umkm.owner_name : '-'} />
            <Field label="Nama Akun" value={owner?.full_name?.trim() ? owner.full_name : '-'} />
            <Field label="Email" value={owner?.email ?? '-'} />
            <Field label="Role" value={owner?.role ?? '-'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Paket" value={subscription?.plan?.name ?? 'Belum ada'} />
            <Field label="Status" value={subscription?.status ?? '-'} />
            <Field label="Billing" value={subscription?.billing ?? '-'} />
            <Field label="Dibayar" value={formatPrice(subscription?.price_paid ?? null)} />
            <Field label="Periode Mulai" value={formatDate(subscription?.current_period_start ?? null)} />
            <Field label="Periode Berakhir" value={formatDate(subscription?.current_period_end ?? null)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Lainnya</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Partner Tier" value={umkm.partner_tier ?? '-'} />
            <Field label="Followers" value={umkm.followers !== null ? String(umkm.followers) : '-'} />
            <Field label="Member Sejak" value={umkm.member_since !== null ? String(umkm.member_since) : '-'} />
            <Field label="Waktu Respons" value={umkm.response_time ?? '-'} />
            <Field
              label="Porsi Terselamatkan"
              value={umkm.porsi_terselamatkan !== null ? String(umkm.porsi_terselamatkan) : '-'}
            />
            <Field
              label="CO2e Saved"
              value={umkm.co2e_saved_kg !== null ? `${umkm.co2e_saved_kg} kg` : '-'}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="text-base">
            Produk ({products.length}
            {products.length >= 15 ? '+' : ''})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <Store className="h-8 w-8 text-primary" />
              <p className="mt-3 text-sm text-sage-500">UMKM ini belum memiliki produk.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {products.map((p) => (
                <div
                  key={p.id ?? p.name}
                  className="flex items-start gap-3 rounded-xl border border-border/70 p-3"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-cream-100">
                    <SmartImage
                      src={p.image_url ?? ''}
                      alt={p.name}
                      sizes="56px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-charcoal-900">{p.name}</p>
                    <p className="mt-0.5 text-[12px] text-sage-500">
                      {p.verification_status ?? '-'} · Stok {p.stock ?? '-'} ·{' '}
                      {formatPrice(p.surplus_price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {verified ? 'Batalkan verifikasi UMKM ini?' : 'Verifikasi UMKM ini?'}
            </DialogTitle>
            <DialogDescription>
              {verified
                ? `“${umkm.business_name}” akan kembali berstatus Belum Terverifikasi. Perubahan ini hanya mengubah status verifikasi toko.`
                : `“${umkm.business_name}” akan berstatus Terverifikasi. Perubahan ini hanya mengubah status verifikasi toko.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={verifyBusy}
              onClick={() => setConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant={verified ? 'destructive' : 'default'}
              disabled={verifyBusy}
              onClick={handleToggle}
            >
              {verifyBusy ? 'Memproses…' : verified ? 'Batalkan Verifikasi' : 'Verifikasi UMKM'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
