'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Store } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { SmartImage } from '@/app/components/shared/SmartImage';
import {
  approveAdminProduct,
  fetchAdminProductDetail,
  rejectAdminProduct,
  type AdminProductDetailResult,
} from '@/lib/admin-product-moderation';
import { cn } from '@/lib/utils';
import { flagSuspiciousProduct } from '@/lib/product-suspicion';
import {
  formatRupiah,
  formatTanggalWaktu,
  labelAktivitas,
  labelStatusOperasional,
  labelVerifikasiProduk,
  prettifyKode,
  varianVerifikasiProduk,
} from './admin-format';
import { ADMIN_DETAIL_LABEL, AdminDetailField, AdminDetailGrid, AdminDetailSection } from './admin-detail';
import {
  AdminErrorState,
  AdminInlineError,
  AdminInlineLoading,
  AdminInlineMessage,
} from './admin-state';
import { ProductWarnModal } from './product-warn-modal';

function verificationBadge(status: string | null) {
  return (
    <Badge variant={varianVerifikasiProduk(status)}>{labelVerifikasiProduk(status)}</Badge>
  );
}

function statusBadge(status: string | null) {
  return <Badge variant="outline">{labelStatusOperasional(status)}</Badge>;
}

interface Props {
  productId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

export function ProductDetailDrawer({ productId, onClose, onChanged }: Props) {
  const [data, setData] = useState<AdminProductDetailResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [warnOpen, setWarnOpen] = useState(false);
  const [confirm, setConfirm] = useState<'reject' | 'approve' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!productId) {
      setData(null);
      setStatus('idle');
      return;
    }
    let mounted = true;
    setStatus('loading');
    setErrorMsg('');
    setConfirm(null);
    setReason('');
    setActionError('');
    fetchAdminProductDetail(productId)
      .then((res) => {
        if (mounted) {
          setData(res);
          setStatus('ready');
        }
      })
      .catch((err) => {
        if (mounted) {
          setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat detail produk.');
          setStatus('error');
        }
      });
    return () => {
      mounted = false;
    };
  }, [productId]);

  const reload = async () => {
    if (!productId) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetchAdminProductDetail(productId);
      setData(res);
      setStatus('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat detail produk.');
      setStatus('error');
    }
  };

  const doAction = async () => {
    if (!productId || !confirm || busy) return;
    if (confirm === 'reject' && !reason.trim()) {
      setActionError('Alasan wajib diisi untuk penolakan/penurunan produk.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      if (confirm === 'reject') await rejectAdminProduct(productId, reason.trim());
      else await approveAdminProduct(productId);
      setConfirm(null);
      setReason('');
      await reload();
      onChanged?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Tindakan gagal.');
    } finally {
      setBusy(false);
    }
  };

  const p = data?.product ?? null;
  const flags = p
    ? flagSuspiciousProduct({
        id: p.id,
        name: p.name,
        description: p.description,
        image_url: p.image_url,
        category: p.category,
        original_price: p.original_price,
        surplus_price: p.surplus_price,
        stock: p.stock,
        verification_status: p.verification_status,
        created_at: p.created_at,
        updated_at: null,
      })
    : [];

  return (
    <>
      <Dialog open={!!productId} onOpenChange={(open) => !open && onClose()}>
        {/* `dvh` (bukan `vh`): di browser seluler, `vh` mengukur viewport
            TERBESAR (saat address bar tersembunyi) sehingga dialog 90vh
            bisa lebih tinggi dari layar yang terlihat dan tombol aksi di
            bawah terpotong. `dvh` mengikuti tinggi yang benar-benar tampak. */}
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail produk</DialogTitle>
            <DialogDescription>
              Data langsung dari database beserta riwayat moderasi dan aktivitas.
            </DialogDescription>
          </DialogHeader>

          {status === 'loading' && <AdminInlineLoading label="Memuat detail produk" />}

          {status === 'error' && (
            <AdminErrorState
              title="Gagal memuat detail produk"
              message={errorMsg}
              onRetry={reload}
            />
          )}

          {status === 'ready' && p && (
            <div className="space-y-5">
              {/* Ringkasan: foto + identitas. Di HP foto TIDAK lagi memakan
                  tinggi 160px penuh selebar dialog — dipangkas ke 144px
                  (setengah lebar) supaya nama & harga langsung terlihat
                  tanpa menggulir. Di layar >= sm kembali berdampingan. */}
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <div
                  className={cn(
                    'relative h-36 w-full shrink-0 overflow-hidden rounded-[var(--radius)] bg-sage-100/60 sm:h-32 sm:w-32',
                    // Produk yang ditarik penjual tetap bisa dibuka admin; foto
                    // diredam agar statusnya terbaca sekilas tanpa menutupi isi.
                    p.deleted_at && 'bg-muted'
                  )}
                >
                  <SmartImage
                    src={p.image_url ?? ''}
                    alt={p.name}
                    sizes="(max-width: 640px) 100vw, 128px"
                    className={cn(p.deleted_at && 'grayscale opacity-60')}
                  />
                  {p.deleted_at && (
                    <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 bg-destructive px-1 py-1 text-center text-[10px] font-bold uppercase leading-tight tracking-[0.06em] text-white shadow-sm">
                      Sudah dihapus
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.deleted_at && <Badge variant="destructive">Dihapus penjual</Badge>}
                    {verificationBadge(p.verification_status)}
                    {statusBadge(p.status)}
                    {p.category && <Badge variant="outline">{p.category}</Badge>}
                  </div>
                  <h3 className="mt-2 break-words font-display text-lg font-semibold leading-snug text-charcoal-900 sm:text-xl">
                    {p.name}
                  </h3>
                  <p className="mt-1 line-clamp-3 break-words text-sm leading-relaxed text-charcoal-700">
                    {p.description?.trim() ? p.description : 'Deskripsi belum tersedia.'}
                  </p>
                </div>
              </div>

              {/* Empat metrik utama dalam satu baris kartu kecil.
                  Sebelumnya bagian dari blok teks di samping foto sehingga
                  harga tertimbun di bawah deskripsi. */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Harga normal', value: formatRupiah(p.original_price) },
                  { label: 'Harga surplus', value: formatRupiah(p.surplus_price), strong: true },
                  { label: 'Stok', value: p.stock ?? '-' },
                  { label: 'Rating', value: p.rating ?? '-' },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-[var(--radius)] bg-sage-100/40 px-3 py-2"
                  >
                    <p className={ADMIN_DETAIL_LABEL}>{m.label}</p>
                    <p
                      className={cn(
                        'mt-0.5 break-words text-sm tabular-nums',
                        m.strong ? 'font-bold text-primary' : 'font-semibold text-charcoal-900'
                      )}
                    >
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>

              {flags.length > 0 && (
                <Card className="border-warning/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      Rekomendasi pemeriksaan (aturan sederhana, bukan vonis)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    {flags.map((f) => (
                      <div key={f.code} className="rounded-[var(--radius)] bg-warning/10 px-3 py-2">
                        <p className="text-xs font-bold text-charcoal-900">{f.label}</p>
                        <p className="mt-0.5 text-xs text-charcoal-700">{f.detail}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <AdminDetailSection title="Info operasional & paket">
                <AdminDetailGrid>
                  <AdminDetailField label="Dibuat">
                    {formatTanggalWaktu(p.created_at)}
                  </AdminDetailField>
                  <AdminDetailField label="Berat">
                    {p.weight_gram != null ? `${p.weight_gram} g` : '-'}
                  </AdminDetailField>
                  <AdminDetailField label="Dimensi (P×L×T)">
                    {p.length_cm != null || p.width_cm != null || p.height_cm != null
                      ? `${p.length_cm ?? '-'}×${p.width_cm ?? '-'}×${p.height_cm ?? '-'} cm`
                      : '-'}
                  </AdminDetailField>
                  <AdminDetailField label="Diantar">
                    {p.is_delivery == null ? '-' : p.is_delivery ? 'Ya' : 'Tidak'}
                  </AdminDetailField>
                  <AdminDetailField label="Ambil sendiri">
                    {p.is_pickup == null ? '-' : p.is_pickup ? 'Ya' : 'Tidak'}
                  </AdminDetailField>
                </AdminDetailGrid>
              </AdminDetailSection>

              {p.deleted_at && (
                <div className="rounded-[var(--radius)] border border-destructive/25 bg-destructive/[0.06] px-3.5 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-destructive">
                    Produk sudah dihapus oleh penjual
                  </p>
                  <p className="mt-1 break-words text-sm leading-relaxed text-charcoal-900">
                    Dihapus: {formatTanggalWaktu(p.deleted_at)}
                  </p>
                  <p className="mt-1 text-xs text-sage-500">
                    Produk tidak lagi tayang di katalog dan tidak bisa dipesan. Barisnya sengaja
                    disimpan agar admin tetap dapat menelusuri produk yang dilaporkan atau
                    ditindak, beserta riwayat moderasinya.
                  </p>
                </div>
              )}

              {p.verification_status === 'rejected' && (
                <div className="rounded-[var(--radius)] border border-destructive/25 bg-destructive/[0.06] px-3.5 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-destructive">
                    Alasan penundaan / penurunan produk
                  </p>
                  <p className="mt-1 break-words text-sm leading-relaxed text-charcoal-900">
                    {p.rejection_reason ?? '-'}
                  </p>
                  <p className="mt-1 text-xs text-sage-500">
                    Ditinjau: {formatTanggalWaktu(p.reviewed_at)}
                  </p>
                </div>
              )}

              {data?.umkm && (
                <AdminDetailSection title="Toko">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-charcoal-900">
                        {data.umkm.business_name}
                      </p>
                      <p className="text-xs text-sage-500">
                        {data.umkm.city ?? 'Kota -'} ·{' '}
                        {data.umkm.is_verified ? 'Terverifikasi' : 'Belum terverifikasi'}
                      </p>
                    </div>
                    {data.umkm.id && (
                      <Button asChild type="button" variant="outline" size="sm">
                        <Link href={`/dashboard/admin/umkm/${data.umkm.id}`}>
                          <Store aria-hidden className="h-3.5 w-3.5" />
                          Buka toko
                        </Link>
                      </Button>
                    )}
                  </div>
                </AdminDetailSection>
              )}

              <AdminDetailSection
                title={`Riwayat moderasi (${data?.moderation.length ?? 0})`}
              >
                {!data?.moderation.length ? (
                  <AdminInlineMessage>Belum ada tindakan moderasi tercatat.</AdminInlineMessage>
                ) : (
                  <ul className="space-y-2">
                    {data.moderation.map((m) => (
                      <li
                        key={m.id ?? `${m.action}-${m.created_at}`}
                        className="rounded-[var(--radius)] bg-sage-100/40 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge variant={m.action === 'approve' ? 'success' : 'destructive'}>
                            {prettifyKode(m.action)}
                          </Badge>
                          <span className="text-xs text-sage-500">
                            {formatTanggalWaktu(m.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 break-words text-xs text-charcoal-700">
                          {m.moderator_name}
                          {m.reason ? ` · ${m.reason}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </AdminDetailSection>

              <AdminDetailSection title={`Aktivitas terkait (${data?.activity.length ?? 0})`}>
                {!data?.activity.length ? (
                  <AdminInlineMessage>
                    Belum ada activity log untuk produk ini (memerlukan migration activity
                    trigger).
                  </AdminInlineMessage>
                ) : (
                  <ul className="space-y-2">
                    {data.activity.map((a) => (
                      <li
                        key={a.id ?? `${a.activity_type}-${a.created_at}`}
                        className="rounded-[var(--radius)] bg-sage-100/40 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge variant="secondary">{labelAktivitas(a.activity_type)}</Badge>
                          <span className="text-xs text-sage-500">
                            {formatTanggalWaktu(a.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 break-words text-xs text-charcoal-700">
                          {a.description ?? '-'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </AdminDetailSection>

              {confirm && (
                <Card className="border-destructive/25">
                  <CardContent className="space-y-2 px-4 py-3">
                    <p className="text-sm font-bold text-charcoal-900">
                      {confirm === 'reject'
                        ? p.verification_status === 'approved'
                          ? 'Tunda penayangan produk yang sudah live ini?'
                          : 'Tolak produk ini?'
                        : 'Aktifkan kembali produk ini?'}
                    </p>
                    {confirm === 'reject' ? (
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Alasan wajib — akan diterima UMKM via notifikasi."
                        aria-label="Alasan penolakan produk"
                        rows={3}
                        className="w-full rounded-[var(--radius)] border border-border bg-white px-3 py-2 text-sm"
                      />
                    ) : (
                      <p className="text-xs text-sage-500">
                        Produk akan kembali aktif dan bisa dibeli. Tindakan ini tercatat di riwayat
                        moderasi.
                      </p>
                    )}
                    <AdminInlineError message={actionError} />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setConfirm(null)}>
                        Batal
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={confirm === 'reject' ? 'destructive' : 'default'}
                        disabled={busy}
                        onClick={doAction}
                      >
                        {busy
                          ? 'Memproses…'
                          : confirm === 'reject'
                            ? p.verification_status === 'approved'
                              ? 'Ya, tunda penayangan'
                              : 'Ya, tolak produk'
                            : 'Ya, aktifkan kembali'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!confirm && !p.deleted_at && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => p.id && setWarnOpen(true)}>
                    Beri peringatan
                  </Button>
                  {p.verification_status === 'rejected' ? (
                    <Button type="button" size="sm" onClick={() => setConfirm('approve')}>
                      Aktifkan kembali
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="destructive" onClick={() => setConfirm('reject')}>
                      {p.verification_status === 'approved'
                        ? 'Tunda penayangan'
                        : 'Tolak produk'}
                    </Button>
                  )}
                </div>
              )}
              {actionError && !confirm && <AdminInlineError message={actionError} />}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ProductWarnModal
        open={warnOpen}
        onOpenChange={setWarnOpen}
        productId={p?.id ?? null}
        productName={p?.name ?? 'Produk'}
        onSuccess={() => {
          reload();
          onChanged?.();
        }}
      />
    </>
  );
}
