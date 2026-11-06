'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, RefreshCw, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Textarea } from '@/app/components/ui/textarea';
import {
  addReportNote,
  fetchReportNotes,
  updateReport,
  type ReportItem,
  type ReportNote,
  type ReportSeverity,
} from '@/lib/admin-reports';
import { fetchActivityLogs, type ActivityLogItem } from '@/lib/admin-activity-logs';
import { fetchAuditLogs, type AuditLogItem } from '@/lib/admin-audit-logs';
import { fetchWarnings, type WarningItem } from '@/lib/admin-warnings';
import { getCurrentUserId } from '@/lib/current-user';
import { formatTanggalWaktu, labelAktivitas } from './admin-format';
import { ADMIN_PAGE_EYEBROW } from './admin-page-header';
import { AdminInlineError, AdminInlineLoading, AdminInlineMessage } from './admin-state';
import {
  AdminDetailField,
  AdminDetailGrid,
  AdminDetailSection,
  AdminDetailText,
  ADMIN_DETAIL_LABEL,
} from './admin-detail';
import { IssueWarningModal } from './issue-warning-modal';
import { SanctionDecisionModal } from './sanction-decision-modal';

const SEVERITY_OPTIONS: { value: ReportSeverity | ''; label: string }[] = [
  { value: '', label: 'Tanpa tingkat' },
  { value: 'low', label: 'Rendah' },
  { value: 'medium', label: 'Sedang' },
  { value: 'high', label: 'Tinggi' },
  { value: 'critical', label: 'Kritis' },
];

