import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminActor, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { canCreateRoleRequest, isSuperAdminUserId, type AdminUserRole, } from '@/lib/admin-access';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Row = Record<string, unknown>;
const ALLOWED_ROLES = ['buyer', 'umkm', 'admin'] as const;
const STATUS_FILTERS = ['pending', 'approved', 'rejected'] as const;
const REASON_MAX = 500;
const SELECT_FIELDS = [
    'id',
    'requested_by',
    'target_user_id',
    'current_role',
    'requested_role',
    'reason',
    'status',
    'decided_by',
    'decided_at',
    'decision_note',
    'created_at',
].join(', ');
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const actor = await getAdminActor(authHeader);
        if (!actor) {
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
        const statusRaw = (params.get('status') ?? '').trim();
        const statusFilter = (STATUS_FILTERS as readonly string[]).includes(statusRaw)
            ? (statusRaw as (typeof STATUS_FILTERS)[number])
            : null;
        if (statusRaw && !statusFilter) {
            return NextResponse.json({ error: 'Filter status tidak valid. Nilai yang diizinkan: pending, approved, rejected.' }, { status: 400 });
        }
        const mineOnly = ['1', 'true'].includes((params.get('mine') ?? '').trim().toLowerCase());
        const db = createAuthedServerClient(authHeader);
        let query = db
            .from('role_change_requests')
            .select(SELECT_FIELDS, { count: 'exact' })
            .order('created_at', { ascending: false });
        if (statusFilter)
            query = query.eq('status', statusFilter);
        if (mineOnly)
            query = query.eq('requested_by', actor.id);
        const { data, error, count } = await query.range(offset, offset + limit - 1);
        if (error) {
            const code = (error as {
                code?: string;
            }).code ?? '';
            if (code === '42P01' || code === 'PGRST205') {
                return NextResponse.json({
                    requests: [],
                    total: 0,
                    limit,
                    offset,
                    not_provisioned: true,
                });
            }
            console.error('[admin/role-requests] fetch error', error.message);
            return NextResponse.json({ error: 'Gagal memuat permintaan role.' }, { status: 500 });
        }
        const rows = ((data ?? []) as unknown) as Row[];
        const profileIds = new Set<string>();
        for (const r of rows) {
            for (const key of ['requested_by', 'target_user_id', 'decided_by']) {
                const value = asString(r[key]);
                if (value)
                    profileIds.add(value);
            }
        }
        const profileById = new Map<string, Row>();
        if (profileIds.size > 0) {
            const { data: profiles, error: profErr } = await db
                .from('profiles')
                .select('id, full_name, email, role')
                .in('id', Array.from(profileIds))
                .limit(1000);
            if (profErr) {
                console.error('[admin/role-requests] profiles error', profErr.message);
            }
            for (const p of ((profiles ?? []) as unknown as Row[])) {
                const pid = asString(p.id);
                if (pid)
                    profileById.set(pid, p);
            }
        }
        const party = (p: Row | null | undefined) => p ? { full_name: asString(p.full_name), email: asString(p.email) } : null;
        const requests = rows.map((r) => {
            const requesterId = asString(r.requested_by);
            const targetId = asString(r.target_user_id);
            const deciderId = asString(r.decided_by);
            const requester = requesterId ? (profileById.get(requesterId) ?? null) : null;
            const target = targetId ? (profileById.get(targetId) ?? null) : null;
            const decider = deciderId ? (profileById.get(deciderId) ?? null) : null;
            return {
                id: r.id ?? null,
                status: r.status ?? null,
                current_role: r.current_role ?? null,
                requested_role: r.requested_role ?? null,
                current_role_live: target ? (asString(target.role) ?? null) : null,
                reason: r.reason ?? null,
                decision_note: r.decision_note ?? null,
                created_at: r.created_at ?? null,
                decided_at: r.decided_at ?? null,
                requested_by_me: requesterId !== null && requesterId === actor.id,
                target_is_super_admin: isSuperAdminUserId(targetId),
                requested_by: party(requester),
                decided_by: party(decider),
                target: target
                    ? {
                        id: asString(target.id),
                        full_name: asString(target.full_name),
                        email: asString(target.email),
                    }
                    : null,
            };
        });
        return NextResponse.json({
            requests,
            total: count ?? requests.length,
            limit,
            offset,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/role-requests] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses permintaan peran." }, { status: 500 });
    }
}
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const actor = await getAdminActor(authHeader);
        if (!actor) {
            const user = await getUserFromBearer(authHeader);
            return NextResponse.json({ error: user ? 'Akses ditolak. Hanya admin.' : 'Unauthorized. Silakan login ulang.' }, { status: user ? 403 : 401 });
        }
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        const body = (await req.json().catch(() => null)) as {
            target_user_id?: unknown;
            requested_role?: unknown;
            reason?: unknown;
        } | null;
        const targetId = typeof body?.target_user_id === 'string' ? body.target_user_id.trim() : '';
        if (!targetId) {
            return NextResponse.json({ error: 'ID pengguna target wajib.' }, { status: 400 });
        }
        const requestedRole = typeof body?.requested_role === 'string' ? body.requested_role.trim() : '';
        if (!(ALLOWED_ROLES as readonly string[]).includes(requestedRole)) {
            return NextResponse.json({ error: 'Role yang diminta tidak valid. Nilai yang diizinkan: buyer, umkm, admin.' }, { status: 400 });
        }
        const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
        if (reason.length > REASON_MAX) {
            return NextResponse.json({ error: `Alasan maksimal ${REASON_MAX} karakter.` }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: targetRow, error: targetErr } = await db
            .from('profiles')
            .select('id, role')
            .eq('id', targetId)
            .maybeSingle();
        if (targetErr) {
            console.error('[admin/role-requests] target error', targetErr.message);
            return NextResponse.json({ error: 'Gagal memuat pengguna target.' }, { status: 500 });
        }
        if (!targetRow) {
            return NextResponse.json({ error: 'Pengguna target tidak ditemukan.' }, { status: 404 });
        }
        const target = ((targetRow ?? {}) as unknown) as Row;
        const decision = canCreateRoleRequest(actor, {
            id: targetId,
            role: asString(target.role),
            isSuperAdmin: isSuperAdminUserId(targetId),
        }, requestedRole as AdminUserRole);
        if (!decision.allowed) {
            return NextResponse.json({ error: decision.message }, { status: decision.status });
        }
        const { data: inserted, error: insErr } = await db
            .from('role_change_requests')
            .insert({
            requested_by: actor.id,
            target_user_id: targetId,
            current_role: asString(target.role),
            requested_role: requestedRole as AdminUserRole,
            reason: reason || null,
        })
            .select('id, status, current_role, requested_role, reason, created_at')
            .maybeSingle();
        if (insErr) {
            if (insErr.code === '23505') {
                return NextResponse.json({
                    error: 'Sudah ada permintaan pending untuk pengguna ini. Tunggu keputusan Super Admin.',
                }, { status: 409 });
            }
            console.error('[admin/role-requests] insert error', insErr.message);
            return NextResponse.json({ error: 'Gagal mengirim permintaan role.' }, { status: 500 });
        }
        if (!inserted) {
            return NextResponse.json({ error: 'Gagal mengirim permintaan role.' }, { status: 500 });
        }
        try {
            const { error: auditErr } = await db.from('admin_audit_logs').insert({
                admin_id: actor.id,
                action: 'request_role_change',
                target_type: 'user',
                target_id: targetId,
                reason: reason?.trim() ||
                    `Permintaan perubahan peran ke ${requestedRole}`,
                metadata: {
                    auto: false,
                    request_id: (inserted as Row).id ?? null,
                    old_role: asString(target.role),
                    new_role: requestedRole,
                    requested_by: actor.id,
                },
            });
            if (auditErr) {
                console.error('[admin/role-requests] audit log gagal', auditErr.message);
            }
        }
        catch (auditError) {
            console.error('[admin/role-requests] audit log exception', auditError);
        }
        return NextResponse.json({ request: inserted }, { status: 201 });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/role-requests] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses permintaan peran." }, { status: 500 });
    }
}
