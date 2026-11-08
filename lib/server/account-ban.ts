import type { SupabaseClient } from '@supabase/supabase-js';
export const PERMANENT_BAN_DURATION = '876000h';
export const LIFT_BAN_DURATION = 'none';
const BAN_SAFETY_MARGIN_MS = 60000;
export function computeBanDuration(activeEndsAt: ReadonlyArray<string | null | undefined>, nowMs: number): string {
    if (activeEndsAt.length === 0)
        return LIFT_BAN_DURATION;
    let maxEndMs: number | null = null;
    for (const raw of activeEndsAt) {
        if (raw === null || raw === undefined)
            return PERMANENT_BAN_DURATION;
        const ms = Date.parse(String(raw));
        if (!Number.isFinite(ms))
            return PERMANENT_BAN_DURATION;
        if (maxEndMs === null || ms > maxEndMs)
            maxEndMs = ms;
    }
    const safeMs = (maxEndMs ?? nowMs) - nowMs - BAN_SAFETY_MARGIN_MS;
    if (safeMs <= 0)
        return '1s';
    const totalSeconds = Math.max(1, Math.floor(safeMs / 1000));
    if (totalSeconds < 60)
        return `${totalSeconds}s`;
    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes < 60)
        return `${totalMinutes}m`;
    return `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60}m`;
}
export function activeSanctionEnds(rows: ReadonlyArray<{
    end_at?: unknown;
}>, nowMs: number): Array<string | null> {
    const out: Array<string | null> = [];
    for (const row of rows) {
        const endAt = row?.end_at;
        if (typeof endAt !== 'string') {
            out.push(null);
            continue;
        }
        const ms = Date.parse(endAt);
        if (!Number.isFinite(ms)) {
            out.push(null);
            continue;
        }
        if (ms > nowMs)
            out.push(endAt);
    }
    return out;
}
export interface BanSyncResult {
    synced: boolean;
    banDuration: string | null;
    reason?: string;
}
export async function syncAccountBan(client: SupabaseClient, userId: string): Promise<BanSyncResult> {
    try {
        const [{ data: profile, error: profileErr }, { data: sanctionRows, error: sanctionErr },] = await Promise.all([
            client.from('profiles').select('account_status').eq('id', userId).maybeSingle(),
            client
                .from('sanctions')
                .select('end_at')
                .eq('user_id', userId)
                .in('sanction_type', ['suspend', 'ban']),
        ]);
        if (profileErr) {
            console.error('[account-ban] gagal membaca status akun:', profileErr.message);
            return { synced: false, banDuration: null, reason: 'profile-query' };
        }
        if (sanctionErr) {
            console.error('[account-ban] gagal membaca sanksi:', sanctionErr.message);
            return { synced: false, banDuration: null, reason: 'sanction-query' };
        }
        const statusRaw = (profile as {
            account_status?: unknown;
        } | null)?.account_status;
        const status = typeof statusRaw === 'string' ? statusRaw.trim().toLowerCase() : null;
        const nowMs = Date.now();
        const activeEnds = activeSanctionEnds((sanctionRows ?? []) as Array<{
            end_at?: unknown;
        }>, nowMs);
        const banDuration = status === 'suspended' || status === 'banned'
            ? computeBanDuration(activeEnds, nowMs)
            : LIFT_BAN_DURATION;
        const { error: authErr } = await client.auth.admin.updateUserById(userId, {
            ban_duration: banDuration,
        });
        if (authErr) {
            console.error('[account-ban] gagal menyinkronkan ban:', authErr.message);
            return { synced: false, banDuration, reason: 'auth-update' };
        }
        return { synced: true, banDuration };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[account-ban] tidak terduga:', message);
        return { synced: false, banDuration: null, reason: 'unexpected' };
    }
}
