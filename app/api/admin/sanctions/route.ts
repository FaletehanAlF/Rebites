import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, createServiceClient, getAdminActor, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { canIssueSanction, isSuperAdminUserId } from '@/lib/admin-access';
import { syncAccountBan } from '@/lib/server/account-ban';
export const runtime = 'nodejs';
const BAN_SYNC_TIMEOUT_MS = 10000;
const SANCTIONS_SELECT = [
    'id',
    'user_id',
    'warning_id',
    'issued_by',
    'sanction_type',
    'reason',
    'start_at',
    'end_at',
    'created_at',
    'sanctionedUser:profiles!sanctions_user_id_fkey(id, full_name, email)',
    'issuer:profiles!sanctions_issued_by_fkey(id, full_name, email)',
].join(', ');
const VALID_TYPES = ['suspend', 'ban', 'delete'] as const;
type SanctionRow = Record<string, unknown>;
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
        const rawType = params.get('sanctionType');
        const sanctionType = rawType && (VALID_TYPES as readonly string[]).includes(rawType)
            ? rawType
            : null;
        if (rawType && !sanctionType) {
            return NextResponse.json({ error: `sanctionType tidak valid. Gunakan salah satu: ${VALID_TYPES.join(', ')}.` }, { status: 400 });
        }
        const rawUserId = params.get('userId');
        const rawWarningId = params.get('warningId');
        const rawFrom = params.get('from');
        const rawTo = params.get('to');
        const db = createAuthedServerClient(authHeader);
        const { error: sweepError } = await db.rpc('release_expired_sanctions');
        if (sweepError) {
            console.error('[admin/sanctions] sweep kedaluwarsa gagal', sweepError.message);
        }
        let query = db
            .from('sanctions')
            .select(SANCTIONS_SELECT, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (sanctionType) {
            query = query.eq('sanction_type', sanctionType);
        }
        if (rawUserId)
            query = query.eq('user_id', rawUserId);
        if (rawWarningId)
            query = query.eq('warning_id', rawWarningId);
        if (rawFrom)
            query = query.gte('created_at', rawFrom);
        if (rawTo)
            query = query.lte('created_at', rawTo);
        const { data, error, count } = await query;
        if (error) {
            console.error('[admin/sanctions] fetch error', error.message);
            return NextResponse.json({ error: 'Gagal memuat daftar sanksi.' }, { status: 500 });
        }
        const sanctions = (data ?? []).map((row) => {
            const r = row as unknown as SanctionRow;
            const sanctionedUser = asRecord(r.sanctionedUser);
            const issuer = asRecord(r.issuer);
            return {
                id: asString(r.id) ?? '',
                userId: asString(r.user_id) ?? asString(sanctionedUser?.id),
                userName: asString(sanctionedUser?.full_name) ?? asString(sanctionedUser?.email) ?? 'Tidak diketahui',
                userEmail: asString(sanctionedUser?.email),
                warningId: asString(r.warning_id),
                issuedBy: asString(r.issued_by) ?? asString(issuer?.id),
                issuerName: asString(issuer?.full_name) ?? asString(issuer?.email) ?? 'Tidak diketahui',
                issuerEmail: asString(issuer?.email),
                sanctionType: asString(r.sanction_type) ?? '',
                reason: asString(r.reason) ?? '',
                startAt: asString(r.start_at),
                endAt: asString(r.end_at),
                createdAt: asString(r.created_at) ?? '',
            };
        });
        return NextResponse.json({
            sanctions,
            total: count ?? sanctions.length,
            limit,
            offset,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/sanctions] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses sanksi." }, { status: 500 });
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
            userId?: unknown;
            sanctionType?: unknown;
            reason?: unknown;
            warningId?: unknown;
            endAt?: unknown;
            durationDays?: unknown;
            confirmText?: unknown;
        } | null;
        const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
        const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
        const type = typeof body?.sanctionType === 'string' ? body.sanctionType.trim() : '';
        const warningId = typeof body?.warningId === 'string' && body.warningId.trim()
            ? body.warningId.trim()
            : null;
        if (!userId)
            return NextResponse.json({ error: 'userId wajib.' }, { status: 400 });
        if (!(VALID_TYPES as readonly string[]).includes(type)) {
            return NextResponse.json({ error: `sanctionType tidak valid. Gunakan: ${VALID_TYPES.join(', ')}.` }, { status: 400 });
        }
        if (!reason) {
            return NextResponse.json({ error: 'reason WAJIB diisi.' }, { status: 400 });
        }
        if (type === 'delete') {
            const confirmText = typeof body?.confirmText === 'string' ? body.confirmText.trim() : '';
            if (confirmText !== 'DELETE') {
                return NextResponse.json({ error: "Konfirmasi delete wajib: ketik 'DELETE' pada field confirmText." }, { status: 400 });
            }
        }
        let endAt: string | null = null;
        if (typeof body?.endAt === 'string' && body.endAt.trim()) {
            const d = new Date(body.endAt);
            if (Number.isNaN(d.getTime())) {
                return NextResponse.json({ error: 'endAt tidak valid.' }, { status: 400 });
            }
            endAt = d.toISOString();
        }
        else if (typeof body?.durationDays === 'number' &&
            Number.isFinite(body.durationDays) &&
            body.durationDays > 0) {
            endAt = new Date(Date.now() + body.durationDays * 24 * 60 * 60 * 1000).toISOString();
        }
        if (endAt !== null && new Date(endAt).getTime() <= Date.now()) {
            return NextResponse.json({ error: 'endAt harus di masa depan.' }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: userRow, error: userErr } = await db
            .from('profiles')
            .select('id, account_status, role')
            .eq('id', userId)
            .maybeSingle();
        if (userErr) {
            console.error('[admin/sanctions] user check', userErr.message);
            return NextResponse.json({ error: 'Gagal memvalidasi pengguna.' }, { status: 500 });
        }
        if (!userRow) {
            return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
        }
        const targetRole = ((userRow as unknown) as Record<string, unknown>).role as string | null;
        const decision = canIssueSanction(actor, {
            id: userId,
            role: targetRole,
            isSuperAdmin: isSuperAdminUserId(userId),
        });
        if (!decision.allowed) {
            return NextResponse.json({ error: decision.message }, { status: decision.status });
        }
        if (warningId) {
            const { data: warnRow, error: warnErr } = await db
                .from('warnings')
                .select('id')
                .eq('id', warningId)
                .maybeSingle();
            if (warnErr) {
                console.error('[admin/sanctions] warning check', warnErr.message);
                return NextResponse.json({ error: 'Gagal memvalidasi peringatan.' }, { status: 500 });
            }
            if (!warnRow) {
                return NextResponse.json({ error: 'Peringatan tidak ditemukan.' }, { status: 404 });
            }
        }
        if (type === 'suspend' || type === 'ban') {
            const nextStatus = type === 'suspend' ? 'suspended' : 'banned';
            const { error: statusErr } = await db
                .from('profiles')
                .update({ account_status: nextStatus })
                .eq('id', userId);
            if (statusErr) {
                console.error('[admin/sanctions] status update error', statusErr.message);
                return NextResponse.json({ error: 'Gagal mengubah status akun.' }, { status: 500 });
            }
        }
        const { data: inserted, error: insertErr } = await db
            .from('sanctions')
            .insert({
            user_id: userId,
            warning_id: warningId,
            issued_by: actor.id,
            sanction_type: type,
            reason,
            end_at: endAt,
        })
            .select('id, user_id, warning_id, sanction_type, reason, start_at, end_at, created_at')
            .single();
        if (insertErr) {
            console.error('[admin/sanctions] insert error', insertErr.message);
            return NextResponse.json({ error: 'Gagal menyimpan sanksi.' }, { status: 500 });
        }
        let storeDeactivated = false;
        let banSynced = false;
        if (type === 'suspend' || type === 'ban') {
            const { data: storeRow, error: storeErr } = await db
                .from('umkm_profiles')
                .select('id, is_active')
                .eq('user_id', userId)
                .maybeSingle();
            if (storeErr) {
                console.error('[admin/sanctions] store fetch error', storeErr.message);
            }
            else if (storeRow) {
                const store = storeRow as unknown as Record<string, unknown>;
                const storeId = typeof store.id === 'string' ? store.id : null;
                if (storeId && store.is_active !== false) {
                    const { error: deactErr } = await db
                        .from('umkm_profiles')
                        .update({
                        is_active: false,
                        deactivation_reason: type === 'ban'
                            ? 'Akun pemilik diblokir oleh admin.'
                            : 'Akun pemilik ditangguhkan oleh admin.',
                    })
                        .eq('id', storeId)
                        .eq('is_active', true);
                    if (deactErr) {
                        console.error('[admin/sanctions] deactivate store error', deactErr.message);
                    }
                    else {
                        storeDeactivated = true;
                    }
                }
            }
            const ban = await syncAccountBan(createServiceClient(BAN_SYNC_TIMEOUT_MS), userId);
            banSynced = ban.synced;
        }
        return NextResponse.json({ sanction: inserted, store_deactivated: storeDeactivated, ban_synced: banSynced }, { status: 201 });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/sanctions] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses sanksi." }, { status: 500 });
    }
}
