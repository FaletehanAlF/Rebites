import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuthedServerClient, createServiceClient, getAdminActor, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { canManageAccountDeletion, isSuperAdminUserId } from '@/lib/admin-access';
import { HARD_DELETE_PASSWORD_MISMATCH_MESSAGE, HARD_DELETE_UNCONFIGURED_MESSAGE, isHardDeleteConfigured, isHardDeletePasswordValid, readHardDeletePassword, } from '@/lib/server/hard-delete-password';
import { evaluateHardDeletePreconditions, type HardDeleteImpact, } from '@/lib/hard-delete';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const AUTH_TIMEOUT_MS = 10000;
const REASON_MAX = 500;
const FINISHED_ORDER_STATUSES = ['completed', 'cancelled', 'refunded'] as const;
const FINISHED_STATUS_FILTER = `(${FINISHED_ORDER_STATUSES.map((s) => `"${s}"`).join(',')})`;
type Row = Record<string, unknown>;
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
async function countRows(db: SupabaseClient, table: string, column: string, value: string): Promise<number> {
    const { count, error } = await db
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq(column, value);
    if (error)
        throw new Error(`${table}.${column}: ${error.message}`);
    return count ?? 0;
}
async function countActiveOrders(db: SupabaseClient, column: 'buyer_id' | 'umkm_id', value: string): Promise<number> {
    const { count, error } = await db
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq(column, value)
        .not('order_status', 'in', FINISHED_STATUS_FILTER);
    if (error)
        throw new Error(`orders.${column}: ${error.message}`);
    return count ?? 0;
}
async function loadImpact(db: SupabaseClient, userId: string): Promise<HardDeleteImpact> {
    const { data: storeRow, error: storeErr } = await db
        .from('umkm_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
    if (storeErr)
        throw new Error(`umkm_profiles: ${storeErr.message}`);
    const storeId = storeRow ? asString(((storeRow as unknown) as Row).id) : null;
    const [ordersAsBuyer, buyerActiveOrders, storeActiveOrders, products, reviews, coinTransactions, articles,] = await Promise.all([
        countRows(db, 'orders', 'buyer_id', userId),
        countActiveOrders(db, 'buyer_id', userId),
        storeId ? countActiveOrders(db, 'umkm_id', storeId) : Promise.resolve(0),
        storeId ? countRows(db, 'products', 'umkm_id', storeId) : Promise.resolve(0),
        countRows(db, 'reviews', 'user_id', userId),
        countRows(db, 'coin_transactions', 'user_id', userId),
        countRows(db, 'articles', 'author_id', userId),
    ]);
    const ordersInStore = storeId ? await countRows(db, 'orders', 'umkm_id', storeId) : 0;
    return {
        ordersAsBuyer,
        ordersInStore,
        activeOrders: buyerActiveOrders + storeActiveOrders,
        products,
        reviews,
        coinTransactions,
        articles,
    };
}
export async function GET(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
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
        const id = params.id?.trim();
        if (!id) {
            return NextResponse.json({ error: 'ID pengguna wajib.' }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: target, error: targetErr } = await db
            .from('profiles')
            .select('id, role, email')
            .eq('id', id)
            .maybeSingle();
        if (targetErr) {
            console.error('[admin/users/hard-deletion] fetch error', targetErr.message);
            return NextResponse.json({ error: 'Gagal memuat data pengguna.' }, { status: 500 });
        }
        if (!target) {
            return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
        }
        const row = (target as unknown) as Row;
        const decision = canManageAccountDeletion(actor, {
            id,
            role: asString(row.role),
            isSuperAdmin: isSuperAdminUserId(id),
        });
        if (!decision.allowed) {
            return NextResponse.json({ error: decision.message, code: decision.code }, { status: decision.status });
        }
        const impact = await loadImpact(createServiceClient(AUTH_TIMEOUT_MS), id);
        const precondition = evaluateHardDeletePreconditions(impact);
        return NextResponse.json({
            configured: isHardDeleteConfigured(process.env),
            impact,
            precondition,
            target: { email: asString(row.email) },
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/users/hard-deletion] unexpected', err);
        return NextResponse.json({ error: 'Gagal memuat dampak penghapusan.' }, { status: 500 });
    }
}
export async function DELETE(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
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
        const id = params.id?.trim();
        if (!id) {
            return NextResponse.json({ error: 'ID pengguna wajib.' }, { status: 400 });
        }
        const body = (await req.json().catch(() => null)) as {
            password?: unknown;
            reason?: unknown;
        } | null;
        if (!isHardDeleteConfigured(process.env)) {
            return NextResponse.json({ error: HARD_DELETE_UNCONFIGURED_MESSAGE, code: 'hard-delete-disabled' }, { status: 503 });
        }
        const expected = readHardDeletePassword();
        if (!isHardDeletePasswordValid(body?.password, expected)) {
            return NextResponse.json({ error: HARD_DELETE_PASSWORD_MISMATCH_MESSAGE }, { status: 403 });
        }
        const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
        if (!reason) {
            return NextResponse.json({ error: 'Alasan penghapusan permanen wajib diisi.' }, { status: 400 });
        }
        if (reason.length > REASON_MAX) {
            return NextResponse.json({ error: `Alasan maksimal ${REASON_MAX} karakter.` }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: target, error: targetErr } = await db
            .from('profiles')
            .select('id, role, email')
            .eq('id', id)
            .maybeSingle();
        if (targetErr) {
            console.error('[admin/users/hard-deletion] fetch error', targetErr.message);
            return NextResponse.json({ error: 'Gagal memuat data pengguna.' }, { status: 500 });
        }
        if (!target) {
            return NextResponse.json({ error: 'Pengguna tidak ditemukan. Mungkin sudah dihapus admin lain.' }, { status: 404 });
        }
        const row = (target as unknown) as Row;
        const decision = canManageAccountDeletion(actor, {
            id,
            role: asString(row.role),
            isSuperAdmin: isSuperAdminUserId(id),
        });
        if (!decision.allowed) {
            return NextResponse.json({ error: decision.message, code: decision.code }, { status: decision.status });
        }
        const service = createServiceClient(AUTH_TIMEOUT_MS);
        const impact = await loadImpact(service, id);
        const precondition = evaluateHardDeletePreconditions(impact);
        if (!precondition.allowed) {
            return NextResponse.json({ error: precondition.message, code: precondition.code, impact }, { status: 409 });
        }
        const { error: deleteErr } = await service.auth.admin.deleteUser(id, false);
        if (deleteErr) {
            const status = (deleteErr as {
                status?: unknown;
            }).status;
            const code = (deleteErr as {
                code?: unknown;
            }).code;
            if (status === 404 || code === 'user_not_found') {
                return NextResponse.json({ error: 'Akun ini sudah tidak ada di sistem. Muat ulang halaman.' }, { status: 409 });
            }
            console.error('[admin/users/hard-deletion] delete error', deleteErr.message);
            return NextResponse.json({ error: 'Gagal menghapus akun secara permanen.' }, { status: 500 });
        }
        const { error: auditErr } = await db.from('admin_audit_logs').insert({
            admin_id: actor.id,
            action: 'hard_delete_user',
            target_type: 'user',
            target_id: id,
            reason,
            metadata: { auto: true, email: asString(row.email), impact },
        });
        if (auditErr) {
            console.error('[admin/users/hard-deletion] audit error', auditErr.message);
        }
        return NextResponse.json({
            deleted: true,
            email: asString(row.email),
            impact,
            audit_recorded: !auditErr,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/users/hard-deletion] unexpected', err);
        return NextResponse.json({ error: 'Gagal memproses penghapusan permanen.' }, { status: 500 });
    }
}
