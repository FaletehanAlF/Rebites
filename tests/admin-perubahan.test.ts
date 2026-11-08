import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
function projectPathExists(relativePath: string): boolean {
    return existsSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)));
}
const SANCTIONS_ROUTE = readProjectFile('app/api/admin/sanctions/route.ts');
const SANCTION_REVOKE_ROUTE = readProjectFile('app/api/admin/sanctions/[id]/route.ts');
const STATUS_HISTORY_ROUTE = readProjectFile('app/api/admin/orders/[id]/status-history/route.ts');
const ADMIN_ORDERS_CLIENT = readProjectFile('lib/admin-orders.ts');
const ORDERS_VIEW = readProjectFile('app/components/admin/orders-management-view.tsx');
const SANCTIONS_VIEW = readProjectFile('app/components/admin/sanctions-view.tsx');
const SANCTIONS_CLIENT = readProjectFile('lib/admin-sanctions.ts');
const NOTIFICATION_STORAGE = readProjectFile('lib/notification-storage.ts');
const ALERT_POPUP = readProjectFile('app/components/notification/notification-alert-popup.tsx');
test('sanksi: PATCH berada di route [id], bukan route koleksi', () => {
    assert.doesNotMatch(SANCTIONS_ROUTE, /export async function PATCH/);
    assert.match(SANCTION_REVOKE_ROUTE, /export async function PATCH/);
    assert.match(SANCTION_REVOKE_ROUTE, /params\.id/);
    assert.match(SANCTION_REVOKE_ROUTE, /action !== 'revoke'/);
});
test('sanksi: pencabutan memulihkan status akun lewat fungsi sadar-sanksi-lain', () => {
    assert.match(SANCTION_REVOKE_ROUTE, /\.rpc\('restore_account_status_if_clear'/);
    assert.match(SANCTION_REVOKE_ROUTE, /sudah berakhir/);
});
test('sanksi: daftar admin menjalankan sweep kedaluwarsa sebagai jaring pengaman', () => {
    assert.match(SANCTIONS_ROUTE, /\.rpc\('release_expired_sanctions'\)/);
    assert.match(SANCTIONS_ROUTE, /sweep kedaluwarsa gagal/);
});
test('migrasi siklus sanksi: tipe notifikasi, pemetaan peran, dan trigger', () => {
    const mig = readProjectFile('supabase/migrations/20261104030000_sanction_cycle_complete.sql');
    assert.match(mig, /'account_sanctioned'/);
    assert.match(mig, /'account_restored'/);
    assert.match(mig, /'courier_assigned'/);
    assert.match(mig, /'report_received'/);
    assert.match(mig, /CREATE OR REPLACE FUNCTION public\.notification_role_for/);
    assert.match(mig, /CREATE OR REPLACE FUNCTION public\.restore_account_status_if_clear/);
    assert.match(mig, /CREATE OR REPLACE FUNCTION public\.release_expired_sanctions/);
    assert.match(mig, /DROP TRIGGER IF EXISTS trg_warnings_notify_seller/);
    assert.match(mig, /CREATE TRIGGER trg_sanctions_notify_user/);
    assert.match(mig, /RAISE EXCEPTION 'Akses ditolak/);
});
test('migrasi pemulihan internal: penanda transaksi hanya untuk jalur database', () => {
    const mig = readProjectFile('supabase/migrations/20261104040000_sanction_internal_release.sql');
    assert.match(mig, /rebites\.internal_sanction_release/);
    assert.match(mig, /session_user LIKE 'postgres%'/);
    assert.doesNotMatch(mig, /current_user IN\s*\(/);
});
test('sanksi: UI admin menawarkan pencabutan lewat konfirmasi dua langkah', () => {
    assert.match(SANCTIONS_VIEW, /revokeSanction/);
    assert.match(SANCTIONS_VIEW, /Cabut sanksi/);
    assert.match(SANCTIONS_VIEW, /canRevoke/);
    assert.match(SANCTIONS_CLIENT, /export async function revokeSanction/);
    assert.match(SANCTIONS_CLIENT, /method: 'PATCH'/);
});
test('alert akun: tipe bahaya terdaftar sebagai alert lintas peran', () => {
    assert.match(NOTIFICATION_STORAGE, /ALERT_NOTIFICATION_TYPES/);
    for (const t of ['user_warning', 'account_sanctioned', 'report_received']) {
        assert.ok(NOTIFICATION_STORAGE.includes(`'${t}'`), `tipe ${t} harus terdaftar`);
    }
    assert.match(ALERT_POPUP, /ALERT_NOTIFICATION_TYPES/);
    assert.match(ALERT_POPUP, /\.in\('type'/);
    assert.match(ALERT_POPUP, /markAsRead/);
    assert.doesNotMatch(ALERT_POPUP, /\.eq\('role'/);
});
test('alert akun: dipasang di shell pembeli dan penjual', () => {
    assert.match(readProjectFile('app/components/shared/buyer-shell.tsx'), /NotificationAlertPopup/);
    assert.match(readProjectFile('app/components/dashboard-penjual/SellerShell.tsx'), /NotificationAlertPopup/);
});
test('halaman sanksi pengguna hanya membaca baris milik sendiri', () => {
    assert.ok(projectPathExists('app/(app)/akun/sanksi/page.tsx'));
    const view = readProjectFile('app/components/profile/account-sanctions-view.tsx');
    assert.match(view, /\.eq\('user_id', userId\)/);
    assert.match(view, /Status &amp; Sanksi Akun/);
});
test('riwayat status pesanan: endpoint admin + panel detail', () => {
    assert.match(STATUS_HISTORY_ROUTE, /getAdminUser\(/);
    assert.match(STATUS_HISTORY_ROUTE, /\.from\('order_status_history'\)/);
    assert.doesNotMatch(STATUS_HISTORY_ROUTE, /export async function (POST|PATCH|DELETE)/);
    assert.match(ADMIN_ORDERS_CLIENT, /fetchAdminOrderStatusHistory/);
    assert.match(ORDERS_VIEW, /fetchAdminOrderStatusHistory/);
    assert.match(ORDERS_VIEW, /Riwayat status/);
    assert.doesNotMatch(ORDERS_VIEW, /menunggu audit keamanan lanjutan/);
});
test('endpoint admin lama yang tidak terpakai sudah dihapus', () => {
    assert.equal(projectPathExists('app/api/admin/moderation-logs/route.ts'), false);
    assert.equal(projectPathExists('app/api/admin/products/pending/route.ts'), false);
});
