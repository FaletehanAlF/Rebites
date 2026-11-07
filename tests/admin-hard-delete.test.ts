import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluateHardDeletePreconditions, type HardDeleteImpact, } from '../lib/hard-delete.ts';
import { HARD_DELETE_PASSWORD_ENV, HARD_DELETE_UNCONFIGURED_MESSAGE, isHardDeleteConfigured, isHardDeletePasswordValid, } from '../lib/server/hard-delete-password.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const ROUTE = readProjectFile('app/api/admin/users/[id]/hard-deletion/route.ts');
const CLIENT = readProjectFile('lib/admin-users.ts');
const USER_DETAIL_ROUTE = readProjectFile('app/api/admin/users/[id]/route.ts');
const USERS_ROUTE = readProjectFile('app/api/admin/users/route.ts');
function impact(overrides: Partial<HardDeleteImpact> = {}): HardDeleteImpact {
    return {
        ordersAsBuyer: 0,
        ordersInStore: 0,
        activeOrders: 0,
        products: 0,
        reviews: 0,
        coinTransactions: 0,
        articles: 0,
        ...overrides,
    };
}
test('akun tanpa penghalang boleh dihapus permanen', () => {
    assert.deepEqual(evaluateHardDeletePreconditions(impact()), { allowed: true });
    assert.deepEqual(evaluateHardDeletePreconditions(impact({ ordersAsBuyer: 12, ordersInStore: 30, reviews: 4 })), { allowed: true });
});
test('pesanan yang belum selesai menahan penghapusan', () => {
    const verdict = evaluateHardDeletePreconditions(impact({ ordersAsBuyer: 3, activeOrders: 2 }));
    assert.equal(verdict.allowed, false);
    if (verdict.allowed)
        return;
    assert.equal(verdict.code, 'active-orders');
    assert.match(verdict.message, /2 pesanan/);
});
test('artikel penulis menahan penghapusan (FK RESTRICT)', () => {
    const verdict = evaluateHardDeletePreconditions(impact({ articles: 1 }));
    assert.equal(verdict.allowed, false);
    if (verdict.allowed)
        return;
    assert.equal(verdict.code, 'articles');
    assert.match(verdict.message, /artikel/);
});
test('pesanan berjalan diperiksa lebih dulu daripada artikel', () => {
    const verdict = evaluateHardDeletePreconditions(impact({ activeOrders: 1, articles: 5 }));
    assert.equal(verdict.allowed, false);
    if (verdict.allowed)
        return;
    assert.equal(verdict.code, 'active-orders');
});
test('fitur mati bila sandi hapus belum diisi di env', () => {
    assert.equal(HARD_DELETE_PASSWORD_ENV, 'PASSWORD_DELETE_USER');
    assert.equal(isHardDeleteConfigured({}), false);
    assert.equal(isHardDeleteConfigured({ PASSWORD_DELETE_USER: '' }), false);
    assert.equal(isHardDeleteConfigured({ PASSWORD_DELETE_USER: '   ' }), false);
    assert.equal(isHardDeleteConfigured({ PASSWORD_DELETE_USER: 'rahasia' }), true);
    assert.match(HARD_DELETE_UNCONFIGURED_MESSAGE, /PASSWORD_DELETE_USER/);
    assert.doesNotMatch(HARD_DELETE_UNCONFIGURED_MESSAGE, /ADMIN_HARD_DELETE_PASSWORD/);
    assert.equal(isHardDeleteConfigured({ ADMIN_HARD_DELETE_PASSWORD: 'lama' }), false);
});
test('sandi konfirmasi hanya sah bila sama persis, dan tidak pernah kosong', () => {
    assert.equal(isHardDeletePasswordValid('rahasia-ku', 'rahasia-ku'), true);
    assert.equal(isHardDeletePasswordValid('rahasia-ku', 'rahasia-Ku'), false);
    assert.equal(isHardDeletePasswordValid('rahasia-ku', 'rahasia-ku '), false);
    assert.equal(isHardDeletePasswordValid('', ''), false);
    assert.equal(isHardDeletePasswordValid('', 'rahasia'), false);
    assert.equal(isHardDeletePasswordValid('rahasia', ''), false);
    assert.equal(isHardDeletePasswordValid(null, 'rahasia'), false);
    assert.equal(isHardDeletePasswordValid(undefined, undefined), false);
    assert.equal(isHardDeletePasswordValid(42, 42), false);
    assert.equal(isHardDeletePasswordValid('a', 'a'.repeat(200)), false);
    assert.equal(isHardDeletePasswordValid('sandi-rahasia-🦫', 'sandi-rahasia-🦫'), true);
});
test('route: GET menampilkan dampak, DELETE mengeksekusi', () => {
    assert.match(ROUTE, /export async function GET\(/);
    assert.match(ROUTE, /export async function DELETE\(/);
    assert.match(ROUTE, /impact,/);
    assert.match(ROUTE, /evaluateHardDeletePreconditions\(impact\)/);
});
test('route: HANYA Super Admin, memakai kebijakan yang sudah teruji', () => {
    assert.match(ROUTE, /canManageAccountDeletion\(actor, \{/);
    assert.match(ROUTE, /isSuperAdminUserId\(id\)/);
    assert.match(ROUTE, /getAdminActor\(authHeader\)/);
});
test('route: fitur MATI bila sandi belum dikonfigurasi (fail-closed)', () => {
    assert.match(ROUTE, /isHardDeleteConfigured\(process\.env\)/);
    assert.match(ROUTE, /HARD_DELETE_UNCONFIGURED_MESSAGE/);
    assert.match(ROUTE, /'hard-delete-disabled'[\s\S]{0,80}?503/);
    assert.match(ROUTE, /readHardDeletePassword\(\)/);
    assert.doesNotMatch(ROUTE, /ADMIN_HARD_DELETE_PASSWORD/);
});
test('route: sandi diperiksa sebelum eksekusi dan tidak pernah dicatat', () => {
    assert.match(ROUTE, /isHardDeletePasswordValid\(body\?\.password, expected\)/);
    assert.match(ROUTE, /\{ error: HARD_DELETE_PASSWORD_MISMATCH_MESSAGE \},\s*\{ status: 403 \}/);
    assert.doesNotMatch(ROUTE, /console\.(error|log|warn)\([^)]*password/i);
});
test('route: prasyarat diperiksa tepat sebelum penghapusan (409, bukan 500)', () => {
    assert.match(ROUTE, /precondition\.allowed/);
    assert.match(ROUTE, /code: precondition\.code, impact/);
    assert.match(ROUTE, /status: 409/);
    assert.match(ROUTE, /FINISHED_ORDER_STATUSES/);
    assert.match(ROUTE, /not\('order_status', 'in', FINISHED_STATUS_FILTER\)/);
});
test('route: menghapus permanen, bukan soft delete Supabase', () => {
    assert.match(ROUTE, /auth\.admin\.deleteUser\(id, false\)/);
    assert.match(ROUTE, /user_not_found/);
});
test('route: jejak audit permanen dicatat dan kegagalannya tidak disembunyikan', () => {
    assert.match(ROUTE, /action: 'hard_delete_user'/);
    assert.match(ROUTE, /metadata: \{ auto: true, email: asString\(row\.email\), impact \}/);
    assert.match(ROUTE, /audit_recorded: !auditErr/);
});
test('klien admin memakai fetchAdminWithAuth (satu refresh + satu retry)', () => {
    assert.match(CLIENT, /fetchAdminHardDeletePreview/);
    assert.match(CLIENT, /hardDeleteAdminUser/);
    assert.match(CLIENT, /\/hard-deletion/);
    assert.match(CLIENT, /async function adminFetch/);
    assert.match(CLIENT, /fetchAdminWithAuth\(input, init\)/);
});
test('daftar & detail pengguna membawa account_status untuk badge', () => {
    assert.match(USER_DETAIL_ROUTE, /'account_status',/);
    assert.match(USER_DETAIL_ROUTE, /account_status: row\.account_status \?\? null/);
    assert.match(USERS_ROUTE, /'account_status',/);
    assert.match(USERS_ROUTE, /account_status: r\.account_status \?\? null/);
});
