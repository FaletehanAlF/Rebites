'use client';
import { AuthError } from './auth-token';
import { fetchAdminWithAuth } from './admin-auth';
import { AdminExportApiError, downloadAdminExport } from './admin-export';
import { REPORT_FILTER_SEVERITIES, REPORT_FILTER_STATUSES, buildReportFilterSearchParams, type ReportFilterSeverity, type ReportFilterStatus, } from './report-filters';
export const REPORT_STATUSES = REPORT_FILTER_STATUSES;
export type ReportStatus = ReportFilterStatus;
export const REPORT_SEVERITIES = REPORT_FILTER_SEVERITIES;
export type ReportSeverity = ReportFilterSeverity;
export interface ReportsFilterOptions {
    severity?: ReportSeverity;
    category?: string;
    assigned?: 'assigned' | 'unassigned';
    q?: string;
    from?: string;
    to?: string;
}
export interface ReportItem {
    id: string;
    reportedUserId: string | null;
    reportedUserName: string;
    reportedUserEmail: string | null;
    reportedBy: string | null;
    reporterName: string;
    reporterEmail: string | null;
    activityId: string | null;
    category: string;
    description: string;
    status: string;
    severity: string | null;
    assignedToId: string | null;
    assignedToName: string | null;
    assignedToEmail: string | null;
    resolvedBy: string | null;
    resolvedAt: string | null;
    createdAt: string;
}
export interface ReportsResult {
    reports: ReportItem[];
    total: number;
    limit: number;
    offset: number;
}
export interface ReportNote {
    id: string;
    reportId: string;
    adminId: string | null;
    adminName: string;
    adminEmail: string | null;
    note: string;
    createdAt: string;
}
export class ReportsApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'ReportsApiError';
        this.status = status;
    }
}
async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
        return await fetchAdminWithAuth(input, init);
    }
    catch (err) {
        if (err instanceof AuthError)
            throw new ReportsApiError(err.message, err.status);
        throw err;
    }
}
export async function fetchReports(limit = 20, offset = 0, status?: ReportStatus, filters?: ReportsFilterOptions): Promise<ReportsResult> {
    const params = buildReportFilterSearchParams({ ...filters, status: status ?? null });
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    const res = await adminFetch(`/api/admin/reports?${params.toString()}`);
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new ReportsApiError(json?.error ?? 'Gagal memuat laporan.', res.status);
    }
    const json = (await res.json().catch(() => null)) as ReportsResult | null;
    if (!json || !Array.isArray(json.reports)) {
        throw new ReportsApiError('Respons laporan tidak valid.', 500);
    }
    return json;
}
export interface ReportsCsvResult {
    downloaded: boolean;
    rows: number;
    filename: string | null;
}
export async function downloadReportsExcel(status: ReportStatus | null, filters: ReportsFilterOptions = {}, signal?: AbortSignal): Promise<ReportsCsvResult> {
    const params = buildReportFilterSearchParams({ ...filters, status: status ?? null });
    try {
        return await downloadAdminExport({
            url: `/api/admin/reports/export?${params.toString()}`,
            signal,
            fallbackMessage: 'Gagal membuat ekspor laporan.',
        });
    }
    catch (err) {
        if (err instanceof AdminExportApiError) {
            throw new ReportsApiError(err.message, err.status);
        }
        throw err;
    }
}
export async function updateReport(id: string, patch: {
    status?: ReportStatus;
    severity?: ReportSeverity | null;
    assignedTo?: string | null;
    reason?: string;
}): Promise<void> {
    const res = await adminFetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
    });
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new ReportsApiError(json?.error ?? 'Gagal memperbarui laporan.', res.status);
    }
}
export async function fetchReportById(reportId: string): Promise<ReportItem> {
    const res = await adminFetch(`/api/admin/reports/${reportId}`);
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new ReportsApiError(json?.error ?? 'Gagal memuat laporan.', res.status);
    }
    const json = (await res.json()) as {
        report: ReportItem;
    };
    return json.report;
}
export async function fetchReportNotes(reportId: string, limit = 50, offset = 0): Promise<{
    notes: ReportNote[];
    total: number;
}> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const res = await adminFetch(`/api/admin/reports/${reportId}/notes?${params.toString()}`);
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new ReportsApiError(json?.error ?? 'Gagal memuat catatan.', res.status);
    }
    return (await res.json()) as {
        notes: ReportNote[];
        total: number;
    };
}
export async function addReportNote(reportId: string, note: string): Promise<void> {
    const res = await adminFetch(`/api/admin/reports/${reportId}/notes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note }),
    });
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new ReportsApiError(json?.error ?? 'Gagal menyimpan catatan.', res.status);
    }
}
