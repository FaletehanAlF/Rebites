'use client';
import { useEffect, useState } from 'react';
import { Check, Flag } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { getValidAuthHeader } from '@/lib/auth-token';
const CATEGORIES = [
    { value: 'harassment', label: 'Pelecehan / ujaran tidak pantas' },
    { value: 'spam', label: 'Spam atau aktivitas berulang' },
    { value: 'fraud', label: 'Kecurangan / penipuan' },
    { value: 'inappropriate_content', label: 'Konten tidak pantas' },
    { value: 'other', label: 'Lainnya' },
] as const;
const MIN_DESCRIPTION_LENGTH = 10;
interface ReportUserModalProps {
    open: boolean;
    reportedUserId: string | null;
    reportedLabel?: string;
    onClose: () => void;
    onSubmitted?: () => void;
}
export function ReportUserModal({ open, reportedUserId, reportedLabel, onClose, onSubmitted, }: ReportUserModalProps) {
    const [category, setCategory] = useState('other');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const targetId = reportedUserId?.trim() ?? '';
    const targetValid = targetId.length > 0;
    useEffect(() => {
        if (open) {
            setCategory('other');
            setDescription('');
            setSubmitting(false);
            setError('');
            setSuccess(false);
        }
    }, [open]);
    const submit = async () => {
        if (!targetValid || submitting)
            return;
        if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
            setError(`Deskripsi minimal ${MIN_DESCRIPTION_LENGTH} karakter.`);
            return;
        }
        setSubmitting(true);
        setError('');
        setSuccess(false);
        try {
            const authHeader = await getValidAuthHeader();
            const res = await fetch('/api/reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: authHeader,
                },
                body: JSON.stringify({
                    reportedUserId: targetId,
                    category,
                    description: description.trim(),
                }),
            });
            const json = (await res.json().catch(() => null)) as {
                error?: string;
            } | null;
            if (!res.ok) {
                throw new Error(json?.error ?? 'Gagal mengirim laporan.');
            }
            setSuccess(true);
            onSubmitted?.();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal mengirim laporan.');
        }
        finally {
            setSubmitting(false);
        }
    };
    const close = () => {
        if (submitting)
            return;
        onClose();
    };
    const canSubmit = targetValid && description.trim().length >= MIN_DESCRIPTION_LENGTH && !submitting;
    return (<Dialog open={open} onOpenChange={(value) => !value && close()}>

      <DialogContent className="max-w-lg">

        <DialogHeader>

          <DialogTitle className="flex items-center gap-2">

            <Flag className="h-5 w-5 text-destructive"/>

            Laporkan pengguna

          </DialogTitle>

          <DialogDescription>

            {reportedLabel
            ? `Laporkan akun ${reportedLabel}. Laporan akan ditinjau oleh admin.`
            : 'Laporkan akun yang melanggar ketentuan. Laporan akan ditinjau oleh admin.'}

          </DialogDescription>

        </DialogHeader>



        {!targetValid ? (<div className="rounded-[var(--radius)] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">

            Target laporan tidak valid. Tutup jendela ini dan buka kembali dari pesanan yang benar.

          </div>) : success ? (<div className="flex flex-col gap-3">

            <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-cream-50 px-4 py-3 text-sm text-charcoal-900">

              <Check className="h-4 w-4 shrink-0 text-primary"/>

              Laporan berhasil dikirim. Admin akan meninjau laporan Anda.

            </div>

            <div className="flex justify-end">

              <Button type="button" onClick={close}>

                Selesai

              </Button>

            </div>

          </div>) : (<div className="grid gap-4">

            <div>

              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-sage-500">

                Alasan

              </label>

              <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={submitting} className="w-full rounded-[var(--radius)] border border-border bg-white px-3 py-2 text-sm text-charcoal-900">

                {CATEGORIES.map((item) => (<option key={item.value} value={item.value}>

                    {item.label}

                  </option>))}

              </select>

            </div>



            <div>

              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-sage-500">

                Deskripsi

              </label>

              <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={submitting} rows={5} className="w-full resize-none rounded-[var(--radius)] border border-border bg-white px-3 py-2 text-sm text-charcoal-900" placeholder="Jelaskan kejadian dengan singkat dan jelas (minimal 10 karakter)."/>

              <p className="mt-1 text-xs text-charcoal-500">

                {description.trim().length < MIN_DESCRIPTION_LENGTH
                ? `Minimal ${MIN_DESCRIPTION_LENGTH} karakter (${description.trim().length}/${MIN_DESCRIPTION_LENGTH}).`
                : `${description.trim().length} karakter.`}

              </p>

            </div>



            {error && (<p className="rounded-[var(--radius)] border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">

                {error}

              </p>)}



            <div className="flex justify-end gap-2">

              <Button type="button" variant="outline" onClick={close} disabled={submitting}>

                Batal

              </Button>

              <Button type="button" onClick={submit} disabled={!canSubmit}>

                {submitting ? 'Mengirim…' : 'Kirim laporan'}

              </Button>

            </div>

          </div>)}

      </DialogContent>

    </Dialog>);
}
