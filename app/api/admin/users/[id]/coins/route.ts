import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getAdminUser, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { isSuperAdminUserId } from '@/lib/admin-access';
import { COIN_ADJUST_MAX, computeCoinBalance, resolveAdjustmentRow, validateAdjustment, } from '@/lib/coin-adjustment';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const HISTORY_LIMIT = 50;
type Row = Record<string, unknown>;
function asNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}
function rowToHistory(row: Row) {
    return {
        id: String(row.id ?? ''),
        type: String(row.type ?? ''),
        amount: asNumber(row.amount),
        description: String(row.description ?? ''),
        orderCode: row.order_code ? String(row.order_code) : null,
        createdAt: row.created_at ? String(row.created_at) : null,
    };
}
async function loadLedger(db: ReturnType<typeof createServiceClient>, userId: string): Promise<{
    ok: true;
    rows: Row[];
} | {
    ok: false;
    message: string;
}> {
    const { data, error } = await db
        .from('coin_transactions')
        .select('type, amount')
        .eq('user_id', userId);
    if (error)
        return { ok: false, message: error.message };
    return { ok: true, rows: (data ?? []) as Row[] };
}
export async function GET(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    const admin = await getAdminUser(req.headers.get('authorization'));
    if (!admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = params.id?.trim();
    if (!userId) {
        return NextResponse.json({ error: 'userId wajib' }, { status: 400 });
    }
    try {
        const db = createServiceClient();
        const ledger = await loadLedger(db, userId);
        if (!ledger.ok) {
            console.error('[admin/user-coins] gagal memuat ledger:', ledger.message);
            return NextResponse.json({ error: 'Gagal memuat koin pengguna' }, { status: 500 });
        }
        const { data: history, error: historyError } = await db
            .from('coin_transactions')
            .select('id, type, amount, description, order_code, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(HISTORY_LIMIT);
        if (historyError) {
            console.error('[admin/user-coins] gagal memuat riwayat:', historyError.message);
            return NextResponse.json({ error: 'Gagal memuat riwayat koin' }, { status: 500 });
        }
        return NextResponse.json({
            balance: computeCoinBalance(ledger.rows.map((r) => ({
                type: String(r.type ?? ''),
                amount: asNumber(r.amount),
            }))),
            history: ((history ?? []) as Row[]).map(rowToHistory),
            historyLimit: HISTORY_LIMIT,
            canAdjust: isSuperAdminUserId(admin.id),
            maxPerAction: COIN_ADJUST_MAX,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/user-coins] unexpected:', err);
        return NextResponse.json({ error: 'Gagal memuat koin pengguna' }, { status: 500 });
    }
}
export async function POST(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    const admin = await getAdminUser(req.headers.get('authorization'));
    if (!admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isSuperAdminUserId(admin.id)) {
        return NextResponse.json({ error: 'Hanya Super Admin yang dapat mengubah koin pengguna.' }, { status: 403 });
    }
    const userId = params.id?.trim();
    if (!userId) {
        return NextResponse.json({ error: 'userId wajib' }, { status: 400 });
    }
    let body: unknown;
    try {
        body = await req.json();
    }
    catch {
        return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 });
    }
    const payload = (body ?? {}) as {
        delta?: unknown;
        reason?: unknown;
    };
    const delta = typeof payload.delta === 'number' ? payload.delta : Number.NaN;
    const reason = typeof payload.reason === 'string' ? payload.reason : '';
    try {
        const db = createServiceClient();
        const { data: target, error: targetError } = await db
            .from('profiles')
            .select('id, email, full_name')
            .eq('id', userId)
            .maybeSingle();
        if (targetError) {
            console.error('[admin/user-coins] gagal membaca target:', targetError.message);
            return NextResponse.json({ error: 'Gagal membaca pengguna' }, { status: 500 });
        }
        if (!target) {
            return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
        }
        const ledger = await loadLedger(db, userId);
        if (!ledger.ok) {
            console.error('[admin/user-coins] gagal memuat ledger:', ledger.message);
            return NextResponse.json({ error: 'Gagal membaca saldo koin' }, { status: 500 });
        }
        const balanceBefore = computeCoinBalance(ledger.rows.map((r) => ({ type: String(r.type ?? ''), amount: asNumber(r.amount) })));
        const checked = validateAdjustment({ delta, reason, currentBalance: balanceBefore });
        if (!checked.ok) {
            return NextResponse.json({ error: checked.message, code: checked.code }, { status: 400 });
        }
        const row = resolveAdjustmentRow({ delta: checked.delta, reason: checked.reason });
        const { data: inserted, error: insertError } = await db
            .from('coin_transactions')
            .insert({
            user_id: userId,
            order_code: null,
            type: row.type,
            amount: row.amount,
            description: row.description,
        })
            .select('id, type, amount, description, created_at')
            .single();
        if (insertError) {
            console.error('[admin/user-coins] gagal menulis transaksi:', insertError.message);
            return NextResponse.json({ error: 'Gagal menyimpan penyesuaian koin' }, { status: 500 });
        }
        const balanceAfter = balanceBefore + checked.delta;
        const { error: auditError } = await db.from('admin_audit_logs').insert({
            admin_id: admin.id,
            action: 'adjust_coin_balance',
            target_type: 'user',
            target_id: userId,
            reason: checked.reason,
            metadata: {
                delta: checked.delta,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                transaction_id: (inserted as Row | null)?.id ?? null,
                transaction_type: row.type,
            },
        });
        if (auditError) {
            console.error('[admin/user-coins] audit gagal dicatat:', auditError.message);
        }
        return NextResponse.json({
            ok: true,
            balance: balanceAfter,
            transaction: rowToHistory((inserted ?? {}) as Row),
            auditRecorded: !auditError,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/user-coins] unexpected:', err);
        return NextResponse.json({ error: 'Gagal menyimpan penyesuaian koin' }, { status: 500 });
    }
}
