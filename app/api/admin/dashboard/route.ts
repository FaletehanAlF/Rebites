import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, queryFailureResponse, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { firstFailedQuery } from '@/lib/server/supabase-errors';
import { PageLimitError, PageQueryError, fetchAllPages, type PostgrestPage, } from '@/lib/server/supabase-rows';
import { buildOrderAnalytics, type OrderAnalyticsSource } from '@/lib/admin-analytics';
import { TO_SHIP_STATUSES, TO_SHIP_STALE_HOURS } from '@/lib/shipment-state';
import { startOfDayWib, startOfDaysWindowWib } from '@/lib/wib-time';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_DASHBOARD_ORDER_ROWS = 50000;
const MAX_ACTIVE_SUBSCRIPTION_ROWS = 20000;
interface ActiveSubscriptionRow {
    id?: unknown;
    umkm_id?: unknown;
    current_period_end?: unknown;
}
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
        const db = createAuthedServerClient(authHeader);
        const now = Date.now();
        const nowIso = new Date(now).toISOString();
        const startToday = startOfDayWib(now);
        const todayIso = new Date(startToday).toISOString();
        const yesterdayIso = new Date(startToday - 24 * 60 * 60 * 1000).toISOString();
        const since7dIso = new Date(startOfDaysWindowWib(7, now)).toISOString();
        const since14dIso = new Date(startOfDaysWindowWib(14, now)).toISOString();
        const staleCutoffIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
        const staleShipmentCutoffIso = new Date(now - TO_SHIP_STALE_HOURS * 60 * 60 * 1000).toISOString();
        const expiringCutoffIso = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
        const activeSubsPromise: Promise<Loaded<ActiveSubscriptionRow[]>> = fetchAllPages<ActiveSubscriptionRow>((from, to) => {
            const query = db
                .from('subscriptions')
                .select('id, umkm_id, current_period_end')
                .eq('status', 'active')
                .order('id', { ascending: true });
            return query.range(from, to) as unknown as PromiseLike<PostgrestPage<ActiveSubscriptionRow>>;
        }, { maxRows: MAX_ACTIVE_SUBSCRIPTION_ROWS, label: 'langganan aktif' })
            .then((data) => ({ ok: true as const, data }))
            .catch((error: unknown) => ({ ok: false as const, error }));
        const ordersPromise: Promise<Loaded<OrderAnalyticsSource[]>> = fetchAllPages<OrderAnalyticsSource>((from, to) => {
            const query = db
                .from('orders')
                .select('id, created_at, total_price, payment_status')
                .gte('created_at', since14dIso)
                .lte('created_at', nowIso)
                .order('created_at', { ascending: true })
                .order('id', { ascending: true });
            return query.range(from, to) as unknown as PromiseLike<PostgrestPage<OrderAnalyticsSource>>;
        }, { maxRows: MAX_DASHBOARD_ORDER_ROWS, label: 'pesanan 14 hari' })
            .then((data) => ({ ok: true as const, data }))
            .catch((error) => ({ ok: false as const, error }));
        const [usersTotal, usersActive, usersSuspended, usersBanned, umkmTotal, subsPending, subsExpired, reportsOpen, reportsReviewing, reportsStaleOpen, ordersToday, ordersYesterday, orders7d, paymentsFailed, warningsLevel1, warningsLevel2, warningsLevel3, warningUsersAtThree, sanctionsActiveTimed, sanctionsActivePermanent, shipmentsStaleToShip, activityRows,] = await Promise.all([
            db.from('profiles').select('id', { count: 'exact', head: true }),
            db.from('profiles').select('id', { count: 'exact', head: true }).eq('account_status', 'active'),
            db.from('profiles').select('id', { count: 'exact', head: true }).eq('account_status', 'suspended'),
            db.from('profiles').select('id', { count: 'exact', head: true }).eq('account_status', 'banned'),
            db.from('umkm_profiles').select('id', { count: 'exact', head: true }),
            db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
            db.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
            db.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'reviewing'),
            db
                .from('reports')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'open')
                .lt('created_at', staleCutoffIso),
            db
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', todayIso)
                .lte('created_at', nowIso),
            db
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', yesterdayIso)
                .lt('created_at', todayIso),
            db
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .gte('created_at', since7dIso)
                .lte('created_at', nowIso),
            db.from('orders').select('id', { count: 'exact', head: true }).eq('payment_status', 'failed'),
            db
                .from('warnings')
                .select('id', { count: 'exact', head: true })
                .eq('warning_level', 1),
            db
                .from('warnings')
                .select('id', { count: 'exact', head: true })
                .eq('warning_level', 2),
            db
                .from('warnings')
                .select('id', { count: 'exact', head: true })
                .eq('warning_level', 3),
            db
                .from('warning_user_summary')
                .select('user_id', { count: 'exact', head: true })
                .gte('warning_count', 3),
            db
                .from('sanctions')
                .select('id', { count: 'exact', head: true })
                .lte('start_at', nowIso)
                .gt('end_at', nowIso),
            db
                .from('sanctions')
                .select('id', { count: 'exact', head: true })
                .lte('start_at', nowIso)
                .is('end_at', null),
            db
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .eq('delivery_option', 'delivery')
                .eq('payment_status', 'paid')
                .in('order_status', [...TO_SHIP_STATUSES])
                .lt('created_at', staleShipmentCutoffIso),
            db
                .from('activity_logs')
                .select('id, user_id, activity_type, description, target_type, target_id, metadata, created_at')
                .order('created_at', { ascending: false })
                .limit(8),
        ]);
        const failed = firstFailedQuery([
            ['profiles total', usersTotal],
            ['profiles active', usersActive],
            ['profiles suspended', usersSuspended],
            ['profiles banned', usersBanned],
            ['umkm total', umkmTotal],
            ['subscriptions pending', subsPending],
            ['subscriptions expired', subsExpired],
            ['reports open', reportsOpen],
            ['reports reviewing', reportsReviewing],
            ['reports stale open', reportsStaleOpen],
            ['orders today', ordersToday],
            ['orders yesterday', ordersYesterday],
            ['orders 7d', orders7d],
            ['orders failed payments', paymentsFailed],
            ['warnings level 1', warningsLevel1],
            ['warnings level 2', warningsLevel2],
            ['warnings level 3', warningsLevel3],
            ['warning users at three', warningUsersAtThree],
            ['sanctions active timed', sanctionsActiveTimed],
            ['sanctions active permanent', sanctionsActivePermanent],
            ['shipments stale to ship', shipmentsStaleToShip],
            ['activity logs', activityRows],
        ]);
        if (failed) {
            console.error('[admin/dashboard] query gagal:', failed.label, failed.error);
            return queryFailureResponse(failed.error, 'Gagal memuat dashboard.');
        }
        const missingCount = ([
            ['profiles total', usersTotal.count],
            ['profiles active', usersActive.count],
            ['profiles suspended', usersSuspended.count],
            ['profiles banned', usersBanned.count],
            ['umkm total', umkmTotal.count],
            ['subscriptions pending', subsPending.count],
            ['subscriptions expired', subsExpired.count],
            ['reports open', reportsOpen.count],
            ['reports reviewing', reportsReviewing.count],
            ['reports stale open', reportsStaleOpen.count],
            ['orders today', ordersToday.count],
            ['orders yesterday', ordersYesterday.count],
            ['orders 7d', orders7d.count],
            ['orders failed payments', paymentsFailed.count],
            ['warnings level 1', warningsLevel1.count],
            ['warnings level 2', warningsLevel2.count],
            ['warnings level 3', warningsLevel3.count],
            ['warning users at three', warningUsersAtThree.count],
            ['sanctions active timed', sanctionsActiveTimed.count],
            ['sanctions active permanent', sanctionsActivePermanent.count],
            ['shipments stale to ship', shipmentsStaleToShip.count],
        ] as [
            string,
            number | null
        ][]).find(([, count]) => typeof count !== 'number' || !Number.isFinite(count) || count < 0);
        if (missingCount) {
            console.error('[admin/dashboard] exact count tidak tersedia:', missingCount[0]);
            return NextResponse.json({ error: 'Gagal menghitung data dashboard.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
        }
        const [activeSubsOutcome, ordersOutcome] = await Promise.all([
            activeSubsPromise,
            ordersPromise,
        ]);
        if (!activeSubsOutcome.ok) {
            const response = pageLoadFailure(activeSubsOutcome.error, 'langganan aktif');
            if (response)
                return response;
            throw activeSubsOutcome.error;
        }
        if (!ordersOutcome.ok) {
            const response = pageLoadFailure(ordersOutcome.error, 'pesanan 14 hari');
            if (response)
                return response;
            throw ordersOutcome.error;
        }
        const activeSubs = activeSubsOutcome.data.filter((s) => typeof s.current_period_end === 'string' &&
            new Date(s.current_period_end).getTime() > now);
        const activeSubUmkm = new Set(activeSubs.map((s) => s.umkm_id).filter(Boolean));
        const expiringSoon = activeSubs.filter((s) => typeof s.current_period_end === 'string' &&
            new Date(s.current_period_end).getTime() <= Date.parse(expiringCutoffIso)).length;
        const perLevel = {
            1: warningsLevel1.count ?? 0,
            2: warningsLevel2.count ?? 0,
            3: warningsLevel3.count ?? 0,
        } as Record<number, number>;
        const usersAtThree = warningUsersAtThree.count ?? 0;
        const activeSanctions = (sanctionsActiveTimed.count ?? 0) + (sanctionsActivePermanent.count ?? 0);
        const orderSummary = buildOrderAnalytics(ordersOutcome.data, 14, now);
        const revenueToday = orderSummary.revenueToday;
        const revenueYesterday = orderSummary.revenueYesterday;
        const revenue7d = orderSummary.revenue7d;
        const trends = orderSummary.byDay.map((point) => ({
            date: point.date,
            orders: point.orders,
            revenue: point.revenue,
        }));
        const activityUserIds = Array.from(new Set((activityRows.data ?? [])
            .map((a) => (typeof a.user_id === 'string' ? a.user_id : null))
            .filter((id): id is string => id !== null)));
        const profileById = new Map<string, {
            full_name: string | null;
            email: string | null;
        }>();
        if (activityUserIds.length > 0) {
            const { data: profiles, error: profileError } = await db
                .from('profiles')
                .select('id, full_name, email')
                .in('id', activityUserIds);
            if (profileError) {
                console.error('[admin/dashboard] profile activity error', profileError);
                return queryFailureResponse(profileError, 'Gagal memuat dashboard.');
            }
            for (const p of profiles ?? []) {
                profileById.set(p.id, { full_name: p.full_name, email: p.email });
            }
        }
        return NextResponse.json({
            generatedAt: nowIso,
            users: {
                total: usersTotal.count ?? 0,
                active: usersActive.count ?? 0,
                suspended: usersSuspended.count ?? 0,
                banned: usersBanned.count ?? 0,
            },
            umkm: {
                total: umkmTotal.count ?? 0,
                active: activeSubUmkm.size,
            },
            orders: {
                today: ordersToday.count ?? 0,
                yesterday: ordersYesterday.count ?? 0,
                last7Days: orders7d.count ?? 0,
                failedPayments: paymentsFailed.count ?? 0,
            },
            revenue: {
                today: revenueToday,
                yesterday: revenueYesterday,
                last7Days: revenue7d,
            },
            subscriptions: {
                active: activeSubs.length,
                expiringSoon: expiringSoon,
                pending: subsPending.count ?? 0,
                expired: subsExpired.count ?? 0,
            },
            reports: {
                open: reportsOpen.count ?? 0,
                reviewing: reportsReviewing.count ?? 0,
                staleOpen: staleOpenCount(reportsStaleOpen.count),
            },
            warnings: {
                level1: perLevel[1],
                level2: perLevel[2],
                level3: perLevel[3],
                usersAtThree,
            },
            sanctions: { active: activeSanctions },
            shipments: { stale: staleShipmentCount(shipmentsStaleToShip.count) },
            activity: (activityRows.data ?? []).map((a) => {
                const metadata = a.metadata && typeof a.metadata === 'object' && !Array.isArray(a.metadata)
                    ? (a.metadata as Record<string, unknown>)
                    : {};
                return {
                    id: a.id,
                    activityType: a.activity_type,
                    description: a.description,
                    targetType: a.target_type,
                    targetId: a.target_id,
                    orderCode: typeof metadata.order_code === 'string' ? metadata.order_code.trim() : null,
                    createdAt: a.created_at,
                    userName: profileById.get(a.user_id as string)?.full_name ?? null,
                    userEmail: profileById.get(a.user_id as string)?.email ?? null,
                };
            }),
            trends,
        }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/dashboard] GET error', err);
        return NextResponse.json({ error: 'Gagal memuat dashboard.' }, { status: 500 });
    }
}
function staleOpenCount(count: number | null): number {
    return typeof count === 'number' ? count : 0;
}
function staleShipmentCount(count: number | null): number {
    return typeof count === 'number' ? count : 0;
}
function pageLoadFailure(error: unknown, label: string): Response | null {
    if (error instanceof PageLimitError) {
        return NextResponse.json({
            error: `Data ${label} terlalu besar untuk dihitung akurat (${error.maxRows.toLocaleString('id-ID')} baris maksimum). Coba lagi nanti.`,
        }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
    }
    if (error instanceof PageQueryError) {
        console.error('[admin/dashboard] page error', error.label, error.queryError);
        return queryFailureResponse(error.queryError, 'Gagal memuat dashboard.');
    }
    return null;
}
