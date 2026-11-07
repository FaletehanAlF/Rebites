'use client';
import { Download } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import type { AdminExportFeedback } from '@/hooks/use-admin-export';
export function AdminExportButton({ onClick, busy, disabled, noun, }: {
    onClick: () => void;
    busy: boolean;
    disabled?: boolean;
    noun: string;
}) {
    return (<Button type="button" variant="outline" onClick={onClick} disabled={busy || disabled} aria-busy={busy} title={`Unduh berkas Excel (.xlsx) dengan filter yang sedang aktif (maksimum 5.000 ${noun})`}>
      <Download aria-hidden className="h-4 w-4"/>
      {busy ? 'Menyiapkan Excel…' : 'Ekspor Excel'}
    </Button>);
}
export function AdminExportNotice({ feedback, }: {
    feedback: AdminExportFeedback;
}) {
    return (<p role={feedback.tone === 'error' ? 'alert' : 'status'} className={cn('mb-4 rounded-[var(--radius)] border px-4 py-3 text-sm', feedback.tone === 'error'
            ? 'border-destructive/30 bg-destructive/5 text-destructive'
            : feedback.tone === 'success'
                ? 'border-success/30 bg-success/5 text-charcoal-900'
                : 'border-border bg-white text-sage-500')}>
      {feedback.message}
    </p>);
}
