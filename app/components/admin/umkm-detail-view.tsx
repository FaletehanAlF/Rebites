'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Power, RefreshCw, Store } from 'lucide-react';
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
import { SmartImage } from '@/app/components/shared/SmartImage';
import { toast } from '@/hooks/use-toast';
import {
  AdminUmkmApiError,
  fetchAdminUmkmDetail,
  setUmkmActive,
  toggleUmkmVerification,
  type AdminUmkmDetailResult,
} from '@/lib/admin-umkm';
import { flagSuspiciousProduct } from '@/lib/product-suspicion';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER } from './admin-page-header';
import {
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-state';
import { AdminDetailField, AdminDetailGrid, AdminDetailSection } from './admin-detail';
import { formatRupiah, formatTanggal, formatTanggalWaktu } from './admin-format';
import { ProductDetailDrawer } from './product-detail-drawer';
import { ModerationHistory } from './moderation-history';

import { redirectIfSessionExpired } from './admin-session';



/** Nilai kosong ditampilkan sebagai tanda hubung yang konsisten. */
function nilai(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const text = String(value).trim();
  return text ? text : '—';
}


export function UmkmDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<AdminUmkmDetailResult | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  // Nonaktifkan toko adalah keputusan admin yang berbeda dari verifikasi:
  // toko nonaktif hilang dari katalog dan penjual tidak bisa membatalkannya.
  const [activeConfirmOpen, setActiveConfirmOpen] = useState(false);
  const [activeBusy, setActiveBusy] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  // Muat ulang (mis. setelah verifikasi) dapat berjalan tumpang tindih dengan
  // pemuatan sebelumnya; hanya respons terbaru yang boleh menulis state.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus('loading');
    setErrorMsg('');
    try {
      const result = await fetchAdminUmkmDetail(id);
      if (requestId !== requestIdRef.current) return;
      setData(result);
      setStatus('ready');
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (await redirectIfSessionExpired((err as { status?: number })?.status ?? 0, router, () => {
          setErrorMsg('Tidak dapat menghubungi server data. Coba lagi.');
          setStatus('error');
        })) return;
      // Refresh berhasil: request ini tetap gagal, jadi tampilkan error +
      // tombol coba lagi — jangan biarkan status 'loading' menggantung.
      if (requestId !== requestIdRef.current) return;
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

  const handleToggleActive = async () => {
    if (activeBusy || !data) return;
    const nextActive = !data.umkm.is_active;
    setActiveBusy(true);
    try {
      const result = await setUmkmActive(id, nextActive);
      setData((prev) =>
        prev ? { ...prev, umkm: { ...prev.umkm, is_active: result.is_active } } : prev
      );
      setActiveConfirmOpen(false);
      toast({
        title: result.is_active ? 'Toko diaktifkan' : 'Toko dinonaktifkan',
        description: result.is_active
          ? 'Toko kembali tampil di katalog dan dapat menerima pesanan.'
          : 'Toko dan produknya tidak lagi tampil di katalog pembeli.',
      });
    } catch (err) {
      toast({
        title: 'Gagal mengubah status toko',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setActiveBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className={ADMIN_PAGE_WRAPPER}>
        <AdminLoadingState label="Memuat detail UMKM" />
      </div>
    );
  }

  if (status === 'forbidden') {
    return (
      <div className={ADMIN_PAGE_WRAPPER}>
        <AdminForbiddenState message="Halaman ini hanya untuk admin." />
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className={ADMIN_PAGE_WRAPPER}>
        <AdminErrorState
          title="Gagal memuat detail"
          message={errorMsg}
          onRetry={() => {
            void load();
          }}
        />
      </div>
    );
  }

  const { umkm, owner, subscription, products, product_total } = data;
  const verified = umkm.is_verified;
  // `products` adalah ringkasan terbatas (PRODUCT_SUMMARY_LIMIT = 15 di route).
  // `product_total` saat ini = panjang array tersebut, jadi label tidak boleh
  // mengklaim jumlah total toko — cukup sebut batas ringkasan.
  const productLimitReached = products.length >= 15;
  const totalProduk = product_total ?? products.length;

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      {/* Toaster sengaja TIDAK dipasang di sini: AdminShell sudah memasang
          satu untuk seluruh panel (sebelumnya tidak ada sama sekali,
          sehingga toast() tidak pernah tampil). Dua viewport sekaligus
          akan menampilkan toast yang sama dua kali. */}
      <AdminPageHeader
        eyebrow="Admin · Detail UMKM"
        title={umkm.business_name}
        description={`${umkm.city ?? 'Kota belum tersedia'} · Bergabung ${formatTanggal(umkm.created_at)}`}
        backHref="/dashboard/admin/umkm"
        backLabel="Daftar UMKM"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void load();
              }}
            >
              <RefreshCw aria-hidden className="h-3.5 w-3.5" />
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
            <Button
              type="button"
              size="sm"
              variant={umkm.is_active ? 'outline' : 'default'}
              onClick={() => setActiveConfirmOpen(true)}
            >
              <Power aria-hidden className="h-3.5 w-3.5" />
              {umkm.is_active ? 'Nonaktifkan Toko' : 'Aktifkan Toko'}
            </Button>
          </>
        }
      />

      {/* Identitas toko: logo, status, deskripsi singkat. Tombol aksi pindah
          ke header halaman agar sejajar dengan nama toko di pojok kanan. */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius)] bg-sage-100">
              <SmartImage src={umkm.logo_url ?? ''} alt={umkm.business_name} sizes="64px" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={verified ? 'success' : 'secondary'}>
                  {verified ? <BadgeCheck aria-hidden className="h-3 w-3" /> : null}
                  {verified ? 'Terverifikasi' : 'Belum Terverifikasi'}
                </Badge>
                {!umkm.is_active && (
                  <Badge variant="destructive">
                    <Power aria-hidden className="h-3 w-3" />
                    Nonaktif (admin)
                  </Badge>
                )}
                {umkm.category && <Badge variant="secondary">{umkm.category}</Badge>}
                <Badge variant={umkm.is_open === true ? 'success' : 'secondary'}>
                  {umkm.is_open === null ? 'Status buka tidak diketahui' : umkm.is_open ? 'Buka' : 'Tutup'}
                </Badge>
              </div>
              {/* Tagline saja. Deskripsi penuh punya kartunya sendiri di bawah;
                  menampilkannya juga di sini hanya mengulang teks yang sama. */}
              {umkm.tagline?.trim() ? (
                <p className="mt-2 line-clamp-2 break-words text-sm leading-relaxed text-charcoal-700">
                  {umkm.tagline}
                </p>
              ) : null}
              <p className="mt-1.5 truncate text-xs leading-relaxed text-sage-500">
                {owner?.full_name?.trim() || owner?.email || 'Pemilik tidak tersedia'}
                {umkm.slug ? ` · ${umkm.slug}` : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deskripsi toko dipisah ke kartu selebar konten. Di dalam kartu
          identitas (kolom sempit di samping logo) teks panjang terlipat jadi
          belasan baris pendek yang sulit dipindai — terutama untuk toko
          dengan deskripsi panjang. Lebar penuh memberi panjang baris yang
          nyaman dibaca dan tinggi yang wajar. */}
      {umkm.description?.trim() ? (
        <Card className="mb-6">
          <CardContent className="p-5">
            <AdminDetailSection title="Deskripsi toko">
              {/* Dipecah per paragraf (baris kosong) agar teks panjang bisa
                  dipindai. `max-w-prose` membatasi panjang baris supaya mata
                  tidak kehilangan tempat saat kembali ke baris berikutnya. */}
              <div className="max-w-prose space-y-3">
                {umkm.description
                  .split(/\n{2,}/)
                  .map((paragraf) => paragraf.trim())
                  .filter(Boolean)
                  .map((paragraf, index) => (
                    <p
                      key={`desc-${index}`}
                      className="whitespace-pre-wrap break-words text-sm leading-relaxed text-charcoal-700"
                    >
                      {paragraf}
                    </p>
                  ))}
              </div>
            </AdminDetailSection>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <AdminDetailSection title="Informasi Toko">
              <AdminDetailGrid>
                {/* Alamat memakan lebar penuh: alamat toko hampir selalu
                    lebih panjang dari satu kolom sehingga sebelumnya
                    terlipat jadi 4-5 baris sempit di samping "Kota". */}
                <AdminDetailField label="Alamat" className="sm:col-span-2">
                  {nilai(umkm.address)}
                </AdminDetailField>
                <AdminDetailField label="Kota">{nilai(umkm.city)}</AdminDetailField>
                <AdminDetailField label="Kode pos">
                  {nilai(umkm.postal_code)}
                </AdminDetailField>
                <AdminDetailField label="Jam operasional">
                  {nilai(umkm.open_hours)}
                </AdminDetailField>
                <AdminDetailField label="Telepon">{nilai(umkm.phone)}</AdminDetailField>
                <AdminDetailField label="Rating">
                  {umkm.rating !== null ? String(umkm.rating) : '—'}
                </AdminDetailField>
                <AdminDetailField label="Bergabung">
                  {formatTanggal(umkm.created_at)}
                </AdminDetailField>
              </AdminDetailGrid>
            </AdminDetailSection>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <AdminDetailSection
              title="Pemilik"
              description="Akun yang memiliki toko ini (relasi 1:1)."
            >
              <AdminDetailGrid>
                <AdminDetailField label="Nama pemilik (toko)">
                  {nilai(umkm.owner_name)}
                </AdminDetailField>
                <AdminDetailField label="Nama akun">{nilai(owner?.full_name)}</AdminDetailField>
                <AdminDetailField label="Email">{nilai(owner?.email)}</AdminDetailField>
                <AdminDetailField label="Peran">{nilai(owner?.role)}</AdminDetailField>
              </AdminDetailGrid>
            </AdminDetailSection>

            <AdminDetailSection
              title="Subscription"
              description="Paket langganan toko saat ini."
              className="mt-5"
            >
              <AdminDetailGrid>
                <AdminDetailField label="Paket">
                  {subscription?.plan?.name ?? 'Belum ada'}
                </AdminDetailField>
                <AdminDetailField label="Status">{nilai(subscription?.status)}</AdminDetailField>
                <AdminDetailField label="Billing">{nilai(subscription?.billing)}</AdminDetailField>
                <AdminDetailField label="Dibayar">
                  {formatRupiah(subscription?.price_paid ?? null)}
                </AdminDetailField>
                <AdminDetailField label="Periode mulai">
                  {formatTanggalWaktu(subscription?.current_period_start ?? null)}
                </AdminDetailField>
                <AdminDetailField label="Periode berakhir">
                  {formatTanggalWaktu(subscription?.current_period_end ?? null)}
                </AdminDetailField>
              </AdminDetailGrid>
            </AdminDetailSection>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="p-5">
          <AdminDetailSection
            title="Statistik & metadata toko"
            description="Angka yang dilaporkan oleh profil toko."
          >
            <AdminDetailGrid columns={3}>
              <AdminDetailField label="Partner tier">{nilai(umkm.partner_tier)}</AdminDetailField>
              <AdminDetailField label="Followers">
                {umkm.followers !== null ? String(umkm.followers) : '—'}
              </AdminDetailField>
              <AdminDetailField label="Member sejak">
                {umkm.member_since !== null ? String(umkm.member_since) : '—'}
              </AdminDetailField>
              <AdminDetailField label="Waktu respons">{nilai(umkm.response_time)}</AdminDetailField>
              <AdminDetailField label="Porsi terselamatkan">
                {umkm.porsi_terselamatkan !== null ? String(umkm.porsi_terselamatkan) : '—'}
              </AdminDetailField>
              <AdminDetailField label="Penghematan CO2e">
                {umkm.co2e_saved_kg !== null ? `${umkm.co2e_saved_kg} kg` : '—'}
              </AdminDetailField>
            </AdminDetailGrid>
          </AdminDetailSection>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-5">
          <AdminDetailSection
            title={`Produk${totalProduk > 0 ? ` (${totalProduk}${productLimitReached ? '+' : ''})` : ''}`}
            description={
              productLimitReached
                ? 'Menampilkan maksimal 15 produk terbaru dari server.'
                : undefined
            }
          >
            {products.length === 0 ? (
              <p className="rounded-[var(--radius)] border border-dashed border-border bg-sage-100/20 px-4 py-10 text-center text-sm text-sage-500">
                UMKM ini belum memiliki produk.
              </p>
            ) : (
              <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
                {products.map((p) => {
                  const flags = flagSuspiciousProduct({
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
                    updated_at: p.updated_at,
                  });
                  return (
                    <div
                      key={p.id ?? p.name}
                      className="flex items-start gap-3 rounded-[var(--radius)] border border-border/70 bg-white p-4"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius)] bg-sage-100">
                        <SmartImage src={p.image_url ?? ''} alt={p.name} sizes="56px" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={
                              p.verification_status === 'approved'
                                ? 'success'
                                : p.verification_status === 'rejected'
                                  ? 'destructive'
                                  : 'warning'
                            }
                          >
                            {p.verification_status === 'approved'
                              ? 'Disetujui'
                              : p.verification_status === 'rejected'
                                ? 'Ditolak'
                                : p.verification_status === 'pending'
                                  ? 'Menunggu'
                                  : (p.verification_status ?? '—')}
                          </Badge>
                          {p.status && (
                            <Badge variant="secondary">
                              {p.status === 'available'
                                ? 'Tersedia'
                                : p.status === 'sold_out'
                                  ? 'Stok habis'
                                  : p.status}
                            </Badge>
                          )}
                          {flags.length > 0 && (
                            <Badge variant="warning">Perlu tinjau ({flags.length})</Badge>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-sm font-semibold text-charcoal-900" title={p.name}>
                          {p.name}
                        </p>
                        <p className="mt-0.5 text-xs text-sage-500">
                          {nilai(p.category)} · Stok {p.stock ?? '—'} ·{' '}
                          {formatRupiah(p.surplus_price)}
                        </p>
                        <p className="mt-0.5 text-xs text-sage-500">
                          Dibuat {formatTanggal(p.created_at)}
                          {p.weight_gram != null ? ` · ${p.weight_gram} g` : ''}
                        </p>
                        {p.verification_status === 'rejected' && p.rejection_reason && (
                          <p className="mt-1 line-clamp-2 break-words text-xs text-destructive">
                            Alasan: {p.rejection_reason}
                          </p>
                        )}
                        {p.id && (
                          <button
                            type="button"
                            onClick={() => setSelectedProductId(p.id)}
                            className="mt-2 inline-flex min-h-[36px] items-center rounded-[var(--radius)] text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                          >
                            Buka detail &amp; moderasi
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AdminDetailSection>
        </CardContent>
      </Card>

      <div className="mt-6">
        <ModerationHistory
          userId={owner?.id ?? null}
          title="Riwayat Moderasi Pemilik"
          description="Tindakan admin tercatat pada akun pemilik toko (relasi pemilik–toko 1:1). Server belum menyediakan audit khusus tingkat toko, sehingga riwayat ini bukan riwayat hukuman toko."
          emptyMessage={
            owner
              ? 'Belum ada tindakan moderasi yang tercatat untuk akun pemilik toko ini.'
              : 'Relasi pemilik toko tidak tersedia, riwayat tidak dapat dimuat.'
          }
        />
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="overflow-hidden sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {verified ? 'Batalkan verifikasi UMKM ini?' : 'Verifikasi UMKM ini?'}
            </DialogTitle>
            <DialogDescription>
              {verified
                ? `“${umkm.business_name}” akan kembali berstatus Belum Terverifikasi. Perubahan ini hanya mengubah status verifikasi toko.`
                : `“${umkm.business_name}” akan berstatus Terverifikasi. Perubahan ini hanya mengubah status verifikasi toko.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 shrink-0 gap-2 border-t border-border/60 pt-4 sm:space-x-0">
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

      <Dialog open={activeConfirmOpen} onOpenChange={setActiveConfirmOpen}>
        <DialogContent className="overflow-hidden sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {umkm.is_active ? 'Nonaktifkan toko ini?' : 'Aktifkan kembali toko ini?'}
            </DialogTitle>
            <DialogDescription>
              {umkm.is_active
                ? `“${umkm.business_name}” akan disembunyikan dari katalog pembeli beserta seluruh produknya, dan checkout ke toko ini ditolak. Penjual tidak dapat mengaktifkannya kembali sendiri.`
                : `“${umkm.business_name}” akan tampil kembali di katalog dan dapat menerima pesanan seperti biasa.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 shrink-0 gap-2 border-t border-border/60 pt-4 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              disabled={activeBusy}
              onClick={() => setActiveConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant={umkm.is_active ? 'destructive' : 'default'}
              disabled={activeBusy}
              onClick={handleToggleActive}
            >
              {activeBusy
                ? 'Memproses…'
                : umkm.is_active
                  ? 'Ya, nonaktifkan toko'
                  : 'Ya, aktifkan toko'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductDetailDrawer
        productId={selectedProductId}
        onClose={() => setSelectedProductId(null)}
        onChanged={load}
      />
    </div>
  );
}
