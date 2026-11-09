import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { applyReportFiltersToQuery, parseReportFilters } from '@/lib/report-filters';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const REPORTS_SELECT = [
    'id',
    'reported_user_id',
    'reported_by',
    'activity_id',
    'category',
    'description',
    'status',
    'resolved_by',
    'resolved_at',
    'severity',
    'assigned_to',
    'created_at',
    'reportedUser:profiles!reports_reported_user_id_fkey(id, full_name, email)',
    'reporter:profiles!reports_reported_by_fkey(id, full_name, email)',
    'assignedTo:profiles!reports_assigned_to_fkey(id, full_name, email)',
].join(', ');
type ReportRow = Record<string, unknown>;
function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    return value as Record<string, unknown>;
}
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const admin = await getAdminUser(authHeader);
        if (!admin) {
            const user = await getUserFromBearer(authHeader);
            return NextResponse.json({ error: user ? 'Akses ditolak. Hanya admin.' : 'Unauthorized. Silakan login ulang.' }, { status: user ? 403 : 401 });
        }
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        const params = req.nextUrl.searchParams;
        const rawLimit = Number(params.get('limit') ?? '20');
        const rawOffset = Number(params.get('offset') ?? '0');
        const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;
        const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
        const parsedFilters = parseReportFilters(params);
        if (!parsedFilters.ok) {
            return NextResponse.json({ error: parsedFilters.error }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const baseQuery = db
            .from('reports')
            .select(REPORTS_SELECT, { count: 'exact' })
            .order('created_at', { ascending: false })
            .order('id', { ascending: false });
        const filteredQuery = applyReportFiltersToQuery(baseQuery, parsedFilters.filters);
        const { data, error, count } = await filteredQuery.range(offset, offset + limit - 1);
        if (error) {
            console.error('[admin/reports] fetch error', error.message);
            return NextResponse.json({ error: 'Gagal memuat laporan.' }, { status: 500 });
        }
        if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
            console.error('[admin/reports] exact count tidak tersedia');
            return NextResponse.json({ error: 'Gagal menghitung total laporan.' }, { status: 500 });
        }
        const reports = (data ?? []).map((row) => {
            const r = row as unknown as ReportRow;
            const reportedUser = asRecord(r.reportedUser);
            const reporter = asRecord(r.reporter);
            const assignedTo = asRecord(r.assignedTo);
            return {
                id: asString(r.id) ?? '',
                reportedUserId: asString(r.reported_user_id) ?? asString(reportedUser?.id),
                reportedUserName: asString(reportedUser?.full_name) ?? asString(reportedUser?.email) ?? 'Tidak diketahui',
                reportedUserEmail: asString(reportedUser?.email),
                reportedBy: asString(r.reported_by) ?? asString(reporter?.id),
                reporterName: asString(reporter?.full_name) ?? asString(reporter?.email) ?? 'Tidak diketahui',
                reporterEmail: asString(reporter?.email),
                activityId: asString(r.activity_id),
                category: asString(r.category) ?? '',
                description: asString(r.description) ?? '',
                status: asString(r.status) ?? 'open',
                severity: asString(r.severity),
                assignedToId: asString(r.assigned_to) ?? asString(assignedTo?.id),
                assignedToName: assignedTo
                    ? asString(assignedTo.full_name) ?? asString(assignedTo.email) ?? 'Tidak diketahui'
                    : null,
                assignedToEmail: asString(assignedTo?.email),
                resolvedBy: asString(r.resolved_by),
                resolvedAt: asString(r.resolved_at),
                createdAt: asString(r.created_at) ?? '',
            };
        });
        return NextResponse.json({
            reports,
            total: count,
            limit,
            offset,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/reports] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses laporan." }, { status: 500 });
    }
}
