import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const ISSUE_ROUTE = readProjectFile('app/api/admin/sanctions/route.ts');
const REVOKE_ROUTE = readProjectFile('app/api/admin/sanctions/[id]/route.ts');
test('menerbitkan sanksi juga menutup toko milik pemiliknya', () => {
    assert.match(ISSUE_ROUTE, /\.from\('umkm_profiles'\)/);
    assert.match(ISSUE_ROUTE, /is_active: false/);
    assert.match(ISSUE_ROUTE, /deactivation_reason:/);
    assert.match(ISSUE_ROUTE, /store_deactivated/);
    assert.match(ISSUE_ROUTE, /store\.is_active !== false/);
    assert.match(ISSUE_ROUTE, /deactivate store error/);
});
test('menerbitkan sanksi menyelaraskan ban Supabase Auth', () => {
    assert.match(ISSUE_ROUTE, /syncAccountBan\(createServiceClient\(BAN_SYNC_TIMEOUT_MS\), userId\)/);
    assert.match(ISSUE_ROUTE, /ban_synced: banSynced/);
    assert.match(ISSUE_ROUTE, /const BAN_SYNC_TIMEOUT_MS = 10000;/);
});
test('mencabut sanksi mencabut ban Supabase Auth', () => {
    assert.match(REVOKE_ROUTE, /syncAccountBan\(\s*createServiceClient\(BAN_SYNC_TIMEOUT_MS\),\s*targetUserId\s*\)/);
    assert.match(REVOKE_ROUTE, /ban_synced: banSynced/);
});
test('sinkronisasi hanya untuk sanksi suspend/ban', () => {
    const issueGuard = ISSUE_ROUTE.slice(ISSUE_ROUTE.indexOf('let storeDeactivated'));
    assert.match(issueGuard, /if \(type === 'suspend' \|\| type === 'ban'\)/);
    const revokeGuard = REVOKE_ROUTE.slice(REVOKE_ROUTE.indexOf('let banSynced'));
    assert.match(revokeGuard, /if \(sanctionType === 'suspend' \|\| sanctionType === 'ban'\)/);
});