function SeverityBadge({ severity }: { severity: string | null }) {
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
      // `secondary` (bukan `outline`): varian outline memakai `text-caramel`
      // yang hanya ~2.1:1 di atas putih. Makna "tanpa tingkat" tetap netral.
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

function statusVariant(
  status: string
): 'default' | 'secondary' | 'success' | 'warning' | 'outline' {
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

interface Props {
  report: ReportItem | null;
  onClose: () => void;
  onChanged?: () => void;
}

/**
 * Status pemuatan per sumber data drawer. Dipisah per sumber supaya
 * kegagalan satu endpoint tidak tampil sebagai "data kosong" pada bagian lain.
 */
type SectionState = 'loading' | 'ready' | 'error';

export function ReportDetailDrawer({ report, onClose, onChanged }: Props) {
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

  // State per sumber data (bukan satu flag global): kegagalan fetch tidak
  // boleh menyamar sebagai "belum ada data".
  const [notesState, setNotesState] = useState<SectionState>('loading');
  const [warningsState, setWarningsState] = useState<SectionState>('loading');
  const [auditState, setAuditState] = useState<SectionState>('loading');
  const [activityState, setActivityState] = useState<SectionState>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  // Feedback khusus penyimpanan catatan — ditampilkan DI DEKAT textarea,
  // terpisah dari pesan aksi triage di footer.
  const [noteMsg, setNoteMsg] = useState('');
  const [noteError, setNoteError] = useState('');

  const reportId = report?.id ?? null;

  const drawerRef = useRef<HTMLElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    if (!reportId) return;

    setNotesState('loading');
    setWarningsState('loading');
    setAuditState('loading');

    // allSettled: satu endpoint gagal tidak membatalkan dua lainnya.
    const [notesRes, warningsRes, auditRes] = await Promise.allSettled([
      fetchReportNotes(reportId, 50, 0),
      fetchWarnings(20, 0, undefined, { reportId }),
      fetchAuditLogs(20, 0, { targetType: 'report', targetId: reportId }),
    ]);

    if (notesRes.status === 'fulfilled') {
      setNotes(notesRes.value.notes);
      setNotesState('ready');
    } else {
      setNotes([]);
      setNotesState('error');
    }

    if (warningsRes.status === 'fulfilled') {
      setLinkedWarnings(warningsRes.value.warnings);
      setWarningsState('ready');
    } else {
      setLinkedWarnings([]);
      setWarningsState('error');
    }

    if (auditRes.status === 'fulfilled') {
      setAuditRows(auditRes.value.logs);
      setAuditState('ready');
    } else {
      setAuditRows([]);
      setAuditState('error');
    }
  }, [reportId]);

  // Sinkronkan pilihan tingkat dengan nilai yang dikonfirmasi server.
  // Berjalan saat drawer dibuka dan setiap kali data laporan di-refresh
  // induk setelah aksi berhasil.
  useEffect(() => {
    setSeverity((report?.severity as ReportSeverity | null) ?? '');
  }, [reportId, report?.severity]);

  // Reset saat drawer BERPINDAH laporan (bukan saat objek laporan di-refresh),
  // supaya pesan sukses tidak langsung terhapus oleh reload induk.
  useEffect(() => {
    setWarningOpen(false);
    setSanctionOpen(false);
    setNoteInput('');
    setNoteMsg('');
    setNoteError('');
    setActionMsg('');
    setActionError('');
  }, [reportId]);

  // Muat data saat laporan berganti atau saat diminta ulang (retry / setelah
  // modal peringatan & sanksi).
  useEffect(() => {
    if (!reportId) return;
    void load();
  }, [reportId, load, reloadToken]);

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
    } catch {
      setActivityLog(null);
      setActivityState('error');
    }
  }, [report?.activityId]);

  useEffect(() => {
    void reloadActivity();
  }, [reloadActivity, reloadToken]);

  // Fokus awal ke panel + kembalikan fokus ke pemicu saat drawer ditutup.
  // Depends on reportId (bukan objek report) supaya refresh data laporan
  // tidak memindahkan fokus keluar-masuk drawer.
  // Catatan: fokus tidak dijebak — lihat batasan yang dilaporkan.
  useEffect(() => {
    if (!reportId) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const id = window.setTimeout(() => drawerRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      previouslyFocused.current?.focus?.();
    };
  }, [reportId]);

  // Escape menutup drawer — kecuali saat modal (peringatan/sanksi) sedang
  // terbuka, agar tidak menutup dua lapisan sekaligus.
  useEffect(() => {
    if (!report) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (warningOpen || sanctionOpen) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [report, onClose, warningOpen, sanctionOpen]);

  const timeline = useMemo(() => {
    if (!report) return [];
    const items: { at: string; label: string }[] = [];
    if (report.createdAt) items.push({ at: report.createdAt, label: 'Laporan dibuat' });
    for (const row of auditRows) {
      if (row.action === 'update_report_triage') {
        const to = row.metadata?.to as Record<string, unknown> | undefined;
        const from = row.metadata?.from as Record<string, unknown> | undefined;
        const parts: string[] = [];
        if (to && from) {
          if (to.severity !== from.severity)
            parts.push(`tingkat ke ${String(to.severity ?? 'Tanpa tingkat')}`);
          if (to.assigned_to !== from.assigned_to) parts.push('penugasan berubah');
        }
        items.push({
          at: row.createdAt,
          label: `Triage diperbarui: ${parts.join(', ') || 'diperbarui'}`,
        });
      } else if (row.action === 'resolve_report') {
        items.push({ at: row.createdAt, label: 'Laporan diselesaikan' });
      } else if (row.action === 'dismiss_report') {
        items.push({ at: row.createdAt, label: 'Laporan ditolak' });
      }
    }
    if (
      !auditRows.some((r) => r.action === 'resolve_report') &&
      report.resolvedAt &&
      report.status === 'resolved'
    ) {
      items.push({ at: report.resolvedAt, label: 'Laporan diselesaikan' });
    }
    if (
      !auditRows.some((r) => r.action === 'dismiss_report') &&
      report.resolvedAt &&
      report.status === 'dismissed'
    ) {
      items.push({ at: report.resolvedAt, label: 'Laporan ditolak' });
    }
    for (const w of linkedWarnings) {
      items.push({
        at: w.createdAt,
        label: `Peringatan '${w.warningLevel} / 3 diterbitkan (${w.category})`,
      });
    }
    return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [report, auditRows, linkedWarnings]);

  if (!report) return null;

  const shortId = report.id.slice(0, 8);

  const doStatus = async (next: 'reviewing' | 'resolved' | 'dismissed') => {
    setBusy(true);
    setActionError('');
    setActionMsg('');
    try {
      await updateReport(report.id, { status: next });
      setActionMsg(`Status diubah ke ${statusLabel(next)}.`);
      onChanged?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal memperbarui status.');
    } finally {
      setBusy(false);
    }
  };

  const applySeverity = async (value: ReportSeverity | '') => {
    // Nilai yang terakhir dikonfirmasi server: dipakai untuk rollback UI bila
    // permintaan gagal, supaya select tidak menampilkan nilai yang ditolak.
    const previous = (report.severity as ReportSeverity | null) ?? '';
    setSeverity(value);
    setBusy(true);
    setActionError('');
    setActionMsg('');
    try {
      await updateReport(report.id, { severity: value === '' ? null : value });
      setActionMsg('Tingkat diperbarui.');
      onChanged?.();
    } catch (err) {
      setSeverity(previous);
      setActionError(err instanceof Error ? err.message : 'Gagal memperbarui tingkat.');
    } finally {
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
      onChanged?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mengambil kasus.');
    } finally {
      setBusy(false);
    }
  };

  const submitNote = async () => {
    if (!noteInput.trim()) return;
    setSavingNote(true);
    // Percobaan baru: bersihkan pesan lama agar tidak menyesatkan.
    setNoteError('');
    setNoteMsg('');
    try {
      await addReportNote(report.id, noteInput.trim());
      setNoteInput('');
      const n = await fetchReportNotes(report.id, 50, 0);
      setNotes(n.notes);
      setNotesState('ready');
      setNoteMsg('Catatan tersimpan.');
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Gagal menyimpan catatan.');
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Tutup detail laporan"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-detail-title"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[var(--radius)] bg-white shadow-xl outline-none sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-full sm:max-w-2xl sm:rounded-none sm:border-l sm:border-border/70"
      >
        {/* Header: identitas + status utama */}
        <header className="shrink-0 border-b border-border/70 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={ADMIN_PAGE_EYEBROW}>Detail Laporan</p>
              <h2
                id="report-detail-title"
                className="mt-1 truncate font-display text-xl font-semibold tracking-tight text-charcoal-900"
              >
                Laporan #{shortId}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(report.status)} className="text-xs">
                  {statusLabel(report.status)}
                </Badge>
                <SeverityBadge severity={report.severity} />
                <Badge variant="secondary" className="text-xs">
                  {report.assignedToName
                    ? `Ditugaskan: ${report.assignedToName}`
                    : 'Belum ditugaskan'}
                </Badge>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full bg-cream-50 p-2 text-charcoal-500 transition-colors hover:bg-cream-100 hover:text-charcoal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Body: satu kolom di HP, dua kolom di layar lebar */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-6">
            <div className="space-y-5">
              <AdminDetailSection title="Informasi laporan">
                <AdminDetailGrid>
                  <AdminDetailField label="Kategori">
                    {report.category || '—'}
                  </AdminDetailField>
                  <AdminDetailField label="Tingkat">
                    <SeverityBadge severity={report.severity} />
                  </AdminDetailField>
                  <AdminDetailField label="Status">
                    <Badge variant={statusVariant(report.status)} className="text-xs">
                      {statusLabel(report.status)}
                    </Badge>
                  </AdminDetailField>
                  <AdminDetailField label="Ditugaskan kepada">
                    {report.assignedToName ?? 'Belum ditugaskan'}
                  </AdminDetailField>
                  <AdminDetailField label="Dibuat">
                    {formatTanggalWaktu(report.createdAt)}
                  </AdminDetailField>
                  <AdminDetailField label="Diselesaikan">
                    {report.resolvedAt ? formatTanggalWaktu(report.resolvedAt) : '—'}
                  </AdminDetailField>
                </AdminDetailGrid>
              </AdminDetailSection>

              <AdminDetailSection title="Isi laporan">
                {report.description?.trim() ? (
                  <AdminDetailText>{report.description}</AdminDetailText>
                ) : (
                  <AdminInlineMessage>Tidak ada deskripsi.</AdminInlineMessage>
                )}
              </AdminDetailSection>

              <AdminDetailSection title="Pelapor">
                <AdminDetailGrid>
                  <AdminDetailField label="Nama">
                    {report.reporterName}
                  </AdminDetailField>
                  <AdminDetailField label="Email">
                    {report.reporterEmail ?? '—'}
                  </AdminDetailField>
                </AdminDetailGrid>
              </AdminDetailSection>

              <AdminDetailSection
                title="Terlapor"
                actions={
                  report.reportedUserId ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/admin/pengguna/${report.reportedUserId}`}>
                        Lihat profil
                        <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  ) : undefined
                }
              >
                <AdminDetailGrid>
                  <AdminDetailField label="Nama">
                    {report.reportedUserName}
                  </AdminDetailField>
                  <AdminDetailField label="Email">
                    {report.reportedUserEmail ?? '—'}
                  </AdminDetailField>
                </AdminDetailGrid>
              </AdminDetailSection>

              <AdminDetailSection
                title="Konteks pendukung"
                description="Aktivitas dan peringatan yang terkait laporan ini."
              >
                <div className="space-y-2">
                  {activityState === 'loading' && <AdminInlineLoading label="Memuat konteks" />}
                  {activityState === 'error' && (
                    <AdminInlineError message="Konteks aktivitas gagal dimuat." />
                  )}
                  {activityState === 'ready' && activityLog && (
                    <div className="rounded-[var(--radius)] border border-border/70 bg-cream-50/60 px-4 py-3">
                      <p className="text-sm font-semibold text-charcoal-900">
                        {labelAktivitas(activityLog.activityType)}
                      </p>
                      <p className="mt-0.5 break-words text-sm leading-relaxed text-charcoal-700">
                        {activityLog.description}
                      </p>
                      <p className="mt-1 text-xs text-sage-500">
                        {formatTanggalWaktu(activityLog.createdAt)}
                      </p>
                    </div>
                  )}
                  {activityState === 'ready' && !activityLog && (
                    <AdminInlineMessage>
                      {report.activityId
                        ? `Aktivitas ${report.activityId.slice(0, 8)}… tidak ditemukan.`
                        : 'Tidak ada aktivitas terkait.'}
                    </AdminInlineMessage>
                  )}

                  {warningsState === 'loading' && (
                    <AdminInlineLoading label="Memuat peringatan terkait" />
                  )}
                  {warningsState === 'error' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminInlineError message="Peringatan terkait gagal dimuat." />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReloadToken((t) => t + 1)}
                      >
                        <RefreshCw aria-hidden className="h-4 w-4" />
                        Coba lagi
                      </Button>
                    </div>
                  )}
                  {warningsState === 'ready' && linkedWarnings.length === 0 && (
                    <AdminInlineMessage>Tidak ada peringatan terkait laporan ini.</AdminInlineMessage>
                  )}
                  {warningsState === 'ready' && linkedWarnings.length > 0 && (
                    <ul className="space-y-2">
                      {linkedWarnings.map((w) => (
                        <li
                          key={w.id}
                          className="rounded-[var(--radius)] border border-warning/30 bg-warning/[0.06] px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-charcoal-900">
                              Peringatan {w.warningLevel}/3
                            </span>
                            <span className="text-xs text-sage-500">
                              {formatTanggalWaktu(w.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-charcoal-700">{w.category}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </AdminDetailSection>
            </div>

            <div className="mt-5 space-y-5 lg:mt-0 lg:border-l lg:border-border/70 lg:pl-6">
              <AdminDetailSection title="Riwayat">
                {auditState === 'loading' && <AdminInlineLoading label="Memuat riwayat" />}
                {auditState === 'error' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminInlineError message="Riwayat audit gagal dimuat." />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReloadToken((t) => t + 1)}
                    >
                      <RefreshCw aria-hidden className="h-4 w-4" />
                      Coba lagi
                    </Button>
                  </div>
                )}
                {auditState === 'ready' && timeline.length === 0 && (
                  <AdminInlineMessage>Belum ada riwayat.</AdminInlineMessage>
                )}
                {auditState === 'ready' && timeline.length > 0 && (
                  <ol className="space-y-3">
                    {timeline.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span
                          aria-hidden
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm leading-snug text-charcoal-900">
                            {item.label}
                          </span>
                          <span className="block text-xs text-sage-500">
                            {formatTanggalWaktu(item.at)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </AdminDetailSection>

              <AdminDetailSection title="Catatan internal">
                <div className="space-y-2">
                  {notesState === 'loading' && <AdminInlineLoading label="Memuat catatan" />}
                  {notesState === 'error' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminInlineError message="Catatan gagal dimuat." />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReloadToken((t) => t + 1)}
                      >
                        <RefreshCw aria-hidden className="h-4 w-4" />
                        Coba lagi
                      </Button>
                    </div>
                  )}
                  {notesState === 'ready' && notes.length === 0 && (
                    <AdminInlineMessage>Belum ada catatan.</AdminInlineMessage>
                  )}
                  {notesState === 'ready' &&
                    notes.map((n) => (
                      <div
                        key={n.id}
                        className="rounded-[var(--radius)] border border-border/70 bg-cream-50/60 px-4 py-3"
                      >
                        <p className="break-words text-sm leading-relaxed text-charcoal-700">
                          {n.note}
                        </p>
                        <p className="mt-1 text-xs text-sage-500">
                          {n.adminName} · {formatTanggalWaktu(n.createdAt)}
                        </p>
                      </div>
                    ))}
                </div>
                <div className="mt-3">
                  <label htmlFor="report-note-input" className="flex flex-col gap-1.5">
                    <span className={ADMIN_DETAIL_LABEL}>Catatan baru</span>
                    <Textarea
                      id="report-note-input"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Tambah catatan internal…"
                      rows={3}
                      className="rounded-[var(--radius)] border-border bg-white text-sm"
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      disabled={savingNote || !noteInput.trim()}
                      onClick={submitNote}
                    >
                      {savingNote ? 'Menyimpan…' : 'Simpan catatan'}
                    </Button>
                  </div>
                  {/* Feedback diletakkan tepat di bawah textarea, bukan di footer. */}
                  {noteMsg && (
                    <p role="status" className="mt-2 text-xs font-semibold text-success">
                      {noteMsg}
                    </p>
                  )}
                  {noteError && (
                    <div className="mt-2">
                      <AdminInlineError message={noteError} />
                    </div>
                  )}
                </div>
              </AdminDetailSection>
            </div>
          </div>
        </div>

        {/* Footer: triage + tindakan. Dikelompokkan agar tidak saling berebut. */}
        <footer className="shrink-0 border-t border-border/70 bg-cream-50/50 px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={ADMIN_DETAIL_LABEL}>Tingkat laporan</span>
              <select
                value={severity}
                onChange={(e) => applySeverity(e.target.value as ReportSeverity | '')}
                disabled={busy}
                className="h-10 w-full min-w-0 rounded-[var(--radius)] border border-border bg-white px-3 text-sm font-medium text-charcoal-900 transition-colors hover:border-sage-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 sm:w-auto"
              >
                {SEVERITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="outline" disabled={busy} onClick={takeCase}>
              Ambil kasus
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
            <span className={`${ADMIN_DETAIL_LABEL} w-full sm:w-auto`}>Status</span>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => doStatus('reviewing')}
            >
              Tandai ditinjau
            </Button>
            <Button type="button" disabled={busy} onClick={() => doStatus('resolved')}>
              Selesaikan
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => doStatus('dismissed')}
            >
              Tolak
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`${ADMIN_DETAIL_LABEL} w-full sm:w-auto`}>Moderasi</span>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setWarningOpen(true)}
            >
              Beri peringatan
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setSanctionOpen(true)}
            >
              Beri sanksi
            </Button>
          </div>

          {actionMsg && (
            <p role="status" className="mt-3 text-xs font-semibold text-success">
              {actionMsg}
            </p>
          )}
          {actionError && (
            <div className="mt-3">
              <AdminInlineError message={actionError} />
            </div>
          )}
        </footer>
      </aside>

      <IssueWarningModal
        open={warningOpen}
        onOpenChange={setWarningOpen}
        userId={report.reportedUserId}
        userName={report.reportedUserName}
        reportId={report.id}
        onSuccess={() => {
          setReloadToken((t) => t + 1);
          onChanged?.();
        }}
      />
      <SanctionDecisionModal
        open={sanctionOpen}
        onOpenChange={setSanctionOpen}
        userId={report.reportedUserId}
        userName={report.reportedUserName}
        onSuccess={() => {
          setReloadToken((t) => t + 1);
          onChanged?.();
        }}
      />
    </div>
  );
}
