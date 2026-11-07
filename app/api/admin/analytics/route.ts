import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, queryFailureResponse, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { firstFailedQuery } from '@/lib/server/supabase-errors';
import { PageLimitError, PageQueryError, fetchAllPages, type PostgrestPage, } from '@/lib/server/supabase-rows';
import { buildOrderAnalytics, parseAnalyticsRangeDays, type AdminAnalyticsData, type AdminAnalyticsReportCounts, type OrderAnalyticsSource, } from '@/lib/admin-analytics';
import { REPORT_FILTER_SEVERITIES, REPORT_FILTER_STATUSES, type ReportFilterSeverity, type ReportFilterStatus, } from '@/lib/report-filters';
import { startOfDaysWindowWib } from '@/lib/wib-time';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_ANALYTICS_ORDER_ROWS = 50000;
type Loaded<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: unknown;
};
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
        const rangeDays = parseAnalyticsRangeDays(req.nextUrl.searchParams.get('range'));
        if (rangeDays === null) {
            return NextResponse.json({
                error: 'Rentang analytics tidak valid. Gunakan salah satu: 7, 14, 30, atau 90 hari.',
            }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const now = Date.now();
        const nowIso = new Date(now).toISOString();
        const fromIso = new Date(startOfDaysWindowWib(rangeDays, now)).toISOString();
        const reportBase = () => db
            .from('reports')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', fromIso)
            .lte('created_at', nowIso);
        const statusCountQueries = REPORT_FILTER_STATUSES.map((status) => reportBase().eq('status', status));
        const severityCountQueries = [
            ...REPORT_FILTER_SEVERITIES.map((severity) => reportBase().eq('severity', severity)),
            reportBase().is('severity', null),
        ];
        const ordersPromise: Promise<Loaded<OrderAnalyticsSource[]>> = fetchAllPages<OrderAnalyticsSource>((from, to) => {
            const query = db
                .from('orders')
                .select('id, created_at, total_price, payment_status')
                .gte('created_at', fromIso)
                .lte('created_at', nowIso)
                .order('created_at', { ascending: true })
                .order('id', { ascending: true });
            return query.range(from, to) as unknown as PromiseLike<PostgrestPage<OrderAnalyticsSource>>;
        }, { maxRows: MAX_ANALYTICS_ORDER_ROWS, label: 'pesanan analytics' })
            .then((data) => ({ ok: true as const, data }))
            .catch((error: unknown) => ({ ok: false as const, error }));
        const countResults = await Promise.all([...statusCountQueries, ...severityCountQueries]);
        const failed = firstFailedQuery([
            ...REPORT_FILTER_STATUSES.map((status, index) => [
                `reports status ${status}`,
                countResults[index],
            ] as const),
            ...REPORT_FILTER_SEVERITIES.map((severity, index) => [
                `reports severity ${severity}`,
                countResults[REPORT_FILTER_STATUSES.length + index],
            ] as const),
            ['reports severity null', countResults[countResults.length - 1]],
        ]);
        if (failed) {
            console.error('[admin/analytics] query gagal:', failed.label, failed.error);
            return queryFailureResponse(failed.error, 'Gagal memuat analytics.');
        }
        if (countResults.some((result) => typeof result.count !== 'number' ||
            !Number.isFinite(result.count) ||
            result.count < 0)) {
            console.error('[admin/analytics] exact count tidak tersedia');
            return NextResponse.json({ error: 'Gagal menghitung data laporan.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
        }
        const ordersOutcome = await ordersPromise;
        if (!ordersOutcome.ok) {
            if (ordersOutcome.error instanceof PageLimitError) {
                return NextResponse.json({
                    error: `Data pesanan ${rangeDays} hari melebihi batas ${MAX_ANALYTICS_ORDER_ROWS.toLocaleString('id-ID')} baris. Pilih rentang yang lebih pendek.`,
                }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
            }
            if (ordersOutcome.error instanceof PageQueryError) {
                console.error('[admin/analytics] order page error', ordersOutcome.error.label, ordersOutcome.error.queryError);
                return queryFailureResponse(ordersOutcome.error.queryError, 'Gagal memuat analytics.');
            }
            throw ordersOutcome.error;
        }
        const orderSummary = buildOrderAnalytics(ordersOutcome.data, rangeDays, now);
        const byStatus = Object.fromEntries(REPORT_FILTER_STATUSES.map((status, index) => [
            status,
            countResults[index].count ?? 0,
        ])) as Record<ReportFilterStatus, number>;
        const bySeverity = Object.fromEntries([
            ...REPORT_FILTER_SEVERITIES.map((severity, index) => [
                severity,
                countResults[REPORT_FILTER_STATUSES.length + index].count ?? 0,
            ]),
            [
                'unknown',
                countResults[countResults.length - 1].count ?? 0,
            ],
        ]) as Record<ReportFilterSeverity | 'unknown', number>;
        const reports: AdminAnalyticsReportCounts = {
            total: REPORT_FILTER_STATUSES.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0),
            byStatus,
            bySeverity,
        };
        const payload: AdminAnalyticsData = {
            generatedAt: nowIso,
            rangeDays,
            from: fromIso,
            to: nowIso,
            orders: {
                total: orderSummary.total,
                paid: orderSummary.paid,
                failed: orderSummary.failed,
                revenue: orderSummary.revenue,
                revenueToday: orderSummary.revenueToday,
                revenueYesterday: orderSummary.revenueYesterday,
                revenue7d: orderSummary.revenue7d,
                byDay: orderSummary.byDay,
            },
            reports,
        };
        return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/analytics] unexpected', err);
        return NextResponse.json({ error: 'Gagal memuat analytics.' }, { status: 500 });
    }
}
