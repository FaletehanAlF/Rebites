'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Flag, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER, } from './admin-page-header';
import { AdminEmptyState, AdminErrorState, AdminForbiddenState, AdminLoadingState, } from './admin-state';
import { AdminDateRange, AdminPagination, AdminSearchInput, AdminSelect, AdminToolbar, } from './admin-controls';
import { AdminTableCard, AdminTableHead, AdminTd, AdminTdActions, AdminTdCode, AdminTdPrimary, AdminTh, AdminTr, } from './admin-table';
import { formatTanggalWaktu } from './admin-format';
import { REPORT_SEVERITIES, REPORT_STATUSES, ReportsApiError, downloadReportsExcel, fetchReports, type ReportItem, type ReportSeverity, type ReportStatus, } from '@/lib/admin-reports';
import { redirectIfSessionExpired } from './admin-session';
import { isAbortError } from '@/lib/admin-export';
const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;
const STATUS_FILTERS: {
    value: string;
    label: string;
}[] = [
    { value: '', label: 'Semua' },
    { value: 'open', label: 'Terbuka' },
    { value: 'reviewing', label: 'Ditinjau' },
    { value: 'resolved', label: 'Selesai' },
    { value: 'dismissed', label: 'Ditolak' },
];
const SEVERITY_FILTERS: {
    value: string;
    label: string;
}[] = [
    { value: '', label: 'Semua' },
    { value: 'low', label: 'Rendah' },
    { value: 'medium', label: 'Sedang' },
    { value: 'high', label: 'Tinggi' },
    { value: 'critical', label: 'Kritis' },
];
const ASSIGNED_FILTERS: {
    value: string;
    label: string;
}[] = [
    { value: '', label: 'Semua' },
    { value: 'assigned', label: 'Ditugaskan' },
    { value: 'unassigned', label: 'Belum' },
];
function statusBadgeVariant(status: string): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' {
    switch (status.toLowerCase()) {
        case 'open':
            return 'warning';
        case 'reviewing':
            return 'default';
        case 'resolved':
            return 'success';
        case 'dismissed':
            return 'secondary';
        default:
            return 'outline';
    }
}
function statusLabel(status: string): string {
    switch (status.toLowerCase()) {
        case 'open':
            return 'Terbuka';
        case 'reviewing':
            return 'Ditinjau';
        case 'resolved':
            return 'Selesai';
        case 'dismissed':
            return 'Ditolak';
        default:
            return status || '-';
    }
}
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
            return <span className="text-xs text-sage-500">—</span>;
    }
}
export function ReportsView() {
    const router = useRouter();
    const [items, setItems] = useState<ReportItem[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [statusFilter, setStatusFilter] = useState<ReportStatus | null>(null);
    const [severityFilter, setSeverityFilter] = useState<ReportSeverity | null>(null);
    const [assignedFilter, setAssignedFilter] = useState<'assigned' | 'unassigned' | null>(null);
    const [q, setQ] = useState('');
    const [qApplied, setQApplied] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const requestIdRef = useRef(0);
    const lastRequestedOffsetRef = useRef(0);
    const exportAbortRef = useRef<AbortController | null>(null);
    const [exporting, setExporting] = useState(false);
    const [exportFeedback, setExportFeedback] = useState<{
        tone: 'success' | 'info' | 'error';
        message: string;
    } | null>(null);
    const filterOptions = useMemo(() => ({
        severity: severityFilter ?? undefined,
        assigned: assignedFilter ?? undefined,
        q: qApplied || undefined,
        from: from || undefined,
        to: to || undefined,
    }), [severityFilter, assignedFilter, qApplied, from, to]);
    useEffect(() => {
        const controller = exportAbortRef.current;
        if (controller) {
            exportAbortRef.current = null;
            controller.abort();
            setExportFeedback({
                tone: 'info',
                message: 'Ekspor dibatalkan karena filter berubah. Jalankan ekspor lagi untuk filter terbaru.',
            });
            return;
        }
        setExportFeedback(null);
    }, [filterOptions, statusFilter]);
    useEffect(() => {
        return () => exportAbortRef.current?.abort();
    }, []);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (!params.size)
            return;
        const statusParam = params.get('status');
        if (statusParam && (REPORT_STATUSES as readonly string[]).includes(statusParam)) {
            setStatusFilter(statusParam as ReportStatus);
        }
        const severityParam = params.get('severity');
        if (severityParam && REPORT_SEVERITIES.includes(severityParam as ReportSeverity)) {
            setSeverityFilter(severityParam as ReportSeverity);
        }
        const assignedParam = params.get('assigned');
        if (assignedParam === 'assigned' || assignedParam === 'unassigned') {
            setAssignedFilter(assignedParam);
        }
        const categoryParam = params.get('category');
        const qParam = params.get('q');
        const initialQuery = qParam || categoryParam;
        if (initialQuery) {
            setQ(initialQuery);
            setQApplied(initialQuery);
        }
        const fromParam = params.get('from');
        if (fromParam)
            setFrom(fromParam);
        const toParam = params.get('to');
        if (toParam)
            setTo(toParam);
    }, []);
    useEffect(() => {
        const timer = setTimeout(() => {
            setQApplied(q.trim());
            setOffset(0);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [q]);
    const load = useCallback(async (nextOffset: number) => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        lastRequestedOffsetRef.current = nextOffset;
        setStatus('loading');
        setErrorMsg('');
        try {
            const result = await fetchReports(PAGE_LIMIT, nextOffset, statusFilter ?? undefined, filterOptions);
            if (requestId !== requestIdRef.current)
                return;
            setItems(result.reports);
            setTotal(result.total);
            setOffset(result.offset);
            setStatus('ready');
        }
        catch (err) {
            if (requestId !== requestIdRef.current)
                return;
            const handled = await redirectIfSessionExpired((err as {
                status?: number;
            })?.status ?? 0, router, () => {
                setErrorMsg('Tidak dapat menghubungi server data. Coba lagi.');
                setStatus('error');
            });
            if (requestId !== requestIdRef.current)
                return;
            if (handled)
                return;
            if (err instanceof ReportsApiError && err.status === 403) {
                setStatus('forbidden');
                return;
            }
            setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat laporan.');
            setStatus('error');
        }
    }, [router, statusFilter, filterOptions]);
    useEffect(() => {
        load(0);
    }, [load]);
    const openDetail = useCallback((item: ReportItem) => {
        router.push(`/dashboard/admin/monitoring/laporan/${item.id}`);
    }, [router]);
    const handleExport = useCallback(async () => {
        const controller = new AbortController();
        exportAbortRef.current = controller;
        setExporting(true);
        setExportFeedback(null);
        try {
            const result = await downloadReportsExcel(statusFilter, filterOptions, controller.signal);
            if (exportAbortRef.current === controller)
                exportAbortRef.current = null;
            if (controller.signal.aborted)
                return;
            if (!result.downloaded) {
                setExportFeedback({
                    tone: 'info',
                    message: 'Tidak ada laporan yang cocok dengan filter saat ini. Berkas Excel tidak dibuat.',
                });
                return;
            }
            setExportFeedback({
                tone: 'success',
                message: result.rows > 0
                    ? `${result.rows.toLocaleString('id-ID')} laporan diunduh sebagai Excel.`
                    : 'Berkas Excel berhasil diunduh.',
            });
        }
        catch (err) {
            if (isAbortError(err))
                return;
            const handled = await redirectIfSessionExpired((err as {
                status?: number;
            })?.status ?? 0, router, () => {
                setExportFeedback({
                    tone: 'error',
                    message: 'Tidak dapat menghubungi server data. Coba lagi.',
                });
            });
            if (handled)
                return;
            if (err instanceof ReportsApiError && err.status === 403) {
                setExportFeedback({ tone: 'error', message: 'Ekspor laporan hanya untuk admin.' });
                return;
            }
            setExportFeedback({
                tone: 'error',
                message: err instanceof Error ? err.message : 'Gagal membuat ekspor laporan.',
            });
        }
        finally {
            if (exportAbortRef.current === controller)
                exportAbortRef.current = null;
            setExporting(false);
        }
    }, [filterOptions, router, statusFilter]);
    const hasActiveFilter = statusFilter !== null ||
        severityFilter !== null ||
        assignedFilter !== null ||
        qApplied.trim() !== '' ||
        from !== '' ||
        to !== '';
    return (<div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader title="Laporan" actions={<>
            <Badge variant="secondary" className="text-xs">
              {total} laporan
            </Badge>
            <Button type="button" variant="outline" onClick={handleExport} disabled={exporting || status === 'loading' || status === 'forbidden'} aria-busy={exporting} title="Unduh berkas Excel (.xlsx) dengan filter yang sedang aktif (maksimum 5.000 laporan)">
              <Download aria-hidden className="h-4 w-4"/>
              {exporting ? 'Menyiapkan Excel…' : 'Ekspor Excel'}
            </Button>
            <Button type="button" variant="outline" onClick={() => load(offset)} disabled={status === 'loading'}>
              <RefreshCw aria-hidden className="h-4 w-4"/>
              Muat ulang
            </Button>
          </>}/>

      {exportFeedback && (<p role={exportFeedback.tone === 'error' ? 'alert' : 'status'} className={cn('mb-4 rounded-[var(--radius)] border px-4 py-3 text-sm', exportFeedback.tone === 'error'
                ? 'border-destructive/30 bg-destructive/5 text-destructive'
                : exportFeedback.tone === 'success'
                    ? 'border-success/30 bg-success/5 text-charcoal-900'
                    : 'border-border bg-white text-sage-500')}>
          {exportFeedback.message}
        </p>)}

      
      <AdminToolbar>
        <AdminSearchInput value={q} onChange={setQ} label="Cari" labelVisible placeholder="Cari deskripsi atau kategori…"/>
        <AdminSelect value={statusFilter ?? ''} onChange={(value) => {
            setStatusFilter((value || null) as ReportStatus | null);
            setOffset(0);
        }} label="Status" options={STATUS_FILTERS}/>
        <AdminSelect value={severityFilter ?? ''} onChange={(value) => setSeverityFilter((value || null) as ReportSeverity | null)} label="Tingkat" options={SEVERITY_FILTERS}/>
        <AdminSelect value={assignedFilter ?? ''} onChange={(value) => setAssignedFilter((value || null) as 'assigned' | 'unassigned' | null)} label="Penugasan" options={ASSIGNED_FILTERS}/>
        <AdminDateRange from={from} to={to} onFromChange={setFrom} onToChange={setTo}/>
      </AdminToolbar>
      
      {(statusFilter || severityFilter || assignedFilter || from || to || qApplied) && (<div className="mb-4 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => {
                setStatusFilter(null);
                setSeverityFilter(null);
                setAssignedFilter(null);
                setFrom('');
                setTo('');
                setQ('');
                setQApplied('');
            }}>
            <RefreshCw aria-hidden className="h-3.5 w-3.5"/>
            Atur ulang filter
          </Button>
        </div>)}

      {status === 'loading' && <AdminLoadingState label="Memuat laporan"/>}

      {status === 'forbidden' && (<AdminForbiddenState message="Halaman ini hanya untuk admin."/>)}

      {status === 'error' && (<AdminErrorState title="Gagal memuat laporan" message={errorMsg} onRetry={() => load(lastRequestedOffsetRef.current)}/>)}

      {status === 'ready' && items.length === 0 && (<AdminEmptyState icon={<Flag aria-hidden className="h-10 w-10 text-primary"/>} title={hasActiveFilter ? 'Laporan tidak ditemukan' : 'Belum ada laporan'} description={hasActiveFilter
                ? 'Tidak ada laporan yang cocok dengan filter saat ini. Ubah filter atau atur ulang pencarian.'
                : 'Laporan dari pengguna akan muncul di sini.'}/>)}

      {status === 'ready' && items.length > 0 && (<>
          <AdminTableCard label="Daftar laporan" minWidth={960} className="hidden sm:block">
            <AdminTableHead>
              <AdminTh>ID Laporan</AdminTh>
              <AdminTh>Pelapor</AdminTh>
              <AdminTh>Terlapor</AdminTh>
              <AdminTh>Kategori</AdminTh>
              <AdminTh>Tingkat</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Ditugaskan</AdminTh>
              <AdminTh>Dibuat</AdminTh>
              <AdminTh className="text-right">Aksi</AdminTh>
            </AdminTableHead>
            <tbody>
              {items.map((item) => (<AdminTr key={item.id} className="cursor-pointer" onClick={() => openDetail(item)}>
                  <AdminTdCode title={item.id}>{item.id.slice(0, 8)}…</AdminTdCode>
                  <AdminTdPrimary className="max-w-[180px] truncate" title={item.reporterName}>
                    {item.reporterName}
                  </AdminTdPrimary>
                  <AdminTdPrimary className="max-w-[180px] truncate" title={item.reportedUserName}>
                    {item.reportedUserName}
                  </AdminTdPrimary>
                  <AdminTd className="whitespace-nowrap">{item.category || '—'}</AdminTd>
                  <AdminTd className="whitespace-nowrap">
                    <SeverityBadge severity={item.severity}/>
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap">
                    <Badge variant={statusBadgeVariant(item.status)} className="text-xs">
                      {statusLabel(item.status)}
                    </Badge>
                  </AdminTd>
                  <AdminTd className="max-w-[140px] truncate text-xs text-sage-500" title={item.assignedToName ?? 'Belum ditugaskan'}>
                    {item.assignedToName ?? 'Belum ditugaskan'}
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap text-xs text-sage-500">
                    {formatTanggalWaktu(item.createdAt)}
                  </AdminTd>
                  <AdminTdActions>
                    <Button type="button" variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    openDetail(item);
                }}>
                      Lihat detail
                    </Button>
                  </AdminTdActions>
                </AdminTr>))}
            </tbody>
          </AdminTableCard>

          <div className="space-y-3 sm:hidden">
            {items.map((item) => (<button key={item.id} type="button" className="block w-full rounded-[var(--radius)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40" onClick={() => openDetail(item)}>
                <Card>
                  <CardContent className="px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-charcoal-900" title={item.reportedUserName}>
                        {item.reportedUserName}
                      </p>
                      <Badge variant={statusBadgeVariant(item.status)} className="shrink-0 text-xs">
                        {statusLabel(item.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-sage-500">
                      Dilaporkan oleh{' '}
                      <span className="font-medium text-charcoal-700">{item.reporterName}</span>
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <SeverityBadge severity={item.severity}/>
                      <span className="text-xs text-charcoal-700">{item.category || '—'}</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-sage-500">
                      <span className="truncate">
                        {item.assignedToName ?? 'Belum ditugaskan'}
                      </span>
                      <span className="shrink-0">{formatTanggalWaktu(item.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              </button>))}
          </div>

          <AdminPagination total={total} page={Math.floor(offset / PAGE_LIMIT) + 1} pageSize={PAGE_LIMIT} noun="laporan" className="mt-6" onPageChange={(next) => load((next - 1) * PAGE_LIMIT)}/>
        </>)}

    </div>);
}
