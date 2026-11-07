'use client';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { useAdminMe } from '@/hooks/use-admin-me';
import { isActiveBlockSanction } from '@/lib/account-block';
import { fetchSanctions, issueSanction, revokeAllActiveBlocks, type SanctionItem, } from '@/lib/admin-sanctions';
import { formatTanggalWaktu, labelStatusAkun } from './admin-format';
import { AdminInlineError } from './admin-state';
const REASON_MAX = 500;
export function AccountBlockPanel({ userId, name, accountStatus, targetRole, targetProtected = false, onChanged, }: {
    userId: string | null;
    name: string;
    accountStatus: string | null;
    targetRole: string | null;
    targetProtected?: boolean;
    onChanged: () => void;
}) {
    const { loading: accessLoading, me, status: accessStatus, errorMessage: accessError, retry: retryAccess, } = useAdminMe();
    const [reason, setReason] = useState('');
    const [durationDays, setDurationDays] = useState('');
    const [confirming, setConfirming] = useState<'none' | 'block' | 'unblock'>('none');
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<{
        kind: 'error' | 'success';
        text: string;
    } | null>(null);
    const [sanctions, setSanctions] = useState<SanctionItem[]>([]);
    const [sanctionsStatus, setSanctionsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [sanctionsError, setSanctionsError] = useState('');
    const loadSanctions = useCallback(async () => {
        if (!userId) {
            setSanctions([]);
            setSanctionsStatus('ready');
            return;
        }
        setSanctionsStatus('loading');
        setSanctionsError('');
        try {
            const result = await fetchSanctions(100, 0, undefined, { userId });
            setSanctions(result.sanctions);
            setSanctionsStatus('ready');
        }
        catch (err) {
            setSanctionsError(err instanceof Error ? err.message : 'Gagal memuat sanksi akun.');
            setSanctionsStatus('error');
        }
    }, [userId]);
    useEffect(() => {
        void loadSanctions();
    }, [loadSanctions]);
    const activeBlocks = sanctions.filter((item) => isActiveBlockSanction(item, Date.now()));
    const blocked = accountStatus === 'banned' || accountStatus === 'suspended' || activeBlocks.length > 0;
    const accessFailed = accessStatus === 'error';
    const targetIsAdmin = targetRole === 'admin';
    let restrictedNote: string | null = null;
    let allowed = false;
    if (!accessLoading) {
        if (targetProtected) {
            restrictedNote =
                'Akun ini adalah Super Admin. Akun Super Admin dilindungi dan tidak dapat diblokir.';
        }
        else if (accessFailed) {
            restrictedNote = null;
        }
        else if (!me) {
            restrictedNote = 'Blokir dan buka blokir hanya dapat dilakukan admin.';
        }
        else if (targetIsAdmin && !me.isSuperAdmin) {
            restrictedNote = 'Hanya Super Admin yang dapat memblokir akun admin.';
        }
        else {
            allowed = true;
        }
    }
    const handleBlock = async () => {
        if (busy || !userId)
            return;
        if (confirming !== 'block') {
            setConfirming('block');
            setFeedback(null);
            return;
        }
        const trimmed = reason.trim();
        if (!trimmed) {
            setFeedback({ kind: 'error', text: 'Alasan pemblokiran wajib diisi.' });
            return;
        }
        const days = durationDays.trim() ? Number(durationDays) : null;
        if (days !== null && (!Number.isFinite(days) || days <= 0)) {
            setFeedback({
                kind: 'error',
                text: 'Durasi blokir tidak valid. Isi bilangan bulat lebih dari 0, atau kosongkan.',
            });
            return;
        }
        setBusy(true);
        setFeedback(null);
        try {
            await issueSanction({ userId, sanctionType: 'ban', reason: trimmed, durationDays: days });
            setConfirming('none');
            setReason('');
            setDurationDays('');
            setFeedback({
                kind: 'success',
                text: 'Akun diblokir. Saat mencoba login, pengguna melihat pesan bahwa akunnya diblokir.',
            });
            await loadSanctions();
            onChanged();
        }
        catch (err) {
            setFeedback({
                kind: 'error',
                text: err instanceof Error ? err.message : 'Gagal memblokir akun.',
            });
        }
        finally {
            setBusy(false);
        }
    };
    const handleUnblock = async () => {
        if (busy || !userId)
            return;
        if (confirming !== 'unblock') {
            setConfirming('unblock');
            setFeedback(null);
            return;
        }
        if (activeBlocks.length === 0) {
            setConfirming('none');
            setFeedback({
                kind: 'error',
                text: 'Tidak ada sanksi blokir/penangguhan aktif yang tercatat untuk akun ini.',
            });
            return;
        }
        setBusy(true);
        setFeedback(null);
        const { failed } = await revokeAllActiveBlocks(activeBlocks);
        await loadSanctions();
        onChanged();
        setBusy(false);
        if (failed.length === 0) {
            setConfirming('none');
            setFeedback({
                kind: 'success',
                text: 'Blokir dibuka. Akun dapat login kembali seperti biasa.',
            });
        }
        else {
            setFeedback({
                kind: 'error',
                text: `Sebagian blokir belum tercabut: ${failed[0].message}`,
            });
        }
    };
    const feedbackBlock = feedback ? (<p role={feedback.kind === 'error' ? 'alert' : 'status'} className={feedback.kind === 'error'
            ? 'rounded-[var(--radius)] border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive'
            : 'rounded-[var(--radius)] border border-success/25 bg-success/5 px-4 py-3 text-sm font-medium text-success'}>
      {feedback.text}
    </p>) : null;
    const sanctionsList = activeBlocks.length > 0 ? (<ul className="grid gap-2">
        {activeBlocks.map((item) => (<li key={item.id} className="rounded-[var(--radius)] bg-cream-50 px-4 py-3">
            <p className="text-sm font-semibold text-charcoal-900">
              {item.sanctionType.toLowerCase() === 'ban' ? 'Diblokir' : 'Ditangguhkan'}
              {' · '}
              {item.endAt ? `sampai ${formatTanggalWaktu(item.endAt)}` : 'tanpa batas waktu'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-sage-500">
              {item.reason.trim() || 'Tanpa alasan tercatat'} · oleh {item.issuerName}
            </p>
          </li>))}
      </ul>) : null;
    return (<Card className={blocked ? 'border-destructive/30' : undefined}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <ShieldAlert aria-hidden className="h-4 w-4 text-primary"/>
            Blokir akun
          </span>
          {blocked && (<Badge variant={accountStatus === 'suspended' ? 'warning' : 'destructive'} className="font-bold">
              {labelStatusAkun(accountStatus) ?? 'Diblokir'}
            </Badge>)}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm leading-relaxed text-sage-500">
          {blocked
            ? 'Akun ini tidak dapat masuk. Membuka blokir akan mengakhiri semua sanksi blokir/penangguhan yang masih berlaku sehingga akun dapat login kembali.'
            : 'Memblokir akun membuat pengguna tidak dapat masuk sama sekali. Saat mencoba login, ia melihat pesan merah bahwa akunnya telah diblokir. Blokir dapat dibuka kembali dari panel ini kapan saja.'}
        </p>

        {userId === null ? (<p className="rounded-[var(--radius)] border border-border bg-cream-50 px-4 py-3 text-sm font-medium text-charcoal-700">
            ID pengguna tidak tersedia, tindakan ini dinonaktifkan.
          </p>) : accessLoading ? (<p className="rounded-[var(--radius)] bg-cream-50 px-4 py-3 text-sm text-sage-500">
            Memeriksa izin…
          </p>) : accessFailed && !targetProtected ? (<div role="alert" className="flex flex-wrap items-center gap-4 rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-medium text-charcoal-700">
            <span className="min-w-0 flex-1">
              {accessError} Status Super Admin belum dapat dipastikan, jadi tindakan blokir
              disembunyikan.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={retryAccess}>
              <RefreshCw aria-hidden className="h-3.5 w-3.5"/>
              Coba lagi
            </Button>
          </div>) : restrictedNote ? (<p className="rounded-[var(--radius)] border border-border bg-cream-50 px-4 py-3 text-sm font-medium text-charcoal-700">
            {restrictedNote}
          </p>) : allowed ? (<>
            {sanctionsStatus === 'loading' ? (<p className="rounded-[var(--radius)] bg-cream-50 px-4 py-3 text-sm text-sage-500">
                Memuat sanksi akun…
              </p>) : sanctionsStatus === 'error' ? (<div className="grid gap-2">
                <AdminInlineError message={sanctionsError}/>
                <div>
                  <Button type="button" variant="outline" size="sm" onClick={() => void loadSanctions()}>
                    <RefreshCw aria-hidden className="h-3.5 w-3.5"/>
                    Muat ulang sanksi
                  </Button>
                </div>
              </div>) : (sanctionsList)}

            {feedbackBlock}

            {blocked ? (<div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" disabled={busy || sanctionsStatus !== 'ready'} onClick={() => void handleUnblock()}>
                    {busy ? (<Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none"/>) : (<ShieldCheck aria-hidden className="h-4 w-4"/>)}
                    {busy
                    ? 'Memproses…'
                    : confirming === 'unblock'
                        ? 'Klik untuk konfirmasi buka blokir'
                        : 'Buka blokir akun'}
                  </Button>
                  {confirming === 'unblock' && !busy && (<Button type="button" variant="outline" onClick={() => {
                        setConfirming('none');
                        setFeedback(null);
                    }}>
                      Batal
                    </Button>)}
                </div>
                {confirming === 'unblock' && !busy && (<p className="mt-2 text-xs font-medium text-warning-strong">
                    Buka blokir “{name}”? Semua sanksi blokir/penangguhan yang masih berlaku
                    diakhiri dan akun dapat login kembali.
                  </p>)}
              </div>) : (<div className="grid gap-4">
                {confirming === 'block' && (<>
                    <div>
                      <label htmlFor="account-block-reason" className="block text-sm font-medium text-charcoal-900">
                        Alasan pemblokiran (wajib, tercatat di audit)
                      </label>
                      <Textarea id="account-block-reason" value={reason} autoFocus onChange={(event) => setReason(event.target.value.slice(0, REASON_MAX))} rows={3} maxLength={REASON_MAX} placeholder="Mis. akun terbukti melakukan penipuan berulang." className="mt-1.5"/>
                      <p className="mt-1 text-xs text-sage-500">
                        {reason.trim().length}/{REASON_MAX} karakter
                      </p>
                    </div>
                    <div>
                      <label htmlFor="account-block-duration" className="block text-sm font-medium text-charcoal-900">
                        Durasi blokir (hari, opsional)
                      </label>
                      <Input id="account-block-duration" type="number" min={1} step={1} inputMode="numeric" value={durationDays} onChange={(event) => setDurationDays(event.target.value)} placeholder="Kosongkan untuk blokir tanpa batas waktu" className="mt-1.5"/>
                    </div>
                  </>)}
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="destructive" disabled={busy} onClick={() => void handleBlock()}>
                    {busy ? (<Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none"/>) : (<ShieldAlert aria-hidden className="h-4 w-4"/>)}
                    {busy
                    ? 'Memproses…'
                    : confirming === 'block'
                        ? 'Klik untuk konfirmasi pemblokiran'
                        : 'Blokir akun'}
                  </Button>
                  {confirming === 'block' && !busy && (<Button type="button" variant="outline" onClick={() => {
                        setConfirming('none');
                        setFeedback(null);
                    }}>
                      Batal
                    </Button>)}
                </div>
                {confirming === 'block' && !busy && (<p className="text-xs font-medium text-warning-strong">
                    Blokir “{name}”? Pengguna tidak dapat masuk dan melihat pesan bahwa akunnya
                    diblokir. Tindakan ini dapat dibuka kembali kapan saja.
                  </p>)}
              </div>)}
          </>) : null}
      </CardContent>
    </Card>);
}
