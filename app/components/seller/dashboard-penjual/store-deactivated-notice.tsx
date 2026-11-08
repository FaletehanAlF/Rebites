'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, Send, Store } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useStoreActivation } from '@/hooks/use-store-activation';
import { formatNotificationTime } from '@/lib/notification-helpers';
export function StoreDeactivatedNotice() {
    const { state, loading, submitting, submit } = useStoreActivation();
    const [dismissed, setDismissed] = useState(false);
    const [message, setMessage] = useState('');
    const [feedback, setFeedback] = useState<{
        kind: 'ok' | 'error';
        text: string;
    } | null>(null);
    useEffect(() => {
        if (!state || state.isActive)
            setDismissed(false);
    }, [state]);
    if (loading || !state || state.isActive)
        return null;
    const reasonText = state.deactivationReason?.trim()
        ? state.deactivationReason
        : 'Tidak ada alasan yang dicatat admin.';
    const pendingRequest = state.request?.status === 'pending' ? state.request : null;
    const rejectedRequest = state.request?.status === 'rejected' ? state.request : null;
    const handleSubmit = async () => {
        if (submitting)
            return;
        const trimmed = message.trim();
        if (trimmed.length < 10) {
            setFeedback({ kind: 'error', text: 'Tuliskan keterangan minimal 10 karakter.' });
            return;
        }
        const result = await submit(trimmed);
        if (result.ok) {
            setMessage('');
            setFeedback({
                kind: 'ok',
                text: 'Permintaan aktivasi terkirim. Admin akan meninjau dan menghubungi Anda.',
            });
        }
        else {
            setFeedback({ kind: 'error', text: result.message });
        }
    };
    return (<>
      
      <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-destructive/30 bg-destructive/[0.08] px-4 py-2.5 sm:px-6 lg:px-10">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] leading-snug text-charcoal-900">
          <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-destructive"/>
          <span className="min-w-0">
            <strong className="font-semibold">Toko Anda dinonaktifkan admin.</strong>{' '}
            <span className="text-charcoal-700">{reasonText}</span>
          </span>
        </span>
        <button type="button" onClick={() => {
            setDismissed(false);
            setFeedback(null);
        }} className="shrink-0 rounded-[var(--radius)] border border-destructive/40 bg-white px-3 py-1.5 text-xs font-semibold text-destructive transition-colors duration-200 hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          Lihat &amp; ajukan aktivasi
        </button>
      </div>

      <Dialog open={!dismissed} onOpenChange={(open) => !open && setDismissed(true)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="space-y-1 pr-10 text-left">
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-destructive">
              <Store aria-hidden className="h-3.5 w-3.5"/>
              Status toko
            </span>
            <DialogTitle className="mt-1 text-left text-lg font-semibold text-charcoal-900">
              Toko Anda dinonaktifkan
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm leading-relaxed text-charcoal-700">
                <p>
                  Toko <strong className="font-semibold">{state.businessName || 'Anda'}</strong>{' '}
                  dinonaktifkan oleh admin ReBites, sehingga tidak tampil di katalog pembeli.
                  Anda tetap dapat mengelola dashboard dan produk selama masa ini.
                </p>
                <p className="rounded-[var(--radius)] border border-destructive/25 bg-destructive/[0.06] px-3 py-2">
                  <span className="font-semibold text-charcoal-900">Alasan admin: </span>
                  {reasonText}
                  {state.deactivatedAt && (<span className="mt-1 block text-xs text-muted-foreground">
                      Dinonaktifkan {formatNotificationTime(state.deactivatedAt)}
                    </span>)}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-1">
            {pendingRequest ? (<div className="space-y-2 rounded-[var(--radius)] border border-border bg-secondary/60 p-3.5">
                <Badge variant="warning">Menunggu keputusan admin</Badge>
                <p className="text-sm leading-relaxed text-charcoal-700">
                  Permintaan aktivasi Anda sudah terkirim. Admin akan meninjau dan mengaktifkan
                  kembali toko bila disetujui.
                </p>
                <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  Pesan Anda: {pendingRequest.message}
                </p>
                <p className="text-xs text-muted-foreground">
                  Dikirim {formatNotificationTime(pendingRequest.createdAt)}
                </p>
              </div>) : (<div className="space-y-2">
                {rejectedRequest && (<div className="rounded-[var(--radius)] border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-sm">
                    <span className="font-semibold text-charcoal-900">
                      Permintaan sebelumnya ditolak.{' '}
                    </span>
                    {rejectedRequest.decisionNote || 'Tidak ada catatan dari admin.'}
                  </div>)}
                <label htmlFor="store-activation-message" className="block text-sm font-medium text-charcoal-900">
                  Ajukan permintaan aktivasi
                </label>
                <textarea id="store-activation-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={4} maxLength={1000} placeholder="Jelaskan perbaikan yang sudah Anda lakukan, mis. kelengkapan data toko, kualitas produk, atau alasan lain." className="w-full rounded-[var(--radius)] border border-border bg-white px-3 py-2 text-sm leading-relaxed text-charcoal-900 placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"/>
                <p className="text-xs text-muted-foreground">
                  {message.trim().length}/1000 karakter · minimal 10 karakter
                </p>
              </div>)}

            {feedback && (<p role="status" aria-live="polite" className={feedback.kind === 'ok'
                ? 'mt-2 text-sm font-medium text-success'
                : 'mt-2 text-sm font-medium text-destructive'}>
                {feedback.text}
              </p>)}
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
              Nanti saja
            </Button>
            {!pendingRequest && (<Button type="button" onClick={() => void handleSubmit()} disabled={submitting || message.trim().length < 10}>
                <Send aria-hidden className="h-4 w-4"/>
                {submitting ? 'Mengirim…' : 'Kirim permintaan aktivasi'}
              </Button>)}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>);
}
