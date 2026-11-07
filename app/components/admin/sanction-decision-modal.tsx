'use client';
import { useEffect, useRef, useState } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/app/components/ui/dialog';
import { issueSanction } from '@/lib/admin-sanctions';
import { fetchAdminUserDetail } from '@/lib/admin-users';
import { useAdminMe } from '@/hooks/use-admin-me';
import { AdminInlineError } from './admin-state';
type Action = 'none' | 'suspend' | 'ban' | 'delete';
interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string | null;
    userName: string;
    warningId?: string | null;
    onSuccess?: () => void;
}
export function SanctionDecisionModal({ open, onOpenChange, userId, userName, warningId, onSuccess, }: Props) {
    const { loading: accessLoading, me, status: accessStatus, errorMessage: accessError, retry: retryAccess, } = useAdminMe();
    const [action, setAction] = useState<Action>('none');
    const [reason, setReason] = useState('');
    const [durationDays, setDurationDays] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [target, setTarget] = useState<{
        role: string | null;
        isSuperAdmin: boolean;
    } | null>(null);
    const [targetLoading, setTargetLoading] = useState(false);
    const submitInFlight = useRef(false);
    useEffect(() => {
        if (!open || !userId) {
            setTarget(null);
            setTargetLoading(false);
            return;
        }
        let mounted = true;
        setTargetLoading(true);
        setTarget(null);
        fetchAdminUserDetail(userId)
            .then((detail) => {
            if (!mounted)
                return;
            setTarget({ role: detail.role, isSuperAdmin: detail.is_super_admin === true });
            setTargetLoading(false);
        })
            .catch(() => {
            if (!mounted)
                return;
            setTarget(null);
            setTargetLoading(false);
        });
        return () => {
            mounted = false;
        };
    }, [open, userId]);
    const viewerIsSuperAdmin = me?.isSuperAdmin === true;
    const targetIsSuperAdmin = target?.isSuperAdmin === true;
    const targetIsAdmin = target?.role === 'admin';
    const accessFailed = accessStatus === 'error';
    const checking = accessLoading || (open && targetLoading);
    let restrictedReason: string | null = null;
    if (open && !checking) {
        if (targetIsSuperAdmin) {
            restrictedReason = 'Akun Super Admin dilindungi dan tidak dapat dikenai sanksi.';
        }
        else if (accessFailed) {
            restrictedReason = null;
        }
        else if (targetIsAdmin && !viewerIsSuperAdmin) {
            restrictedReason =
                'Hanya Super Admin yang dapat memberikan sanksi kepada akun admin.';
        }
    }
    const reset = () => {
        setAction('none');
        setReason('');
        setDurationDays('');
        setConfirmText('');
        setError('');
        setSubmitting(false);
        submitInFlight.current = false;
    };
    const handleOpenChange = (next: boolean) => {
        if (!next && submitInFlight.current)
            return;
        if (!next)
            reset();
        onOpenChange(next);
    };
    const submit = async () => {
        setError('');
        if (restrictedReason) {
            return;
        }
        if (action === 'none') {
            handleOpenChange(false);
            return;
        }
        if (!userId) {
            setError('User target tidak tersedia.');
            return;
        }
        if (!reason.trim()) {
            setError('Alasan wajib diisi.');
            return;
        }
        if (action === 'delete' && confirmText.trim() !== 'DELETE') {
            setError("Ketik DELETE untuk melanjutkan.");
            return;
        }
        const days = durationDays.trim() ? Number(durationDays) : null;
        if (days !== null && (!Number.isFinite(days) || days <= 0)) {
            setError('Durasi tidak valid.');
            return;
        }
        setSubmitting(true);
        submitInFlight.current = true;
        try {
            await issueSanction({
                userId,
                sanctionType: action,
                reason: reason.trim(),
                warningId: warningId ?? null,
                durationDays: days,
                confirmText: action === 'delete' ? confirmText.trim() : undefined,
            });
            submitInFlight.current = false;
            handleOpenChange(false);
            onSuccess?.();
        }
        catch (err) {
            submitInFlight.current = false;
            setError(err instanceof Error ? err.message : 'Gagal menyimpan sanksi.');
            setSubmitting(false);
        }
    };
    return (<Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Tentukan Tindakan</DialogTitle>
          <DialogDescription>
            Pilih tindakan untuk{' '}
            <span className="font-semibold text-charcoal-900">{userName}</span>. Tidak ada sanksi
            otomatis; setiap keputusan dicatat di audit log.
          </DialogDescription>
        </DialogHeader>

        
        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
          {checking ? (<p className="rounded-[var(--radius)] bg-cream-50 px-4 py-3 text-sm text-sage-500">
              Memeriksa izin tindakan…
            </p>) : accessFailed ? (<div role="alert" className="flex flex-wrap items-center gap-4 rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-medium text-charcoal-700">
              <span className="min-w-0 flex-1">
                {accessError} Status Super Admin belum dapat dipastikan, jadi tindakan
                sanksi disembunyikan.
              </span>
              <Button type="button" variant="outline" size="sm" onClick={retryAccess}>
                <RefreshCw aria-hidden className="h-3.5 w-3.5"/>
                Coba lagi
              </Button>
            </div>) : restrictedReason ? (<p className="flex items-start gap-2 rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-medium text-charcoal-700">
              <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong"/>
              {restrictedReason}
            </p>) : (<div role="group" aria-labelledby="sanction-action-label" className="grid grid-cols-2 gap-2">
              <span id="sanction-action-label" className="sr-only">
                Tindakan sanksi
              </span>
              {([
                { value: 'none', label: 'Tidak Ada Tindakan' },
                { value: 'suspend', label: 'Tangguhkan Akun' },
                { value: 'ban', label: 'Blokir Akun' },
                { value: 'delete', label: 'Hapus Akun' },
            ] as {
                value: Action;
                label: string;
            }[]).map((opt) => (<button key={opt.value} type="button" onClick={() => setAction(opt.value)} aria-pressed={action === opt.value} className={`h-10 rounded-[var(--radius)] border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${action === opt.value
                    ? 'border-primary bg-primary text-primary-foreground-strong'
                    : 'border-border bg-white text-charcoal-700 hover:bg-sage-100/40'}`}>
                  {opt.label}
                </button>))}
            </div>)}

          {!checking && !restrictedReason && action !== 'none' && (<>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sanction-reason" className="text-xs font-semibold uppercase tracking-[0.06em] text-sage-500">
                  Alasan (wajib)
                </label>
                <Textarea id="sanction-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Jelaskan alasan tindakan ini." rows={3}/>
              </div>

              {(action === 'suspend' || action === 'ban') && (<div className="flex flex-col gap-1.5">
                  <label htmlFor="sanction-duration" className="text-xs font-semibold uppercase tracking-[0.06em] text-sage-500">
                    Durasi (hari, opsional)
                  </label>
                  <Input id="sanction-duration" type="number" min={1} step={1} inputMode="numeric" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} placeholder="Kosongkan untuk permanen" aria-describedby="sanction-duration-hint"/>
                  <p id="sanction-duration-hint" className="text-xs text-sage-500">
                    Harus bilangan bulat lebih dari 0. Kosongkan bila sanksi tidak berbatas waktu.
                  </p>
                </div>)}

              {action === 'delete' && (<div className="flex flex-col gap-1.5">
                  <label htmlFor="sanction-confirm" className="text-xs font-semibold uppercase tracking-[0.06em] text-charcoal-900">
                    Ketik DELETE untuk melanjutkan
                  </label>
                  <Input id="sanction-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE"/>
                  <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning-strong">
                    <ShieldAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0"/>
                    <span>
                      Sanksi &ldquo;Hapus Akun&rdquo; saat ini hanya dicatat sebagai sanksi pada
                      audit log. Akun pengguna <strong className="font-semibold">tidak</strong>{' '}
                      dihapus dan status akunnya tidak diubah oleh tindakan ini.
                    </span>
                  </p>
                </div>)}
            </>)}
        </div>

        
        {error && (<div className="mt-3 shrink-0">
            <AdminInlineError message={error}/>
          </div>)}

        <DialogFooter className="mt-4 shrink-0 gap-2 border-t border-border/60 pt-4 sm:space-x-0">
          <Button type="button" variant="outline" disabled={submitting} onClick={() => handleOpenChange(false)}>
            Batal
          </Button>
          <Button type="button" variant={action === 'delete' ? 'destructive' : 'default'} disabled={submitting || checking} onClick={submit}>
            {action === 'none' ? 'Tutup' : submitting ? 'Menyimpan…' : 'Terapkan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
