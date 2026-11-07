'use client';
import { useRef, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/app/components/ui/dialog';
import { issueWarning, type WarningLevel } from '@/lib/admin-warnings';
import { AdminInlineError } from './admin-state';
interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string | null;
    userName: string;
    reportId?: string | null;
    onSuccess?: () => void;
}
const LEVELS: {
    value: WarningLevel;
    label: string;
}[] = [
    { value: 1, label: 'Tingkat 1' },
    { value: 2, label: 'Tingkat 2' },
    { value: 3, label: 'Tingkat 3' },
];
export function IssueWarningModal({ open, onOpenChange, userId, userName, reportId, onSuccess, }: Props) {
    const [level, setLevel] = useState<WarningLevel>(1);
    const [category, setCategory] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{
        category?: string;
        reason?: string;
    }>({});
    const submitInFlight = useRef(false);
    const reset = () => {
        setLevel(1);
        setCategory('');
        setReason('');
        setError('');
        setFieldErrors({});
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
        setFieldErrors({});
        if (!userId) {
            setError('User target tidak tersedia.');
            return;
        }
        if (!category.trim()) {
            setFieldErrors({ category: 'Kategori wajib diisi.' });
            return;
        }
        if (!reason.trim()) {
            setFieldErrors({ reason: 'Alasan wajib diisi.' });
            return;
        }
        submitInFlight.current = true;
        setSubmitting(true);
        try {
            await issueWarning({
                userId,
                warningLevel: level,
                category: category.trim(),
                reason: reason.trim(),
                reportId: reportId ?? null,
            });
            submitInFlight.current = false;
            handleOpenChange(false);
            onSuccess?.();
        }
        catch (err) {
            submitInFlight.current = false;
            setError(err instanceof Error ? err.message : 'Gagal menyimpan peringatan.');
            setSubmitting(false);
        }
    };
    return (<Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Terbitkan peringatan</DialogTitle>
          <DialogDescription>
            Peringatan untuk {userName}. Tingkat 3 / 3 tidak memicu tindakan otomatis.
          </DialogDescription>
        </DialogHeader>

        
        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div>
            <span id="warning-level-label" className="text-xs font-semibold uppercase tracking-[0.06em] text-sage-500">
              Tingkat
            </span>
            <div role="group" aria-labelledby="warning-level-label" className="mt-1.5 grid grid-cols-3 gap-2">
              {LEVELS.map((l) => (<button key={l.value} type="button" onClick={() => setLevel(l.value)} aria-pressed={level === l.value} className={`h-10 rounded-[var(--radius)] border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${level === l.value
                ? 'border-primary bg-primary text-primary-foreground-strong'
                : 'border-border bg-white text-charcoal-700 hover:bg-sage-100/40'}`}>
                  {l.label}
                </button>))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="warning-category" className="text-xs font-semibold uppercase tracking-[0.06em] text-sage-500">
              Kategori
            </label>
            <Input id="warning-category" value={category} onChange={(e) => {
            setCategory(e.target.value);
            if (fieldErrors.category)
                setFieldErrors((f) => ({ ...f, category: undefined }));
        }} placeholder="Contoh: spam, penipuan, konten melanggar" aria-invalid={fieldErrors.category ? true : undefined} aria-describedby={fieldErrors.category ? 'warning-category-error' : undefined}/>
            {fieldErrors.category && (<p id="warning-category-error" role="alert" className="text-xs font-medium text-destructive">
                {fieldErrors.category}
              </p>)}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="warning-reason" className="text-xs font-semibold uppercase tracking-[0.06em] text-sage-500">
              Alasan
            </label>
            <Textarea id="warning-reason" value={reason} onChange={(e) => {
            setReason(e.target.value);
            if (fieldErrors.reason)
                setFieldErrors((f) => ({ ...f, reason: undefined }));
        }} placeholder="Alasan peringatan ini diberikan." rows={3} aria-invalid={fieldErrors.reason ? true : undefined} aria-describedby={fieldErrors.reason ? 'warning-reason-error' : undefined}/>
            {fieldErrors.reason && (<p id="warning-reason-error" role="alert" className="text-xs font-medium text-destructive">
                {fieldErrors.reason}
              </p>)}
          </div>
        </div>

        
        {error && (<div className="mt-3 shrink-0">
            <AdminInlineError message={error}/>
          </div>)}

        <DialogFooter className="mt-4 shrink-0 gap-2 border-t border-border/60 pt-4 sm:space-x-0">
          <Button type="button" variant="outline" disabled={submitting} onClick={() => handleOpenChange(false)}>
            Batal
          </Button>
          <Button type="button" disabled={submitting} onClick={submit}>
            {submitting ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
