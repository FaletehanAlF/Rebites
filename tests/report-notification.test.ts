import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const MIGRATION = readFileSync(new URL('../supabase/migrations/20261021090000_report_notification_seller.sql', import.meta.url), 'utf8');
const REPORTS_ROUTE = readFileSync(new URL('../app/api/reports/route.ts', import.meta.url), 'utf8');
const NOTIFICATION_STORAGE = readFileSync(new URL('../lib/notification-storage.ts', import.meta.url), 'utf8');
const NOTIFICATION_ICON = readFileSync(new URL('../app/components/notification/notification-icon.tsx', import.meta.url), 'utf8');
const SELLER_VIEW = readFileSync(new URL('../app/components/notification/seller-notification-view.tsx', import.meta.url), 'utf8');
const USE_NOTIFICATIONS = readFileSync(new URL('../hooks/use-notifications.ts', import.meta.url), 'utf8');
type ReportRow = {
    id: string;
    reported_user_id: string | null;
    reported_by: string | null;
    category: string;
};
type NotificationRow = {
    user_id: string;
    role: 'buyer' | 'seller';
    type: string;
    title: string;
    message: string;
    reference_id: string;
    href: string;
};
function notifyOnReportCreated(report: ReportRow, existing: NotificationRow[] = []): NotificationRow[] {
    if (report.reported_user_id === null)
        return [];
    if (report.reported_by !== null && report.reported_by === report.reported_user_id)
        return [];
    const label = report.category === 'harassment'
        ? 'pelecehan'
        : report.category === 'spam'
            ? 'spam'
            : report.category === 'fraud'
                ? 'penipuan'
                : report.category === 'inappropriate_content'
                    ? 'konten tidak pantas'
                    : report.category === 'other'
                        ? 'lainnya'
                        : report.category || 'lainnya';
    const already = existing.some((n) => n.user_id === report.reported_user_id &&
        n.type === 'report_received' &&
        n.reference_id === report.id);
    if (already)
        return [];
    return [
        {
            user_id: report.reported_user_id,
            role: 'seller',
            type: 'report_received',
            title: 'Laporan Baru untuk Toko Anda',
            message: 'Ada laporan baru dengan kategori ' +
                label +
                '. Tim ReBites akan meninjaunya. Pastikan informasi toko dan pesanan Anda akurat.',
            reference_id: report.id,
            href: '/dashboard/penjual/notifikasi',
        },
    ];
}
const REPORTER = '11111111-1111-4111-8111-111111111111';
const STORE_OWNER = '22222222-2222-4222-8222-222222222222';
test('NOTIF-1: penerima notifikasi adalah pemilik toko, BUKAN pelapor', () => {
    const rows = notifyOnReportCreated({
        id: 'r-1',
        reported_user_id: STORE_OWNER,
        reported_by: REPORTER,
        category: 'fraud',
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, STORE_OWNER);
    assert.notEqual(rows[0].user_id, REPORTER);
    assert.equal(rows[0].role, 'seller');
    assert.equal(rows[0].type, 'report_received');
    assert.equal(rows[0].reference_id, 'r-1');
});
test('NOTIF-1: reported_user_id NULL (profil terhapus) => tidak ada notifikasi', () => {
    const rows = notifyOnReportCreated({
        id: 'r-2',
        reported_user_id: null,
        reported_by: REPORTER,
        category: 'spam',
    });
    assert.deepEqual(rows, []);
});
test('NOTIF-1: laporan atas diri sendiri => tidak ada notifikasi', () => {
    const rows = notifyOnReportCreated({
        id: 'r-3',
        reported_user_id: REPORTER,
        reported_by: REPORTER,
        category: 'other',
    });
    assert.deepEqual(rows, []);
});
test('NOTIF-1: notifikasi idempoten untuk report yang sama', () => {
    const report: ReportRow = {
        id: 'r-4',
        reported_user_id: STORE_OWNER,
        reported_by: REPORTER,
        category: 'harassment',
    };
    const first = notifyOnReportCreated(report);
    assert.equal(first.length, 1);
    const second = notifyOnReportCreated(report, first);
    assert.deepEqual(second, []);
});
test('NOTIF-1: pesan tidak membocorkan deskripsi laporan maupun identitas pelapor', () => {
    const description = 'Pembeli ini mengirim pesan kasar berulang kali.';
    const rows = notifyOnReportCreated({
        id: 'r-5',
        reported_user_id: STORE_OWNER,
        reported_by: REPORTER,
        category: 'harassment',
    });
    const message = rows[0].message;
    assert.ok(!message.includes(description), 'deskripsi laporan tidak boleh ikut');
    assert.ok(!message.includes(REPORTER), 'id pelapor tidak boleh ikut');
    assert.ok(!message.includes('reported_by'), 'nama kolom internal tidak boleh ikut');
    assert.match(message, /pelecehan/);
});
test('NOTIF-1: label kategori diterjemahkan, kategori tak dikenal tetap aman', () => {
    const cases: Array<[
        string,
        string
    ]> = [
        ['harassment', 'pelecehan'],
        ['spam', 'spam'],
        ['fraud', 'penipuan'],
        ['inappropriate_content', 'konten tidak pantas'],
        ['other', 'lainnya'],
        ['kategori-baru', 'kategori-baru'],
    ];
    for (const [category, expected] of cases) {
        const rows = notifyOnReportCreated({
            id: `r-${category}`,
            reported_user_id: STORE_OWNER,
            reported_by: REPORTER,
            category,
        });
        assert.match(rows[0].message, new RegExp(expected.replace(/[-]/g, '\\-')));
    }
});
test('NOTIF-1: notifikasi mengarah ke halaman notifikasi penjual', () => {
    const rows = notifyOnReportCreated({
        id: 'r-6',
        reported_user_id: STORE_OWNER,
        reported_by: REPORTER,
        category: 'spam',
    });
    assert.equal(rows[0].href, '/dashboard/penjual/notifikasi');
});
test('NOTIF-1: constraint memuat report_received DAN seluruh tipe lama', () => {
    const required = [
        'order_created',
        'payment_success',
        'order_delivering',
        'order_completed',
        'promo',
        'incoming_order',
        'new_review',
        'subscription_active',
        'subscription_renewed',
        'subscription_expiring',
        'subscription_changed',
        'subscription_expired',
        'product_approved',
        'product_rejected',
        'product_warning',
        'report_received',
    ];
    for (const type of required) {
        assert.ok(MIGRATION.includes(`'${type}'`), `tipe ${type} harus tetap ada di constraint`);
    }
    assert.match(MIGRATION, /DROP CONSTRAINT IF EXISTS notifications_type_check/);
    assert.match(MIGRATION, /ADD CONSTRAINT notifications_type_check/);
});
test('NOTIF-1: trigger AFTER INSERT pada public.reports', () => {
    assert.match(MIGRATION, /CREATE OR REPLACE FUNCTION public\.notify_on_report_created\(\)/);
    assert.match(MIGRATION, /RETURNS trigger/);
    assert.match(MIGRATION, /SECURITY DEFINER/);
    assert.match(MIGRATION, /SET search_path = public/);
    assert.match(MIGRATION, /DROP TRIGGER IF EXISTS trg_reports_notify_store ON public\.reports/);
    assert.match(MIGRATION, /CREATE TRIGGER trg_reports_notify_store\s+AFTER INSERT ON public\.reports\s+FOR EACH ROW EXECUTE FUNCTION public\.notify_on_report_created\(\)/);
});
test('NOTIF-1: penerima memakai NEW.reported_user_id (bukan reported_by)', () => {
    const insertBlock = MIGRATION.slice(MIGRATION.indexOf('INSERT INTO public.notifications'), MIGRATION.indexOf('EXCEPTION WHEN OTHERS'));
    assert.ok(insertBlock.length > 0);
    assert.match(insertBlock, /NEW\.reported_user_id/);
    assert.doesNotMatch(insertBlock, /NEW\.reported_by\s*,/);
    assert.match(MIGRATION, /IF NEW\.reported_by IS NOT NULL AND NEW\.reported_by = NEW\.reported_user_id THEN\s*RETURN NEW;/);
});
test('NOTIF-1: kegagalan notifikasi tidak ditelan diam-diam', () => {
    assert.match(MIGRATION, /EXCEPTION WHEN OTHERS THEN/);
    assert.match(MIGRATION, /GET STACKED DIAGNOSTICS/);
    assert.match(MIGRATION, /RAISE WARNING/);
    assert.match(MIGRATION, /RETURNED_SQLSTATE/);
    assert.match(MIGRATION, /MESSAGE_TEXT/);
    const exceptionBlock = MIGRATION.slice(MIGRATION.indexOf('EXCEPTION WHEN OTHERS THEN'));
    assert.doesNotMatch(exceptionBlock.slice(0, 900), /RAISE EXCEPTION/);
});
test('NOTIF-1: migration tidak melemahkan RLS/grants', () => {
    assert.doesNotMatch(MIGRATION, /DROP POLICY/);
    assert.doesNotMatch(MIGRATION, /CREATE POLICY/);
    assert.doesNotMatch(MIGRATION, /GRANT .* TO (anon|authenticated)/i);
    assert.doesNotMatch(MIGRATION, /DISABLE ROW LEVEL SECURITY/i);
    assert.match(MIGRATION, /REVOKE EXECUTE ON FUNCTION public\.notify_on_report_created\(\) FROM PUBLIC, anon, authenticated/);
});
test('NOTIF-1: tidak menyentuh pembayaran, coin, order, stok, atau sanksi', () => {
    assert.doesNotMatch(MIGRATION, /coin_transactions|coin_used|spend_order_coins/);
    assert.doesNotMatch(MIGRATION, /payment_status|xendit/i);
    assert.doesNotMatch(MIGRATION, /UPDATE public\.orders|stock_reserved_at|release_stock/);
    assert.doesNotMatch(MIGRATION, /sanctions|sanction_type/);
});
test('NOTIF-1: route laporan mensyaratkan reported_user_id punya toko', () => {
    assert.match(REPORTS_ROUTE, /\.from\('umkm_profiles'\)/);
    assert.match(REPORTS_ROUTE, /\.eq\('user_id', reportedUserId\)/);
    assert.match(REPORTS_ROUTE, /return 'no_store'/);
    assert.match(REPORTS_ROUTE, /'no_order'/);
    assert.match(REPORTS_ROUTE, /\.eq\('buyer_id', reporterId\)/);
});
test('NOTIF-1: tipe report_received dikenal klien notifikasi', () => {
    assert.match(NOTIFICATION_STORAGE, /'report_received'/);
    assert.match(NOTIFICATION_ICON, /report_received:/);
    assert.match(SELLER_VIEW, /MODERATION_TYPES[\s\S]{0,220}'report_received'/);
});
test('NOTIF-1: klien berlangganan notifications dengan filter user_id (isolasi)', () => {
    assert.match(USE_NOTIFICATIONS, /table: 'notifications'/);
    assert.match(USE_NOTIFICATIONS, /filter: `user_id=eq\.\$\{userId\}`/);
    assert.match(NOTIFICATION_STORAGE, /\.eq\('user_id', userId\)\s*\.eq\('role', role\)/);
});
