import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const MIGRATION = readProjectFile('supabase/migrations/20261104050000_store_deactivation_cycle.sql');
const PREF_MIGRATION = readProjectFile('supabase/migrations/20261104060000_role_audit_and_user_preferences.sql');
const UMKM_ROUTE = readProjectFile('app/api/admin/umkm/[id]/route.ts');
const ACTIVATION_ROUTE = readProjectFile('app/api/admin/umkm/[id]/activation/route.ts');
const STORE_ACTIVATION_LIB = readProjectFile('lib/store-activation.ts');
const NOTICE = readProjectFile('app/components/seller/dashboard-penjual/store-deactivated-notice.tsx');
const SELLER_SHELL = readProjectFile('app/components/seller/dashboard-penjual/SellerShell.tsx');
const SIDEBAR = readProjectFile('app/components/admin/admin-sidebar.tsx');
const BADGE_HOOK = readProjectFile('hooks/use-store-activation-badge.ts');
const POST_LOGIN = readProjectFile('lib/auth-post-login.ts');
const PENJUAL_LOGIN = readProjectFile('app/components/auth/penjual-login-form.tsx');
const PREF_LIB = readProjectFile('lib/admin-preferences.ts');
const ADMIN_SHELL = readProjectFile('app/components/admin/admin-shell.tsx');
const BELL = readProjectFile('app/components/admin/admin-notification-bell.tsx');
const ACTIVITY_VIEW = readProjectFile('app/components/admin/activity-logs-view.tsx');
test('migrasi: kolom jejak penonaktifan + alasan wajib ditegakkan trigger', () => {
    assert.match(MIGRATION, /ADD COLUMN IF NOT EXISTS deactivation_reason text/);
    assert.match(MIGRATION, /deactivated_at timestamptz/);
    assert.match(MIGRATION, /deactivated_by uuid/);
    assert.match(MIGRATION, /Alasan penonaktifan toko wajib diisi/);
    assert.match(MIGRATION, /NEW\.deactivation_reason := NULL/);
    assert.match(MIGRATION, /NEW\.is_active := OLD\.is_active/);
});
test('migrasi: tabel permintaan aktivasi + satu pending per toko', () => {
    assert.match(MIGRATION, /CREATE TABLE IF NOT EXISTS public\.store_activation_requests/);
    assert.match(MIGRATION, /idx_sar_one_pending[\s\S]{0,140}WHERE status = 'pending'/);
    assert.match(MIGRATION, /CREATE POLICY "sar_select_own_or_admin"/);
    assert.match(MIGRATION, /CREATE POLICY "sar_update_admin"/);
    assert.match(MIGRATION, /NEW\.status := 'pending'/);
    assert.match(MIGRATION, /Hanya pemilik toko yang dapat mengajukan aktivasi/);
});
test('migrasi: activity_type memuat tiga tipe siklus toko + trigger jejaknya', () => {
    for (const type of ['store_deactivated', 'store_activated', 'store_activation_requested']) {
        assert.ok(MIGRATION.includes(`'${type}'`), `tipe ${type} harus ada di constraint`);
    }
    assert.match(MIGRATION, /trg_umkm_activity_activation/);
    assert.match(MIGRATION, /trg_sar_activity_request/);
    assert.match(MIGRATION, /'deactivate_store'/);
    assert.match(MIGRATION, /'activate_store'/);
});
test('migrasi: pembersihan login admin lama melindungi laporan yang merujuknya', () => {
    assert.match(MIGRATION, /activity_type = 'login'/);
    assert.match(MIGRATION, /p\.role = 'admin'/);
    assert.match(MIGRATION, /NOT EXISTS \(\s*SELECT 1 FROM public\.reports/);
});
test('route UMKM: nonaktif wajib ber-alasan dan menyimpan jejaknya', () => {
    assert.match(UMKM_ROUTE, /Alasan penonaktifan toko wajib diisi/);
    assert.match(UMKM_ROUTE, /deactivation_reason: reason/);
    assert.match(UMKM_ROUTE, /store_activation_requests/);
    assert.match(UMKM_ROUTE, /status: 'approved'/);
    assert.match(UMKM_ROUTE, /Toko diaktifkan langsung oleh admin/);
});
test('route keputusan aktivasi: approve mengaktifkan, reject wajib catatan', () => {
    assert.match(ACTIVATION_ROUTE, /getAdminUser\(/);
    assert.match(ACTIVATION_ROUTE, /Alasan penolakan wajib diisi/);
    assert.match(ACTIVATION_ROUTE, /\.update\(\{ is_active: true \}\)/);
    assert.match(ACTIVATION_ROUTE, /status: 409/);
    assert.doesNotMatch(ACTIVATION_ROUTE, /export async function (GET|POST|DELETE)/);
});
test('penjual: popup tengah bisa ditutup, banner merah tetap tampil', () => {
    assert.match(NOTICE, /role="alert"/);
    assert.match(NOTICE, /Nanti saja/);
    assert.match(NOTICE, /Kirim permintaan aktivasi/);
    assert.match(NOTICE, /Menunggu keputusan admin/);
    const noticeIdx = SELLER_SHELL.indexOf('<StoreDeactivatedNotice />');
    const mainIdx = SELLER_SHELL.indexOf('<main');
    assert.ok(noticeIdx > -1 && mainIdx > noticeIdx, 'banner harus di antara topbar dan main');
});
test('penjual: pengajuan ganda ditolak dengan pesan yang jelas', () => {
    assert.match(STORE_ACTIVATION_LIB, /'23505'/);
    assert.match(STORE_ACTIVATION_LIB, /masih menunggu keputusan admin/);
    assert.match(STORE_ACTIVATION_LIB, /deactivation_reason/);
});
test('badge merah Aktivitas dihitung dari permintaan aktivasi yang pending', () => {
    assert.match(BADGE_HOOK, /store_activation_requests/);
    assert.match(BADGE_HOOK, /\.eq\('status', 'pending'\)/);
    assert.match(SIDEBAR, /useStoreActivationBadge\(me !== null\)/);
    assert.match(SIDEBAR, /item\.href === '\/dashboard\/admin\/monitoring\/aktivitas'/);
    assert.match(SIDEBAR, /'store-activation'/);
    assert.match(SIDEBAR, /withActivationBadge\(MONITORING_MENU\)/);
    assert.match(SIDEBAR, /withActivationBadge\(MONITORING_CHILDREN\)/);
});
test('badge Aktivitas hilang begitu menunya dibuka, bukan menunggu keputusan', () => {
    assert.match(BADGE_HOOK, /ensureActivitySeenBaseline/);
    assert.match(BADGE_HOOK, /\.gt\('created_at', seenAt\)/);
    assert.match(BADGE_HOOK, /ADMIN_ACTIVITY_SEEN_EVENT/);
    assert.match(ACTIVITY_VIEW, /markActivitySeen\(\)/);
    assert.match(ACTIVITY_VIEW, /useEffect\(\(\) => \{\s*markActivitySeen\(\);\s*\}, \[\]\)/);
    assert.match(PREF_LIB, /export function ensureActivitySeenBaseline/);
    assert.match(PREF_LIB, /export function markActivitySeen/);
    assert.match(PREF_LIB, /ADMIN_ACTIVITY_SEEN_KEY/);
    assert.match(PREF_LIB, /activitySeenAt/);
    assert.match(PREF_LIB, /ADMIN_ACTIVITY_SEEN_KEY,/);
});
test('login admin tidak dicatat sebagai aktivitas', () => {
    assert.match(POST_LOGIN, /role !== 'admin'/);
    assert.match(PENJUAL_LOGIN, /if \(role !== "admin"\)/);
});
test('perubahan peran tercatat ke admin_audit_logs (lonceng admin membacanya)', () => {
    assert.match(PREF_MIGRATION, /'change_user_role'/);
    assert.match(PREF_MIGRATION, /INSERT INTO public\.admin_audit_logs/);
    assert.match(PREF_MIGRATION, /CREATE OR REPLACE FUNCTION public\.apply_role_change/);
});
test('preferensi panel admin tersinkron ke server, localStorage hanya cache', () => {
    assert.match(PREF_MIGRATION, /CREATE TABLE IF NOT EXISTS public\.user_preferences/);
    assert.match(PREF_MIGRATION, /user_preferences_select_own[\s\S]{0,220}auth\.uid\(\) = user_id/);
    assert.match(PREF_LIB, /syncAdminPreferencesFromServer/);
    assert.match(PREF_LIB, /pushAdminPreferenceData/);
    assert.match(PREF_LIB, /from\('user_preferences'\)/);
    assert.match(ADMIN_SHELL, /syncAdminPreferencesFromServer\(\)/);
});
test('status baca notifikasi admin ditulis dengan SATU patch per aksi', () => {
    assert.match(BELL, /persistReadIds\(new Set\(\), \{ notifLastSeen: now \}\)/);
});
