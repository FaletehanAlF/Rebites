'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarDays, ExternalLink, FileText, Flag, History, MessageSquareQuote, RefreshCw, Settings2, ShieldAlert, UserRound, } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Textarea } from '@/app/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, } from '@/app/components/ui/card';
import { addReportNote, fetchReportById, fetchReportNotes, updateReport, type ReportItem, type ReportNote, type ReportSeverity, } from '@/lib/admin-reports';
import { fetchActivityLogs, type ActivityLogItem } from '@/lib/admin-activity-logs';
import { fetchAuditLogs, type AuditLogItem } from '@/lib/admin-audit-logs';
import { fetchWarnings, type WarningItem } from '@/lib/admin-warnings';
import { getCurrentUserId } from '@/lib/current-user';
import { formatTanggalWaktu, labelAktivitas } from './admin-format';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER } from './admin-page-header';
import { ADMIN_DETAIL_LABEL } from './admin-detail';
import { AdminInlineError, AdminInlineMessage, AdminLoadingState } from './admin-state';
import { IssueWarningModal } from './issue-warning-modal';
import { SanctionDecisionModal } from './sanction-decision-modal';
const SEVERITY_OPTIONS: {
    value: ReportSeverity | '';
    label: string;
}[] = [
    { value: '', label: 'Tanpa tingkat' },
    { value: 'low', label: 'Rendah' },
    { value: 'medium', label: 'Sedang' },
    { value: 'high', label: 'Tinggi' },
    { value: 'critical', label: 'Kritis' },
];
function SeverityBadge({ severity }: {
    severity: string | null;
}) {
    switch (severity) {
        case 'low':
            return <Badge variant="secondary" className="text-xs">Rendah</Badge>;
        case 'medium':
            return <Badge variant="warning" className="text-xs">Sedang</Badge>;
        case 'high':
            return <Badge variant="destructive" className="text-xs">Tinggi</Badge>;
        case 'critical':
            return <Badge variant="destructive" className="text-xs">Kritis</Badge>;
        default:
            return <Badge variant="secondary" className="text-xs">Tanpa tingkat</Badge>;
    }
}
function statusLabel(status: string): string {
    switch (status) {
        case 'open':
            return 'Terbuka';
        case 'reviewing':
            return 'Ditinjau';
        case 'resolved':
            return 'Selesai';
        case 'dismissed':
            return 'Ditolak';
        default:
            return status;
    }
}
function statusVariant(status: string): 'default' | 'secondary' | 'success' | 'warning' | 'outline' {
    switch (status) {
        case 'resolved':
            return 'success';
        case 'open':
            return 'warning';
        case 'reviewing':
            return 'default';
        case 'dismissed':
            return 'secondary';
        default:
            return 'outline';
    }
}
function Field({ label, children, mono = false, }: {
    label: string;
    children: React.ReactNode;
    mono?: boolean;
}) {
    return (<div className="min-w-0">
      <dt className={ADMIN_DETAIL_LABEL}>{label}</dt>
      <dd className={mono
            ? 'mt-0.5 break-all font-mono text-xs text-charcoal-900'
            : 'mt-0.5 break-words text-sm leading-relaxed text-charcoal-900'}>
        {children}
      </dd>
    </div>);
}
type SectionState = 'loading' | 'ready' | 'error';
function InlineSectionState({ state, loadingLabel, errorLabel, emptyLabel, isEmpty, onRetry, children, }: {
    state: SectionState;
    loadingLabel: string;
    errorLabel: string;
    emptyLabel: string;
    isEmpty: boolean;
    onRetry: () => void;
    children: React.ReactNode;
}) {
    if (state === 'loading') {
        return (<p role="status" className="py-2 text-sm text-sage-500">
        {loadingLabel}…
      </p>);
    }
    if (state === 'error') {
        return (<div className="flex flex-wrap items-center gap-4">
        <AdminInlineError message={errorLabel}/>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden className="h-4 w-4"/>
          Coba lagi
        </Button>
      </div>);
    }
    if (isEmpty) {
        return <AdminInlineMessage>{emptyLabel}</AdminInlineMessage>;
    }
    return <>{children}</>;
}
export function ReportDetailView({ reportId }: {
    reportId: string;
}) {
    const [report, setReport] = useState<ReportItem | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'not-found'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [notes, setNotes] = useState<ReportNote[]>([]);
    const [noteInput, setNoteInput] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [activityLog, setActivityLog] = useState<ActivityLogItem | null>(null);
    const [linkedWarnings, setLinkedWarnings] = useState<WarningItem[]>([]);
    const [auditRows, setAuditRows] = useState<AuditLogItem[]>([]);
    const [actionMsg, setActionMsg] = useState('');
    const [actionError, setActionError] = useState('');
    const [busy, setBusy] = useState(false);
    const [severity, setSeverity] = useState<ReportSeverity | ''>('');
    const [warningOpen, setWarningOpen] = useState(false);
    const [sanctionOpen, setSanctionOpen] = useState(false);
    const [notesState, setNotesState] = useState<SectionState>('loading');
    const [warningsState, setWarningsState] = useState<SectionState>('loading');
    const [auditState, setAuditState] = useState<SectionState>('loading');
    const [activityState, setActivityState] = useState<SectionState>('loading');
    const [reloadToken, setReloadToken] = useState(0);
    const [noteMsg, setNoteMsg] = useState('');
    const [noteError, setNoteError] = useState('');
    const loadReport = useCallback(async () => {
        setStatus('loading');
        setErrorMsg('');
        try {
            const result = await fetchReportById(reportId);
            setReport(result);
            setStatus('ready');
        }
        catch (err) {
            if (err instanceof Error && err.message === 'Laporan tidak ditemukan.') {
                setStatus('not-found');
                return;
            }
            setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat laporan.');
            setStatus('error');
        }
    }, [reportId]);
    useEffect(() => {
        void loadReport();
    }, [loadReport]);
    const loadSections = useCallback(async () => {
        setNotesState('loading');
        setWarningsState('loading');
        setAuditState('loading');
        const [notesRes, warningsRes, auditRes] = await Promise.allSettled([
            fetchReportNotes(reportId, 50, 0),
            fetchWarnings(20, 0, undefined, { reportId }),
            fetchAuditLogs(20, 0, { targetType: 'report', targetId: reportId }),
        ]);
        if (notesRes.status === 'fulfilled') {
            setNotes(notesRes.value.notes);
            setNotesState('ready');
        }
        else {
            setNotes([]);
            setNotesState('error');
        }
        if (warningsRes.status === 'fulfilled') {
            setLinkedWarnings(warningsRes.value.warnings);
            setWarningsState('ready');
        }
        else {
            setLinkedWarnings([]);
            setWarningsState('error');
        }
        if (auditRes.status === 'fulfilled') {
            setAuditRows(auditRes.value.logs);
            setAuditState('ready');
        }
        else {
            setAuditRows([]);
            setAuditState('error');
        }
    }, [reportId]);
    useEffect(() => {
        setSeverity((report?.severity as ReportSeverity | null) ?? '');
    }, [reportId, report?.severity]);
    useEffect(() => {
        setWarningOpen(false);
        setSanctionOpen(false);
        setNoteInput('');
        setNoteMsg('');
        setNoteError('');
        setActionMsg('');
        setActionError('');
    }, [reportId]);
    useEffect(() => {
        void loadSections();
    }, [loadSections, reloadToken]);
    const reloadActivity = useCallback(async () => {
        if (!report?.activityId) {
            setActivityLog(null);
            setActivityState('ready');
            return;
        }
        setActivityState('loading');
        try {
            const res = await fetchActivityLogs(1, 0, { id: report.activityId });
            setActivityLog(res.logs[0] ?? null);
            setActivityState('ready');
        }
        catch {
            setActivityLog(null);
            setActivityState('error');
        }
    }, [report?.activityId]);
    useEffect(() => {
        void reloadActivity();
    }, [reloadActivity, reloadToken]);
    const refreshAll = useCallback(() => {
        void loadReport();
        setReloadToken((t) => t + 1);
    }, [loadReport]);
    const timeline = useMemo(() => {
        if (!report)
            return [];
        const items: {
            at: string;
            label: string;
        }[] = [];
        if (report.createdAt)
            items.push({ at: report.createdAt, label: 'Laporan dibuat' });
        for (const row of auditRows) {
            if (row.action === 'update_report_triage') {
                const to = row.metadata?.to as Record<string, unknown> | undefined;
                const from = row.metadata?.from as Record<string, unknown> | undefined;
                const parts: string[] = [];
                if (to && from) {
                    if (to.severity !== from.severity)
                        parts.push(`tingkat ke ${String(to.severity ?? 'Tanpa tingkat')}`);
                    if (to.assigned_to !== from.assigned_to)
                        parts.push('penugasan berubah');
                }
                items.push({
                    at: row.createdAt,
                    label: `Triage diperbarui: ${parts.join(', ') || 'diperbarui'}`,
                });
            }
            else if (row.action === 'resolve_report') {
                items.push({ at: row.createdAt, label: 'Laporan diselesaikan' });
            }
            else if (row.action === 'dismiss_report') {
                items.push({ at: row.createdAt, label: 'Laporan ditolak' });
            }
        }
        if (!auditRows.some((r) => r.action === 'resolve_report') &&
            report.resolvedAt &&
            report.status === 'resolved') {
            items.push({ at: report.resolvedAt, label: 'Laporan diselesaikan' });
        }
        if (!auditRows.some((r) => r.action === 'dismiss_report') &&
            report.resolvedAt &&
            report.status === 'dismissed') {
            items.push({ at: report.resolvedAt, label: 'Laporan ditolak' });
        }
        for (const w of linkedWarnings) {
            items.push({
                at: w.createdAt,
                label: `Peringatan ${w.warningLevel} / 3 diterbitkan (${w.category})`,
            });
        }
        return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    }, [report, auditRows, linkedWarnings]);
    if (status === 'loading') {
        return (<div className={ADMIN_PAGE_WRAPPER}>
        <AdminLoadingState label="Memuat detail laporan"/>
      </div>);
    }
    if (status === 'not-found' || status === 'error') {
        return (<div className={ADMIN_PAGE_WRAPPER}>
        <AdminPageHeader title={status === 'not-found' ? 'Laporan tidak ditemukan' : 'Gagal memuat laporan'}/>
        <AdminInlineError message={status === 'not-found'
                ? 'Laporan yang diminta tidak ada atau sudah dihapus.'
                : errorMsg}/>
        <div className="mt-3">
          <Button type="button" variant="outline" onClick={() => void loadReport()}>
            <RefreshCw aria-hidden className="h-4 w-4"/>
            Coba lagi
          </Button>
        </div>
      </div>);
    }
    if (!report)
        return null;
    const shortId = report.id.slice(0, 8);
    const doStatus = async (next: 'reviewing' | 'resolved' | 'dismissed') => {
        setBusy(true);
        setActionError('');
        setActionMsg('');
        try {
            await updateReport(report.id, { status: next });
            setActionMsg(`Status diubah ke ${statusLabel(next)}.`);
            refreshAll();
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : 'Gagal memperbarui status.');
        }
        finally {
            setBusy(false);
        }
    };
    const applySeverity = async (value: ReportSeverity | '') => {
        const previous = (report.severity as ReportSeverity | null) ?? '';
        setSeverity(value);
        setBusy(true);
        setActionError('');
        setActionMsg('');
        try {
            await updateReport(report.id, { severity: value === '' ? null : value });
            setActionMsg('Tingkat diperbarui.');
            refreshAll();
        }
        catch (err) {
            setSeverity(previous);
            setActionError(err instanceof Error ? err.message : 'Gagal memperbarui tingkat.');
        }
        finally {
            setBusy(false);
        }
    };
    const takeCase = async () => {
        setBusy(true);
        setActionError('');
        setActionMsg('');
        try {
            const meId = await getCurrentUserId();
            if (!meId) {
                setActionError('Tidak dapat menentukan akun admin aktif.');
                return;
            }
            await updateReport(report.id, { assignedTo: meId });
            setActionMsg('Laporan ditugaskan ke Anda.');
            refreshAll();
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : 'Gagal mengambil kasus.');
        }
        finally {
            setBusy(false);
        }
    };
    const submitNote = async () => {
        if (!noteInput.trim())
            return;
        setSavingNote(true);
        setNoteError('');
        setNoteMsg('');
        try {
            await addReportNote(report.id, noteInput.trim());
            setNoteInput('');
            const n = await fetchReportNotes(report.id, 50, 0);
            setNotes(n.notes);
            setNotesState('ready');
            setNoteMsg('Catatan tersimpan.');
        }
        catch (err) {
            setNoteError(err instanceof Error ? err.message : 'Gagal menyimpan catatan.');
        }
        finally {
            setSavingNote(false);
        }
    };
    return (<div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader title={`Laporan #${shortId}`} description="Tinjau kasus, perbarui triage, dan ambil tindakan moderasi." actions={<>
            <Badge variant={statusVariant(report.status)} className="text-xs">
              {statusLabel(report.status)}
            </Badge>
            <SeverityBadge severity={report.severity}/>
            <Button type="button" variant="outline" size="sm" onClick={() => refreshAll()} disabled={busy}>
              <RefreshCw aria-hidden className="h-4 w-4"/>
              Muat ulang
            </Button>
          </>}/>

      
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Flag aria-hidden className="h-5 w-5 text-primary"/>
            </span>
            <div className="min-w-0">
              <p className={ADMIN_DETAIL_LABEL}>Kategori</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-charcoal-900">
                {report.category || '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <UserRound aria-hidden className="h-5 w-5 text-primary"/>
            </span>
            <div className="min-w-0">
              <p className={ADMIN_DETAIL_LABEL}>Ditugaskan</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-charcoal-900">
                {report.assignedToName ?? 'Belum ditugaskan'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <CalendarDays aria-hidden className="h-5 w-5 text-primary"/>
            </span>
            <div className="min-w-0">
              <p className={ADMIN_DETAIL_LABEL}>Dibuat</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-charcoal-900">
                {formatTanggalWaktu(report.createdAt)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText aria-hidden className="h-4 w-4 text-primary"/>
                Isi Laporan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {report.description?.trim() ? (<p className="max-w-prose whitespace-pre-wrap break-words rounded-[var(--radius)] bg-cream-50/70 px-5 py-4 text-sm leading-relaxed text-charcoal-900">
                  {report.description}
                </p>) : (<AdminInlineMessage>Tidak ada deskripsi.</AdminInlineMessage>)}
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Field label="Status">
                  <Badge variant={statusVariant(report.status)} className="text-xs">
                    {statusLabel(report.status)}
                  </Badge>
                </Field>
                <Field label="Tingkat">
                  <SeverityBadge severity={report.severity}/>
                </Field>
                <Field label="Diselesaikan">
                  {report.resolvedAt ? formatTanggalWaktu(report.resolvedAt) : '—'}
                </Field>
                <Field label="ID Laporan" mono>
                  <span className="break-all font-mono text-xs">{report.id}</span>
                </Field>
              </dl>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserRound aria-hidden className="h-4 w-4 text-primary"/>
                  Pelapor
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Field label="Nama">{report.reporterName}</Field>
                <Field label="Email">{report.reporterEmail ?? '—'}</Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex min-w-0 items-center gap-2">
                    <ShieldAlert aria-hidden className="h-4 w-4 text-primary"/>
                    Terlapor
                  </span>
                  {report.reportedUserId && (<Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/admin/pengguna/${report.reportedUserId}`}>
                        Profil
                        <ExternalLink aria-hidden className="h-3.5 w-3.5"/>
                      </Link>
                    </Button>)}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Field label="Nama">{report.reportedUserName}</Field>
                <Field label="Email">{report.reportedUserEmail ?? '—'}</Field>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle aria-hidden className="h-4 w-4 text-primary"/>
                Konteks Pendukung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <InlineSectionState state={activityState} loadingLabel="Memuat konteks aktivitas" errorLabel="Konteks aktivitas gagal dimuat." emptyLabel={report.activityId
            ? `Aktivitas ${report.activityId.slice(0, 8)}… tidak ditemukan.`
            : 'Tidak ada aktivitas terkait.'} isEmpty={!activityLog} onRetry={() => setReloadToken((t) => t + 1)}>
                {activityLog && (<div className="rounded-[var(--radius)] border border-border/70 bg-cream-50/60 px-5 py-4">
                    <p className="text-sm font-semibold text-charcoal-900">
                      {labelAktivitas(activityLog.activityType)}
                    </p>
                    <p className="mt-1 break-words text-sm leading-relaxed text-charcoal-700">
                      {activityLog.description}
                    </p>
                    <p className="mt-1.5 text-xs text-sage-500">
                      {formatTanggalWaktu(activityLog.createdAt)}
                    </p>
                  </div>)}
              </InlineSectionState>

              <div>
                <p className={ADMIN_DETAIL_LABEL}>Peringatan terkait</p>
                <div className="mt-2">
                  <InlineSectionState state={warningsState} loadingLabel="Memuat peringatan" errorLabel="Peringatan terkait gagal dimuat." emptyLabel="Tidak ada peringatan terkait laporan ini." isEmpty={linkedWarnings.length === 0} onRetry={() => setReloadToken((t) => t + 1)}>
                    <ul className="space-y-3">
                      {linkedWarnings.map((w) => (<li key={w.id} className="rounded-[var(--radius)] border border-warning/30 bg-warning/[0.06] px-5 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-charcoal-900">
                              Peringatan {w.warningLevel}/3
                            </span>
                            <span className="text-xs text-sage-500">
                              {formatTanggalWaktu(w.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-charcoal-700">{w.category}</p>
                        </li>))}
                    </ul>
                  </InlineSectionState>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 aria-hidden className="h-4 w-4 text-primary"/>
                Triage & Tindakan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className={ADMIN_DETAIL_LABEL}>Tingkat laporan</span>
                  <select value={severity} onChange={(e) => applySeverity(e.target.value as ReportSeverity | '')} disabled={busy} className="h-10 w-full min-w-0 rounded-[var(--radius)] border border-border bg-white px-3 text-sm font-medium text-charcoal-900 transition-colors hover:border-sage-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 sm:w-56">
                    {SEVERITY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>
                        {o.label}
                      </option>))}
                  </select>
                </label>
                <Button type="button" variant="outline" disabled={busy} onClick={takeCase}>
                  Ambil kasus
                </Button>
              </div>

              <div>
                <p className={ADMIN_DETAIL_LABEL}>Ubah status</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => doStatus('reviewing')}>
                    Tandai ditinjau
                  </Button>
                  <Button type="button" disabled={busy} onClick={() => doStatus('resolved')}>
                    Selesaikan
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => doStatus('dismissed')}>
                    Tolak
                  </Button>
                </div>
              </div>

              <div>
                <p className={ADMIN_DETAIL_LABEL}>Moderasi</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setWarningOpen(true)}>
                    Beri peringatan
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setSanctionOpen(true)}>
                    Beri sanksi
                  </Button>
                </div>
              </div>

              {actionMsg && (<p role="status" className="text-xs font-semibold text-success">
                  {actionMsg}
                </p>)}
              {actionError && <AdminInlineError message={actionError}/>}
            </CardContent>
          </Card>
        </div>

        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History aria-hidden className="h-4 w-4 text-primary"/>
                Riwayat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InlineSectionState state={auditState} loadingLabel="Memuat riwayat" errorLabel="Riwayat audit gagal dimuat." emptyLabel="Belum ada riwayat." isEmpty={timeline.length === 0} onRetry={() => setReloadToken((t) => t + 1)}>
                <ol className="relative space-y-4 border-l border-border/70 pl-5">
                  {timeline.map((item, idx) => (<li key={idx} className="relative">
                      <span aria-hidden className="absolute -left-[1.57rem] top-1.5 h-2 w-2 rounded-full border-2 border-white bg-primary/60"/>
                      <p className="text-sm leading-snug text-charcoal-900">{item.label}</p>
                      <p className="mt-0.5 text-xs text-sage-500">
                        {formatTanggalWaktu(item.at)}
                      </p>
                    </li>))}
                </ol>
              </InlineSectionState>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquareQuote aria-hidden className="h-4 w-4 text-primary"/>
                Catatan Internal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InlineSectionState state={notesState} loadingLabel="Memuat catatan" errorLabel="Catatan gagal dimuat." emptyLabel="Belum ada catatan." isEmpty={notes.length === 0} onRetry={() => setReloadToken((t) => t + 1)}>
                <div className="space-y-3">
                  {notes.map((n) => (<div key={n.id} className="rounded-[var(--radius)] border border-border/70 bg-cream-50/60 px-5 py-4">
                      <p className="break-words text-sm leading-relaxed text-charcoal-700">
                        {n.note}
                      </p>
                      <p className="mt-1.5 text-xs text-sage-500">
                        {n.adminName} · {formatTanggalWaktu(n.createdAt)}
                      </p>
                    </div>))}
                </div>
              </InlineSectionState>

              <div className="border-t border-border/60 pt-4">
                <label htmlFor="report-note-input" className="flex flex-col gap-1.5">
                  <span className={ADMIN_DETAIL_LABEL}>Catatan baru</span>
                  <Textarea id="report-note-input" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Tambah catatan internal…" rows={3} className="rounded-[var(--radius)] border-border bg-white text-sm"/>
                </label>
                <div className="mt-3">
                  <Button type="button" disabled={savingNote || !noteInput.trim()} onClick={submitNote}>
                    {savingNote ? 'Menyimpan…' : 'Simpan catatan'}
                  </Button>
                </div>
                {noteMsg && (<p role="status" className="mt-2 text-xs font-semibold text-success">
                    {noteMsg}
                  </p>)}
                {noteError && (<div className="mt-2">
                    <AdminInlineError message={noteError}/>
                  </div>)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <IssueWarningModal open={warningOpen} onOpenChange={setWarningOpen} userId={report.reportedUserId} userName={report.reportedUserName} reportId={report.id} onSuccess={refreshAll}/>
      <SanctionDecisionModal open={sanctionOpen} onOpenChange={setSanctionOpen} userId={report.reportedUserId} userName={report.reportedUserName} onSuccess={refreshAll}/>
    </div>);
}
