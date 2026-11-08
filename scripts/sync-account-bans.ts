import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { activeSanctionEnds, computeBanDuration, syncAccountBan, } from '../lib/server/account-ban.ts';
type ProcessWithLoadEnvFile = NodeJS.Process & {
    loadEnvFile?: (path?: string) => void;
};
function tryLoadProjectEnv(): void {
    for (const rel of ['.env.local', '.env']) {
        const fullPath = path.resolve(process.cwd(), rel);
        if (!existsSync(fullPath))
            continue;
        const loadEnvFile = (process as ProcessWithLoadEnvFile).loadEnvFile;
        if (typeof loadEnvFile === 'function') {
            try {
                loadEnvFile.call(process, fullPath);
            }
            catch {
            }
            continue;
        }
        try {
            const raw = readFileSync(fullPath, 'utf8');
            for (const line of raw.split(/\r?\n/)) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#'))
                    continue;
                const eq = trimmed.indexOf('=');
                if (eq <= 0)
                    continue;
                const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, '');
                if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
                    continue;
                let value = trimmed.slice(eq + 1).trim();
                const hashIdx = value.indexOf(' #');
                if (hashIdx >= 0 && value[0] !== '"' && value[0] !== "'") {
                    value = value.slice(0, hashIdx).trim();
                }
                if ((value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
                    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)) {
                    value = value.slice(1, -1);
                }
                if (value && process.env[key] === undefined) {
                    process.env[key] = value;
                }
            }
        }
        catch {
        }
    }
}
function makeServiceClient(url: string, key: string): SupabaseClient {
    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
async function planFor(client: SupabaseClient, userId: string): Promise<{
    banDuration: string;
    activeSanctions: number;
}> {
    const { data, error } = await client
        .from('sanctions')
        .select('end_at')
        .eq('user_id', userId)
        .in('sanction_type', ['suspend', 'ban']);
    if (error)
        throw new Error(error.message);
    const nowMs = Date.now();
    const ends = activeSanctionEnds((data ?? []) as Array<{
        end_at?: unknown;
    }>, nowMs);
    return { banDuration: computeBanDuration(ends, nowMs), activeSanctions: ends.length };
}
async function main(): Promise<void> {
    const apply = process.argv.includes('--apply');
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
        tryLoadProjectEnv();
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !serviceKey) {
        console.log('BELUM SIAP - NEXT_PUBLIC_SUPABASE_URL dan/atau SUPABASE_SERVICE_ROLE_KEY tidak ada di environment maupun .env.local.');
        process.exit(1);
        return;
    }
    const client = makeServiceClient(url, serviceKey);
    const { data: rows, error } = await client
        .from('profiles')
        .select('id, email, account_status')
        .in('account_status', ['suspended', 'banned'])
        .order('created_at', { ascending: true })
        .limit(5000);
    if (error) {
        console.log(`GAGAL - tidak dapat membaca daftar akun: ${error.message}`);
        process.exit(1);
        return;
    }
    const targets = (rows ?? []) as Array<{
        id?: unknown;
        email?: unknown;
        account_status?: unknown;
    }>;
    console.log(`${apply ? 'MENERAPKAN' : 'UJI COBA'} - ${targets.length} akun berstatus suspended/banned.`);
    let ok = 0;
    let failed = 0;
    for (const row of targets) {
        const id = typeof row.id === 'string' ? row.id : null;
        if (!id)
            continue;
        const label = `${typeof row.email === 'string' ? row.email : id} (${String(row.account_status)})`;
        try {
            const plan = await planFor(client, id);
            if (!apply) {
                console.log(`  [rencana] ${label} -> ban ${plan.banDuration} (${plan.activeSanctions} sanksi aktif)`);
                ok += 1;
                continue;
            }
            const result = await syncAccountBan(client, id);
            if (result.synced) {
                console.log(`  [ok] ${label} -> ban ${result.banDuration}`);
                ok += 1;
            }
            else {
                console.log(`  [gagal] ${label} (alasan: ${result.reason ?? 'tidak diketahui'})`);
                failed += 1;
            }
        }
        catch (err) {
            console.log(`  [gagal] ${label}: ${err instanceof Error ? err.message : String(err)}`);
            failed += 1;
        }
    }
    console.log(`${apply ? 'SELESAI' : 'SELESAI (uji coba, tidak ada perubahan)'} - berhasil: ${ok}, gagal: ${failed}.`);
    if (!apply && targets.length > 0) {
        console.log('Jalankan ulang dengan "--" dan "--apply" untuk benar-benar menyetel ban.');
    }
    process.exit(failed > 0 ? 1 : 0);
}
void main();
