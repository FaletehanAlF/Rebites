'use client';
import { useState } from 'react';
import { Loader2, RefreshCw, ShieldAlert, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/app/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAdminMe } from '@/hooks/use-admin-me';
import { formatTanggalWaktu } from './admin-format';
const REASON_MAX = 500;
type SoftDeleteKind = 'user' | 'store' | 'product';
interface SoftDeleteCopy {
    noun: string;
    deskripsiHapus: string;
    deskripsiTerhapus: string;
    dialogHapus: string;
    dialogPulih: string;
    placeholderAlasan: string;
    suksesHapus: string;
    suksesPulih: string;
    dilindungi: string | null;
}
const COPY: Record<SoftDeleteKind, SoftDeleteCopy> = {
    user: {
        noun: 'akun',
        deskripsiHapus: 'Menghapus akun tidak menghapus datanya: akun hanya ditandai terhapus sehingga tidak dapat login, lalu dapat dipulihkan kapan saja. Toko miliknya (bila ada) ikut dinonaktifkan agar tidak menerima pesanan baru.',
        deskripsiTerhapus: 'Akun ini tidak dapat login dan disembunyikan dari daftar pengguna. Seluruh datanya — pesanan, ulasan, jejak moderasi — masih utuh. Toko miliknya tetap nonaktif sampai diaktifkan kembali dari halaman UMKM.',
        dialogHapus: 'Akun tidak dapat login, tetapi datanya tetap tersimpan dan dapat dipulihkan. Toko miliknya ikut dinonaktifkan.',
        dialogPulih: 'Akun dapat login kembali dan tampil lagi di daftar pengguna.',
        placeholderAlasan: 'Mis. akun terbukti melakukan penipuan berulang.',
        suksesHapus: 'Akun dihapus. Datanya tetap utuh dan dapat dipulihkan kapan saja.',
        suksesPulih: 'Akun dipulihkan dan dapat login kembali.',
        dilindungi: 'Akun ini adalah Super Admin. Akun Super Admin dilindungi dan tidak dapat dihapus.',
    },
    store: {
        noun: 'toko',
        deskripsiHapus: 'Menghapus toko menyembunyikannya dari katalog tanpa menghapus data apa pun, dan dapat dipulihkan kapan saja.',
        deskripsiTerhapus: 'Toko ini disembunyikan dari katalog dan tidak dapat menerima pesanan baru. Produk, pesanan, dan riwayatnya masih utuh.',
        dialogHapus: 'Toko disembunyikan dari katalog dan tidak menerima pesanan baru; datanya tetap tersimpan dan dapat dipulihkan.',
        dialogPulih: 'Toko kembali tampil di katalog dan dapat menerima pesanan seperti biasa.',
        placeholderAlasan: 'Mis. toko terbukti menjual produk tidak halal berulang kali.',
        suksesHapus: 'Toko dihapus. Datanya tetap utuh dan dapat dipulihkan kapan saja.',
        suksesPulih: 'Toko dipulihkan dan kembali tampil di katalog.',
        dilindungi: 'Toko ini milik akun Super Admin. Toko tersebut dilindungi dan tidak dapat dihapus.',
    },
    product: {
        noun: 'produk',
        deskripsiHapus: 'Menghapus produk menyembunyikannya dari katalog pembeli dan dari menu penjual tanpa menghapus data apa pun — foto, harga, dan riwayat moderasi tetap utuh — dan dapat dipulihkan kapan saja.',
        deskripsiTerhapus: 'Produk ini disembunyikan dari katalog pembeli dan tidak dapat dipesan. Barisnya beserta riwayat moderasinya masih utuh.',
        dialogHapus: 'Produk disembunyikan dari katalog dan menu penjual; datanya tetap tersimpan dan dapat dipulihkan.',
        dialogPulih: 'Produk kembali seperti semula dan tayang lagi bila statusnya masih Aktif.',
        placeholderAlasan: 'Mis. produk terbukti menjual makanan tidak layak konsumsi.',
        suksesHapus: 'Produk dihapus. Datanya tetap utuh dan dapat dipulihkan kapan saja.',
        suksesPulih: 'Produk dipulihkan. Bila statusnya masih Aktif, produk kembali tayang di katalog.',
        dilindungi: null,
    },
};
export function SoftDeletePanel({ kind, targetId, name, deletedAt, deletionReason, targetProtected = false, restoreNote = null, variant = 'card', onDelete, onRestore, onChanged, }: {
    kind: SoftDeleteKind;
    targetId: string | null;
    name: string;
    deletedAt: string | null;
    deletionReason?: string | null;
    targetProtected?: boolean;
    restoreNote?: string | null;
    variant?: 'card' | 'inline';
    onDelete: (reason: string) => Promise<void>;
    onRestore: () => Promise<void>;
    onChanged: () => void;
}) {
    const { loading: accessLoading, me, status: accessStatus, errorMessage: accessError, retry: retryAccess, } = useAdminMe();
    const [confirming, setConfirming] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<{
        kind: 'error' | 'success';
        text: string;
    } | null>(null);
    const copy = COPY[kind];
    const noun = copy.noun;
    const deleted = Boolean(deletedAt && String(deletedAt).trim());
    const accessFailed = accessStatus === 'error';
    let restrictedNote: string | null = null;
    let allowed = false;
    if (!accessLoading) {
        if (targetProtected && copy.dilindungi) {
            restrictedNote = copy.dilindungi;
        }
        else if (accessFailed) {
            restrictedNote = null;
        }
        else if (!me) {
            restrictedNote = 'Hapus dan pemulihan hanya dapat dilakukan admin.';
        }
        else if (me.isSuperAdmin) {
            allowed = true;
        }
        else if (me.superAdminConfigured === false) {
            restrictedNote =
                'Fitur ini belum aktif: Super Admin belum dikonfigurasi (SUPER_ADMIN_USER_ID) di server.';
        }
        else {
            restrictedNote = `Hapus dan pemulihan ${noun} hanya dapat dilakukan Super Admin.`;
        }
    }
    const handleDelete = async () => {
        if (busy || !targetId)
            return;
        if (!confirming) {
            setConfirming(true);
            setFeedback(null);
            return;
        }
        const trimmed = reason.trim();
        if (!trimmed) {
            setFeedback({ kind: 'error', text: 'Alasan penghapusan wajib diisi.' });
            return;
        }
        setBusy(true);
        setFeedback(null);
        try {
            await onDelete(trimmed);
            setConfirming(false);
            setReason('');
            if (variant === 'inline') {
                toast({ title: 'Selesai', description: copy.suksesHapus });
            }
            else {
                setFeedback({ kind: 'success', text: copy.suksesHapus });
            }
            onChanged();
        }
        catch (err) {
            setFeedback({
                kind: 'error',
                text: err instanceof Error ? err.message : `Gagal menghapus ${noun}.`,
            });
        }
        finally {
            setBusy(false);
        }
    };
    const handleRestore = async () => {
        if (busy || !targetId)
            return;
        if (!confirming) {
            setConfirming(true);
            return;
        }
        setBusy(true);
        setFeedback(null);
        try {
            await onRestore();
            setConfirming(false);
            if (variant === 'inline') {
                toast({ title: 'Selesai', description: copy.suksesPulih });
            }
            else {
                setFeedback({ kind: 'success', text: copy.suksesPulih });
            }
            onChanged();
        }
        catch (err) {
            setFeedback({
                kind: 'error',
                text: err instanceof Error ? err.message : `Gagal memulihkan ${noun}.`,
            });
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
    const alasanField = (<div>
      <label htmlFor={`soft-delete-reason-${kind}`} className="block text-sm font-medium text-charcoal-900">
        Alasan penghapusan (wajib, tercatat di audit)
      </label>
      <textarea id={`soft-delete-reason-${kind}`} value={reason} autoFocus onChange={(event) => setReason(event.target.value.slice(0, REASON_MAX))} rows={3} maxLength={REASON_MAX} placeholder={copy.placeholderAlasan} className="mt-1.5 w-full rounded-[var(--radius)] border border-border bg-white px-3 py-2 text-sm leading-relaxed text-charcoal-900 placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"/>
      <p className="mt-1 text-xs text-sage-500">
        {reason.trim().length}/{REASON_MAX} karakter
      </p>
    </div>);
    if (variant === 'inline') {
        if (!allowed && !accessLoading)
            return null;
        const label = deleted ? `Pulihkan ${noun}` : `Hapus ${noun}`;
        const pemulihanTerkunci = deleted && restoreNote !== null;
        const penjelasan = targetId === null
            ? `ID ${noun} tidak tersedia.`
            : !allowed
                ? accessFailed
                    ? accessError ?? 'Status Super Admin belum dapat dipastikan.'
                    : 'Sedang memeriksa izin…'
                : pemulihanTerkunci
                    ? restoreNote
                    : null;
        return (<>
        <Button type="button" size="sm" variant={deleted ? 'default' : 'destructive'} disabled={targetId === null || !allowed || busy || pemulihanTerkunci} title={penjelasan ?? undefined} aria-label={penjelasan ? `${label} — ${penjelasan}` : label} onClick={() => void (deleted ? handleRestore() : handleDelete())}>
          {busy ? (<Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none"/>) : deleted ? (<Undo2 aria-hidden className="h-3.5 w-3.5"/>) : (<Trash2 aria-hidden className="h-3.5 w-3.5"/>)}
          {busy ? 'Memproses…' : label}
        </Button>

        <Dialog open={confirming} onOpenChange={(open) => {
                if (!open) {
                    setConfirming(false);
                    setFeedback(null);
                }
            }}>
          <DialogContent className="overflow-hidden sm:max-w-md">
            <DialogHeader className="shrink-0">
              <DialogTitle>
                {deleted ? `Pulihkan ${noun} ini?` : `Hapus ${noun} ini?`}
              </DialogTitle>
              <DialogDescription>
                {deleted
                ? `“${name}”. ${copy.dialogPulih}`
                : `“${name}”. ${copy.dialogHapus}`}
              </DialogDescription>
            </DialogHeader>

            {!deleted && <div className="mt-3">{alasanField}</div>}

            {feedbackBlock && <div className="mt-3">{feedbackBlock}</div>}

            <DialogFooter className="mt-4 shrink-0 gap-2 border-t border-border/60 pt-4 sm:space-x-0">
              <Button type="button" variant="outline" disabled={busy} onClick={() => {
                setConfirming(false);
                setFeedback(null);
            }}>
                Batal
              </Button>
              <Button type="button" variant={deleted ? 'default' : 'destructive'} disabled={busy} onClick={() => void (deleted ? handleRestore() : handleDelete())}>
                {busy
                ? 'Memproses…'
                : deleted
                    ? 'Ya, pulihkan'
                    : 'Ya, hapus'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>);
    }
    return (<Card className={deleted ? 'border-destructive/30' : undefined}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <ShieldAlert aria-hidden className="h-4 w-4 text-primary"/>
            {deleted ? `Pemulihan ${noun}` : `Hapus ${noun}`}
          </span>
          {deleted && <Badge variant="destructive">Dihapus</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {deleted ? (<>
            <p className="text-xs text-sage-500">
              Dihapus {formatTanggalWaktu(deletedAt)}
            </p>
            {deletionReason?.trim() ? (<p className="rounded-[var(--radius)] bg-cream-50 px-4 py-3 text-sm leading-relaxed text-charcoal-700">
                Alasan: {deletionReason.trim()}
              </p>) : null}
            <p className="text-sm leading-relaxed text-sage-500">{copy.deskripsiTerhapus}</p>
          </>) : (<p className="text-sm leading-relaxed text-sage-500">{copy.deskripsiHapus}</p>)}

        {targetId === null ? (<p className="rounded-[var(--radius)] border border-border bg-cream-50 px-4 py-3 text-sm font-medium text-charcoal-700">
            ID {noun} tidak tersedia, tindakan ini dinonaktifkan.
          </p>) : accessLoading ? (<p className="rounded-[var(--radius)] bg-cream-50 px-4 py-3 text-sm text-sage-500">
            Memeriksa izin…
          </p>) : accessFailed && !targetProtected ? (<div role="alert" className="flex flex-wrap items-center gap-4 rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-medium text-charcoal-700">
            <span className="min-w-0 flex-1">
              {accessError} Status Super Admin belum dapat dipastikan, jadi kontrol penghapusan
              disembunyikan.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={retryAccess}>
              <RefreshCw aria-hidden className="h-3.5 w-3.5"/>
              Coba lagi
            </Button>
          </div>) : restrictedNote ? (<p className="rounded-[var(--radius)] border border-border bg-cream-50 px-4 py-3 text-sm font-medium text-charcoal-700">
            {restrictedNote}
          </p>) : allowed ? (<>
            {deleted && restoreNote ? (<p className="rounded-[var(--radius)] border border-border bg-cream-50 px-4 py-3 text-sm leading-relaxed text-charcoal-700">
                {restoreNote}
              </p>) : null}

            {!deleted && confirming && alasanField}

            {feedbackBlock}

            <div>
              <div className="flex flex-wrap items-center gap-2">
                {!(deleted && restoreNote) && (<Button type="button" variant={deleted ? 'default' : 'destructive'} disabled={busy} onClick={() => void (deleted ? handleRestore() : handleDelete())}>
                    {busy ? (<Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none"/>) : deleted ? (<Undo2 aria-hidden className="h-4 w-4"/>) : (<Trash2 aria-hidden className="h-4 w-4"/>)}
                    {busy
                    ? 'Memproses…'
                    : deleted
                        ? confirming
                            ? 'Klik untuk konfirmasi pemulihan'
                            : `Pulihkan ${noun}`
                        : confirming
                            ? `Klik untuk konfirmasi penghapusan`
                            : `Hapus ${noun}`}
                  </Button>)}
                {confirming && !busy && (<Button type="button" variant="outline" onClick={() => {
                    setConfirming(false);
                    setFeedback(null);
                }}>
                    Batal
                  </Button>)}
              </div>
              {confirming && !busy && (<p className="mt-2 text-xs font-medium text-warning-strong">
                  {deleted
                    ? `Pulihkan “${name}”? ${copy.dialogPulih}`
                    : `Hapus “${name}”? ${copy.dialogHapus}`}
                </p>)}
            </div>
          </>) : null}
      </CardContent>
    </Card>);
}
