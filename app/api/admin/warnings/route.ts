import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { canIssueSanction, isSuperAdminUserId } from '@/lib/admin-access';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const WARNINGS_SELECT = [
    'id',
    'user_id',
    'report_id',
    'issued_by',
    'warning_level',
    'category',
    'reason',
    'created_at',
    'warnedUser:profiles!warnings_user_id_fkey(id, full_name, email)',
    'issuer:profiles!warnings_issued_by_fkey(id, full_name, email)',
].join(', ');
const VALID_LEVELS = [1, 2, 3] as const;
type WarningRow = Record<string, unknown>;
function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    return value as Record<string, unknown>;
}
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
        const rawLevel = params.get('warningLevel');
        let level: number | null = null;
        if (rawLevel !== null) {
            const parsed = Number(rawLevel);
            if (!Number.isInteger(parsed) || !(VALID_LEVELS as readonly number[]).includes(parsed)) {
                return NextResponse.json({ error: 'warningLevel tidak valid. Gunakan 1, 2, atau 3.' }, { status: 400 });
            }
            level = parsed;
        }
        const rawUserId = params.get('userId');
        const rawReportId = params.get('reportId');
        const rawFrom = params.get('from');
        const rawTo = params.get('to');
        const db = createAuthedServerClient(authHeader);
        let query = db
            .from('warnings')
            .select(WARNINGS_SELECT, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (level !== null) {
            query = query.eq('warning_level', level);
        }
        if (rawUserId)
            query = query.eq('user_id', rawUserId);
        if (rawReportId)
            query = query.eq('report_id', rawReportId);
        if (rawFrom)
            query = query.gte('created_at', rawFrom);
        if (rawTo)
            query = query.lte('created_at', rawTo);
        const { data, error, count } = await query;
        if (error) {
            console.error('[admin/warnings] fetch error', error.message);
            return NextResponse.json({ error: 'Gagal memuat daftar warning.' }, { status: 500 });
        }
        const warnings = (data ?? []).map((row) => {
            const r = row as unknown as WarningRow;
            const warnedUser = asRecord(r.warnedUser);
            const issuer = asRecord(r.issuer);
            return {
                id: asString(r.id) ?? '',
                userId: asString(r.user_id) ?? asString(warnedUser?.id),
                userName: asString(warnedUser?.full_name) ?? asString(warnedUser?.email) ?? 'Tidak diketahui',
                userEmail: asString(warnedUser?.email),
                reportId: asString(r.report_id),
                issuedBy: asString(r.issued_by) ?? asString(issuer?.id),
                issuerName: asString(issuer?.full_name) ?? asString(issuer?.email) ?? 'Tidak diketahui',
                issuerEmail: asString(issuer?.email),
                warningLevel: asNumber(r.warning_level) ?? 0,
                category: asString(r.category) ?? '',
                reason: asString(r.reason) ?? '',
                createdAt: asString(r.created_at) ?? '',
            };
        });
        return NextResponse.json({
            warnings,
            total: count ?? warnings.length,
            limit,
            offset,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/warnings] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses peringatan." }, { status: 500 });
    }
}
export async function POST(req: NextRequest) {
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
        const body = (await req.json().catch(() => null)) as {
            userId?: unknown;
            warningLevel?: unknown;
            category?: unknown;
            reason?: unknown;
            reportId?: unknown;
        } | null;
        const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
        const category = typeof body?.category === 'string' ? body.category.trim() : '';
        const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
        const reportId = typeof body?.reportId === 'string' && body.reportId.trim() ? body.reportId.trim() : null;
        const level = typeof body?.warningLevel === 'number' && Number.isInteger(body.warningLevel)
            ? body.warningLevel
            : Number(body?.warningLevel);
        if (!userId) {
            return NextResponse.json({ error: 'userId wajib.' }, { status: 400 });
        }
        if (!Number.isInteger(level) || !(VALID_LEVELS as readonly number[]).includes(level)) {
            return NextResponse.json({ error: 'warningLevel harus 1, 2, atau 3.' }, { status: 400 });
        }
        if (!category) {
            return NextResponse.json({ error: 'category wajib.' }, { status: 400 });
        }
        if (!reason) {
            return NextResponse.json({ error: 'reason wajib.' }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: userRow, error: userErr } = await db
            .from('profiles')
            .select('id, role')
            .eq('id', userId)
            .maybeSingle();
        if (userErr) {
            console.error('[admin/warnings] user check', userErr.message);
            return NextResponse.json({ error: 'Gagal memvalidasi pengguna.' }, { status: 500 });
        }
        if (!userRow) {
            return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
        }
        const targetRole = ((userRow as unknown) as Record<string, unknown>).role as string | null;
        const actor = {
            id: admin.id,
            role: 'admin' as const,
            isSuperAdmin: isSuperAdminUserId(admin.id),
        };
        const decision = canIssueSanction(actor, {
            id: userId,
            role: targetRole,
            isSuperAdmin: isSuperAdminUserId(userId),
        });
        if (!decision.allowed) {
            return NextResponse.json({ error: decision.message }, { status: decision.status });
        }
        if (reportId) {
            const { data: reportRow, error: reportErr } = await db
                .from('reports')
                .select('id')
                .eq('id', reportId)
                .maybeSingle();
            if (reportErr) {
                console.error('[admin/warnings] report check', reportErr.message);
                return NextResponse.json({ error: 'Gagal memvalidasi laporan.' }, { status: 500 });
            }
            if (!reportRow) {
                return NextResponse.json({ error: 'Laporan tidak ditemukan.' }, { status: 404 });
            }
        }
        const { data: inserted, error: insertErr } = await db
            .from('warnings')
            .insert({
            user_id: userId,
            warning_level: level,
            category,
            reason,
            report_id: reportId,
            issued_by: admin.id,
        })
            .select('id, user_id, report_id, warning_level, category, reason, created_at')
            .single();
        if (insertErr) {
            console.error('[admin/warnings] insert error', insertErr.message);
            return NextResponse.json({ error: 'Gagal menyimpan peringatan.' }, { status: 500 });
        }
        return NextResponse.json({ warning: inserted }, { status: 201 });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/warnings] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses peringatan." }, { status: 500 });
    }
}
