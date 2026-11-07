import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const PANEL = readProjectFile('app/components/admin/account-block-panel.tsx');
const DETAIL = readProjectFile('app/components/admin/user-detail-view.tsx');
const ORDER_ROUTE = readProjectFile('app/api/orders/[code]/route.ts');
const ACCOUNT_BLOCK_LIB = readProjectFile('lib/account-block.ts');
test('panel memakai API sanksi yang ada, bukan endpoint baru', () => {
    assert.match(PANEL, /from '@.lib.admin-sanctions'/);
    assert.match(PANEL, /issueSanction\(\{ userId, sanctionType: 'ban'/);
    assert.match(PANEL, /revokeAllActiveBlocks\(activeBlocks\)/);
    assert.match(PANEL, /fetchSanctions\(100, 0, undefined, \{ userId \}\)/);
});
test('panel memakai aturan aktif yang teruji, bukan perbandingan tanggal sendiri', () => {
    assert.match(PANEL, /isActiveBlockSanction/);
    assert.match(ACCOUNT_BLOCK_LIB, /export function isActiveBlockSanction/);
    assert.match(ACCOUNT_BLOCK_LIB, /type !== 'suspend' && type !== 'ban'/);
});
test('buka blokir mencabut SEMUA sanksi aktif dari satu implementasi', () => {
    const client = readProjectFile('lib/admin-sanctions.ts');
    assert.match(client, /export async function revokeAllActiveBlocks/);
    assert.match(client, /for \(const item of blocks\)/);
    assert.match(client, /await revokeSanction\(item\.id\)/);
    assert.match(PANEL, /revokeAllActiveBlocks/);
    assert.match(readProjectFile('app/components/admin/support-thread-view.tsx'), /revokeAllActiveBlocks\(detail\.activeBlocks\)/);
    assert.match(PANEL, /Sebagian blokir belum tercabut/);
});
test('pemblokiran menuntut alasan dan konfirmasi dua langkah', () => {
    assert.match(PANEL, /Alasan pemblokiran wajib diisi/);
    assert.match(PANEL, /confirming === 'block'[\s\S]{0,200}Klik untuk konfirmasi pemblokiran/);
    const sanctionsRoute = readProjectFile('app/api/admin/sanctions/route.ts');
    assert.match(sanctionsRoute, /reason WAJIB diisi/);
});
test('panel menjelaskan bahwa blokir dapat dibuka kembali', () => {
    assert.match(PANEL, /dapat dibuka kembali/);
    assert.match(ACCOUNT_BLOCK_LIB, /Akun Anda telah diblokir oleh admin ReBites/);
});
test('panel terpasang di halaman detail pengguna', () => {
    assert.match(DETAIL, /<AccountBlockPanel/);
    assert.match(DETAIL, /accountStatus=\{user\.account_status\}/);
    assert.match(DETAIL, /targetProtected=\{user\.is_super_admin === true\}/);
});
test('endpoint pesanan memakai getAdminUser, bukan membaca kolom role sendiri', () => {
    assert.match(ORDER_ROUTE, /getAdminUser\(authHeader\)/);
    assert.doesNotMatch(ORDER_ROUTE, /select\('role'\)/);
    assert.doesNotMatch(ORDER_ROUTE, /= profile as Record<string, unknown>/);
});
test('form login menampilkan pesan akun diblokir sebagai peringatan merah', () => {
    const loginForm = readProjectFile('app/components/auth/auth-form.tsx');
    assert.match(loginForm, /isBannedAuthError\(err\)/);
    assert.match(loginForm, /setError\(BLOCKED_ACCOUNT_MESSAGE\)/);
    assert.match(loginForm, /role="alert"[\s\S]{0,200}text-destructive/);
    const sellerForm = readProjectFile('app/components/auth/penjual-login-form.tsx');
    assert.match(sellerForm, /isBannedAuthError\(signInError\)/);
    const currentUser = readProjectFile('lib/current-user.ts');
    assert.match(currentUser, /classifyAccountBlock\(data\)/);
    assert.match(currentUser, /blockMessageFor\(blockKind\)/);
});
