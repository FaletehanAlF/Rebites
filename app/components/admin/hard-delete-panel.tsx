'use client';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/app/components/ui/dialog';
import { useAdminMe } from '@/hooks/use-admin-me';
import { AdminUsersApiError, fetchAdminHardDeletePreview, hardDeleteAdminUser, type AdminHardDeleteImpact, type AdminHardDeletePreview, } from '@/lib/admin-users';
const REASON_MAX = 500;
function ImpactRow({ label, value }: {
    label: string;
    value: number;
}) {
    return (<div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-sm text-charcoal-700">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-charcoal-900">{value}</span>
    </div>);
}
function ImpactList({ impact }: {
    impact: AdminHardDeleteImpact;
}) {
    return (<div className="rounded-[var(--radius)] border border-destructive/25 bg-destructive/[0.04] px-4 py-3">
      <div className="divide-y divide-destructive/15">
        <ImpactRow label="Pesanan sebagai pembeli" value={impact.ordersAsBuyer}/>
        <ImpactRow label="Pesanan di tokonya" value={impact.ordersInStore}/>
        <ImpactRow label="Produk tokonya" value={impact.products}/>
        <ImpactRow label="Ulasan yang ditulis" value={impact.reviews}/>
        <ImpactRow label="Baris transaksi koin" value={impact.coinTransactions}/>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-destructive">
        Angka di atas ikut terhapus permanen dan tidak dapat dikembalikan.
      </p>
    </div>);
}
export function HardDeletePanel({ userId, name, targetProtected = false, onDeleted, }: {
    userId: string | null;
    name: string;
    targetProtected?: boolean;
    onDeleted: () => void;
}) {
    const { loading: accessLoading, me, status: accessStatus, errorMessage: accessError, retry: retryAccess, } = useAdminMe();
    const [preview, setPreview] = useState<AdminHardDeletePreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [password, setPassword] = useState('');
    const [reason, setReason] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<{
        kind: 'error' | 'success';
        text: string;
    } | null>(null);
    const accessFailed = accessStatus === 'error';
    const allowed = !accessLoading && !accessFailed && me?.isSuperAdmin === true;
    const loadPreview = useCallback(async () => {
        if (!userId)
            return;
        setPreviewLoading(true);
        setPreviewError('');
        try {
            setPreview(await fetchAdminHardDeletePreview(userId));
        }
        catch (err) {
            setPreview(null);
            setPreviewError(err instanceof Error ? err.message : 'Gagal memuat dampak penghapusan.');
        }
        finally {
            setPreviewLoading(false);
        }
    }, [userId]);
    useEffect(() => {
        if (!allowed || !userId)
            return;
        void loadPreview();
    }, [allowed, userId, loadPreview]);
    const blocked = preview ? !preview.precondition.allowed : false;
    const configured = preview?.configured !== false;
    const canSubmit = allowed &&
        preview !== null &&
        configured &&
        !blocked &&
        !busy &&
        password.trim().length > 0 &&
        reason.trim().length > 0;
    const handleSubmit = async () => {
        if (!userId || busy)
            return;
        if (!password.trim()) {
            setFeedback({ kind: 'error', text: 'Sandi konfirmasi wajib diisi.' });
            return;
        }
        if (!reason.trim()) {
            setFeedback({ kind: 'error', text: 'Alasan penghapusan permanen wajib diisi.' });
            return;
        }
        if (!confirming) {
            setConfirming(true);
            setFeedback(null);
            return;
        }
        setBusy(true);
        setFeedback(null);
        try {
            const result = await hardDeleteAdminUser(userId, password.trim(), reason.trim());
            setConfirming(false);
            setPassword('');
            setReason('');
            if (!result.auditRecorded) {
                setFeedback({
                    kind: 'error',
                    text: 'Akun terhapus, tetapi jejak auditnya gagal dicatat. Laporkan ke tim teknis.',
                });
            }
            else {
                setFeedback({
                    kind: 'success',
                    text: 'Akun dihapus permanen beserta data terkaitnya.',
                });
            }
            onDeleted();
        }
        catch (err) {
            setConfirming(false);
            const message = err instanceof AdminUsersApiError
                ? err.message
                : err instanceof Error
                    ? err.message
                    : 'Gagal menghapus akun secara permanen.';
            setFeedback({ kind: 'error', text: message });
            void loadPreview();
        }
        finally {
            setBusy(false);
        }
    };
    const feedbackBlock = feedback ? (<p role={feedback.kind === 'error' ? 'alert' : 'status'} className={feedback.kind === 'error'
            ? 'rounded-[var(--radius)] border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive'
            : 'rounded-[var(--radius)] border border-success/25 bg-success/5 px-4 py-3 text-sm font-medium text-success'}>
      {feedback.text}
    </p>) : null;
    return (<Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <ShieldAlert aria-hidden className="h-4 w-4 text-destructive"/>
            Hapus permanen akun
          </span>
          <Badge variant="destructive">Tidak dapat dibatalkan</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm leading-relaxed text-sage-500">
          Menghapus permanen menghilangkan akun beserta pesanan, produk, ulasan, dan koin yang
          terkait — semuanya tidak dapat dikembalikan. Untuk penonaktifan yang masih bisa
          dipulihkan, gunakan panel hapus di atas.
        </p>

        {targetProtected ? (<p className="rounded-[var(--radius)] border border-border bg-cream-50 px-4 py-3 text-sm font-medium text-charcoal-700">
            Akun ini adalah Super Admin. Akun Super Admin dilindungi dan tidak dapat dihapus.
          </p>) : userId === null ? (<p className="rounded-[var(--radius)] border border-border bg-cream-50 px-4 py-3 text-sm font-medium text-charcoal-700">
            ID pengguna tidak tersedia, tindakan ini dinonaktifkan.
          </p>) : accessLoading ? (<p className="rounded-[var(--radius)] bg-cream-50 px-4 py-3 text-sm text-sage-500">
            Memeriksa izin…
          </p>) : accessFailed ? (<div role="alert" className="flex flex-wrap items-center gap-4 rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-medium text-charcoal-700">
            <span className="min-w-0 flex-1">
              {accessError} Status Super Admin belum dapat dipastikan, jadi kontrol penghapusan
              permanen disembunyikan.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={retryAccess}>
              <RefreshCw aria-hidden className="h-3.5 w-3.5"/>
              Coba lagi
            </Button>
          </div>) : !allowed ? (<p className="rounded-[var(--radius)] border border-border bg-cream-50 px-4 py-3 text-sm font-medium text-charcoal-700">
            Hapus permanen hanya dapat dilakukan Super Admin.
          </p>) : previewLoading ? (<p className="rounded-[var(--radius)] bg-cream-50 px-4 py-3 text-sm text-sage-500">
            Menghitung dampak penghapusan…
          </p>) : previewError ? (<div role="alert" className="flex flex-wrap items-center gap-4 rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-medium text-charcoal-700">
            <span className="min-w-0 flex-1">{previewError}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadPreview()}>
              <RefreshCw aria-hidden className="h-3.5 w-3.5"/>
              Coba lagi
            </Button>
          </div>) : preview ? (<>
            {!configured ? (<p role="alert" className="rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-medium text-charcoal-700">
                Fitur hapus permanen belum diaktifkan: variabel{' '}
                <code className="font-semibold">PASSWORD_DELETE_USER</code> belum diisi di
                server.
              </p>) : null}

            {blocked && !preview.precondition.allowed ? (<p role="alert" className="flex items-start gap-2 rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-medium text-charcoal-700">
                <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong"/>
                {preview.precondition.message}
              </p>) : null}

            <ImpactList impact={preview.impact}/>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="hard-delete-password" className="text-sm font-medium text-charcoal-900">
                  Sandi konfirmasi (wajib)
                </label>
                <Input id="hard-delete-password" type="password" autoComplete="off" value={password} disabled={!canSubmit && busy} onChange={(event) => setPassword(event.target.value)} placeholder="Sandi dari PASSWORD_DELETE_USER"/>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="hard-delete-reason" className="text-sm font-medium text-charcoal-900">
                  Alasan (wajib, tercatat di audit)
                </label>
                <textarea id="hard-delete-reason" value={reason} onChange={(event) => setReason(event.target.value.slice(0, REASON_MAX))} rows={2} maxLength={REASON_MAX} placeholder="Mis. permintaan penghapusan data oleh pemilik akun." className="w-full rounded-[var(--radius)] border border-border bg-white px-3 py-2 text-sm leading-relaxed text-charcoal-900 placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"/>
              </div>
            </div>

            {feedbackBlock}

            <div>
              <Button type="button" variant="destructive" disabled={!canSubmit} onClick={() => void handleSubmit()}>
                {busy ? (<Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none"/>) : (<Trash2 aria-hidden className="h-4 w-4"/>)}
                {busy ? 'Menghapus…' : 'Hapus permanen akun ini'}
              </Button>
              {!canSubmit && !busy ? (<p className="mt-2 text-xs font-medium text-warning-strong">
                  Isi sandi dan alasan dulu untuk mengaktifkan tombol ini.
                </p>) : null}
            </div>
          </>) : null}
      </CardContent>

      <Dialog open={confirming} onOpenChange={(open) => {
            if (!open && !busy) {
                setConfirming(false);
                setFeedback(null);
            }
        }}>
        <DialogContent className="overflow-hidden sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Hapus permanen “{name}”?</DialogTitle>
            <DialogDescription>
              Akun beserta pesanan, produk, ulasan, dan koinnya akan hilang dari database. Tindakan
              ini <strong className="font-semibold">tidak dapat dibatalkan</strong> — tidak ada
              pemulihan seperti pada hapus biasa.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 shrink-0 gap-2 border-t border-border/60 pt-4 sm:space-x-0">
            <Button type="button" variant="outline" disabled={busy} onClick={() => {
            setConfirming(false);
            setFeedback(null);
        }}>
              <Undo2 aria-hidden className="h-3.5 w-3.5"/>
              Batal
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void handleSubmit()}>
              {busy ? 'Menghapus…' : 'Ya, hapus permanen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>);
}
