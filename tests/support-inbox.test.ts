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
const MIGRATION = readProjectFile('supabase/migrations/20261109000000_support_inbox.sql');
const APPEAL_ROUTE = readProjectFile('app/api/support/appeal/route.ts');
const STATUS_ROUTE = readProjectFile('app/api/support/appeal/status/route.ts');
const THREADS_ROUTE = readProjectFile('app/api/admin/chat/threads/route.ts');
const THREAD_ROUTE = readProjectFile('app/api/admin/chat/threads/[id]/route.ts');
const THREAD_VIEW = readProjectFile('app/components/admin/support-thread-view.tsx');
const INBOX_VIEW = readProjectFile('app/components/admin/support-inbox-view.tsx');
const SUPPORT_LIB = readProjectFile('lib/support.ts');
const BANDING_FORM = readProjectFile('app/components/support/banding-form.tsx');
const BADGE_HOOK = readProjectFile('hooks/use-support-badge.ts');
test('migrasi: tiga tabel percakapan + RLS aktif', () => {
    for (const table of ['support_threads', 'support_messages', 'support_appeals']) {
        assert.ok(MIGRATION.includes(`CREATE TABLE IF NOT EXISTS public.${table}`), `tabel ${table} hilang dari migrasi`);
    }
    assert.ok(MIGRATION.includes('ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY'));
    assert.ok(MIGRATION.includes('ALTER TABLE public.support_appeals ENABLE ROW LEVEL SECURITY'));
});
test('migrasi: hak tulis dicabut eksplisit dari klien', () => {
    assert.ok(MIGRATION.includes('REVOKE ALL ON public.support_threads, public.support_messages, public.support_appeals'));
    assert.ok(MIGRATION.includes('FROM PUBLIC, anon, authenticated;'));
    assert.ok(MIGRATION.includes('GRANT SELECT ON public.support_threads, public.support_messages, public.support_appeals'));
    for (const table of ['support_threads', 'support_messages', 'support_appeals']) {
        const policyBlock = MIGRATION.split('CREATE POLICY').filter((part) => part.includes(`ON public.${table}`));
        for (const block of policyBlock) {
            const forLine = block.slice(0, block.indexOf(';'));
            const allowsWrite = /FOR\s+(INSERT|UPDATE|DELETE|ALL)/i.test(forLine);
            const adminOnly = /public\.is_admin\(\)/i.test(forLine);
            assert.ok(!allowsWrite || adminOnly, `policy tulis non-admin pada ${table}: ${forLine.slice(0, 80)}`);
        }
    }
});
test('migrasi: kode banding acak + batas laju dikunci transaksi', () => {
    assert.ok(MIGRATION.includes('replace(gen_random_uuid()::text'));
    assert.ok(MIGRATION.includes('pg_advisory_xact_lock'));
    assert.ok(MIGRATION.includes("interval '1 hour'"));
    assert.ok(MIGRATION.includes('v_recent >= 3'));
});
test('migrasi: fungsi baca dan lanjutan banding dijaga definisi keamanan', () => {
    assert.ok(MIGRATION.includes('CREATE OR REPLACE FUNCTION public.mark_support_thread_read'));
    assert.ok(MIGRATION.includes('CREATE OR REPLACE FUNCTION public.append_appeal_followup'));
    assert.ok(MIGRATION.includes('REVOKE EXECUTE ON FUNCTION public.mark_support_thread_read'));
    assert.ok(MIGRATION.includes('GRANT EXECUTE ON FUNCTION public.mark_support_thread_read'));
    assert.ok(MIGRATION.includes('CONSTRAINT support_threads_profile_id_key UNIQUE (profile_id)'));
});
test('banding: bentuk respons tidak membedakan email terdaftar dan tidak', () => {
    const codeResponses = APPEAL_ROUTE.match(/\{ code \}/g) ?? [];
    assert.equal(codeResponses.length, 1);
    assert.ok(APPEAL_ROUTE.includes('escapeLikePattern'));
    assert.ok(APPEAL_ROUTE.includes('create_support_appeal'), 'banding harus dibuat lewat fungsi database (batas laju + satu transaksi)');
    assert.ok(APPEAL_ROUTE.includes('status: 503'));
});
test('banding: tanpa login, tetapi tulis lewat server', () => {
    assert.equal(APPEAL_ROUTE.includes('getUserFromBearer'), false);
    assert.equal(STATUS_ROUTE.includes('getUserFromBearer'), false);
    assert.ok(APPEAL_ROUTE.includes('createServiceClient'));
    assert.ok(STATUS_ROUTE.includes('createServiceClient'));
});
test('status banding: riwayat dimulai dari banding itu dibuat', () => {
    assert.ok(STATUS_ROUTE.includes("gte('created_at', appealCreatedAt)"));
    assert.ok(STATUS_ROUTE.includes('append_appeal_followup'));
    assert.ok(STATUS_ROUTE.includes('Kode banding tidak ditemukan'));
});
test('pembatas laju berlaku di kedua endpoint publik', () => {
    const limiter = readProjectFile('lib/server/support-rate-limit.ts');
    assert.ok(limiter.includes('export function allowSupportRequest'));
    assert.ok(limiter.includes('export function clientIpFrom'));
    assert.ok(APPEAL_ROUTE.includes('allowSupportRequest'));
    assert.ok(STATUS_ROUTE.includes('allowSupportRequest'));
    assert.ok(limiter.includes('MAX_TRACKED_KEYS'));
    assert.ok(limiter.includes('hits.clear()'));
});
test('jalur ke admin dari sisi pengguna hanya halaman banding', () => {
    assert.equal(projectPathExists('app/(app)/chat/page.tsx'), false);
    assert.equal(projectPathExists('app/(app)/dashboard/penjual/[storeId]/chat/page.tsx'), false);
    assert.equal(projectPathExists('app/(app)/dashboard/penjual/chat/page.tsx'), false);
    assert.equal(projectPathExists('app/components/support/support-chat.tsx'), false);
    assert.equal(projectPathExists('app/api/support/messages/route.ts'), false);
});
test('route admin memakai penjaga terpusat dan kolom eksplisit', () => {
    assert.ok(THREADS_ROUTE.includes('getAdminUser(authHeader)'));
    assert.ok(THREAD_ROUTE.includes('getAdminUser(authHeader)'));
    assert.equal(THREADS_ROUTE.includes('select(\'*\')'), false);
    assert.equal(THREAD_ROUTE.includes('select(\'*\')'), false);
    assert.ok(THREADS_ROUTE.includes('sanitizeSupportSearch'));
});
test('keputusan banding TIDAK mencabut sanksi di server route', () => {
    assert.equal(THREAD_ROUTE.includes('revokeSanction'), false);
    assert.equal(THREAD_ROUTE.includes('restore_account_status_if_clear'), false);
    assert.equal(THREAD_ROUTE.includes('syncAccountBan'), false);
    assert.ok(THREAD_ROUTE.includes("action === 'appeal_decision'"));
    assert.ok(THREAD_ROUTE.includes('isActiveBlockSanction'));
});
test('detail percakapan berupa halaman, bukan pop-up', () => {
    assert.equal(THREAD_VIEW.includes('<Dialog'), false);
    assert.ok(projectPathExists('app/dashboard/admin/chat/page.tsx'));
    assert.ok(projectPathExists('app/dashboard/admin/chat/[id]/page.tsx'));
    const detailPage = readProjectFile('app/dashboard/admin/chat/[id]/page.tsx');
    assert.ok(detailPage.includes('SupportThreadView'));
});
test('kotak pesan: membuka percakapan menandai baca dan menyingkatkan badge', () => {
    assert.ok(THREAD_VIEW.includes('markAdminSupportRead'));
    assert.ok(THREAD_VIEW.includes('revokeAllActiveBlocks(detail.activeBlocks)'));
    assert.equal(INBOX_VIEW.includes('markAdminSupportRead'), false);
    assert.ok(BADGE_HOOK.includes('export function useAdminSupportBadge'));
    assert.equal(BADGE_HOOK.includes('export function useUserSupportBadge'), false);
});
test('daftar percakapan dipakai bersama oleh halaman daftar dan percakapan', () => {
    const LIST = readProjectFile('app/components/admin/support-conversation-list.tsx');
    assert.ok(LIST.includes('export function SupportConversationList'));
    assert.ok(LIST.includes('fetchAdminSupportThreads'));
    assert.ok(THREAD_VIEW.includes('<SupportConversationList'));
    assert.ok(THREAD_VIEW.includes('activeThreadId={id}'));
    assert.ok(LIST.includes('aria-current={aktif ? \'page\' : undefined}'));
    assert.ok(INBOX_VIEW.includes('<SupportConversationList'));
    assert.ok(LIST.includes('/dashboard/admin/chat/${thread.id}'));
});
test('form login menawarkan banding saat akun diblokir', () => {
    const authForm = readProjectFile('app/components/auth/auth-form.tsx');
    const sellerForm = readProjectFile('app/components/auth/penjual-login-form.tsx');
    const callback = readProjectFile('app/auth/callback/page.tsx');
    for (const source of [authForm, sellerForm, callback]) {
        assert.ok(source.includes('isAccountBlockMessage'));
        assert.ok(source.includes('/banding'));
    }
    const accountBlock = readProjectFile('lib/account-block.ts');
    assert.ok(accountBlock.includes('export function isAccountBlockMessage'));
});
test('halaman banding publik tersedia tanpa penjaga sesi', () => {
    assert.ok(projectPathExists('app/banding/page.tsx'));
    assert.ok(projectPathExists('app/banding/status/page.tsx'));
    for (const page of ['app/banding/page.tsx', 'app/banding/status/page.tsx']) {
        const source = readProjectFile(page);
        assert.equal(source.includes('RequireAuth'), false);
    }
    assert.ok(BANDING_FORM.includes('BANDING_CODE_STORAGE_KEY'));
});
test('menu chat pengguna tidak ada lagi di navigasi mana pun', () => {
    const navigationFiles = [
        'app/components/shared/profile-sidebar-nav.tsx',
        'app/components/shared/MobileNavbar.tsx',
        'app/components/seller/dashboard-penjual/Sidebar.tsx',
        'app/components/seller/dashboard-penjual/MobileSellerNav.tsx',
    ];
    for (const path of navigationFiles) {
        const source = readProjectFile(path);
        assert.equal(source.includes("'/chat'"), false, `${path} masih menautkan /chat`);
        assert.equal(source.includes('"/chat"'), false, `${path} masih menautkan /chat`);
        assert.equal(source.includes('Chat Admin'), false, `${path} masih menyebut Chat Admin`);
    }
});
test('menu Chat admin punya badge merah dan judul topbar', () => {
    const sidebar = readProjectFile('app/components/admin/admin-sidebar.tsx');
    assert.ok(sidebar.includes("'/dashboard/admin/chat'"));
    assert.ok(sidebar.includes('useAdminSupportBadge'));
    assert.ok(sidebar.includes("badgeKind: 'support'"));
    const topbar = readProjectFile('app/components/admin/admin-topbar.tsx');
    assert.ok(topbar.includes("'/dashboard/admin/chat', title: 'Chat'"));
});
test('aturan bersama ada di lib/support, bukan disalin ke tiap komponen', () => {
    for (const name of [
        'export function normalizeSupportEmail',
        'export function isValidSupportEmail',
        'export function normalizeAppealCode',
        'export function isPlausibleAppealCode',
        'export function formatAppealCode',
        'export function appealStatusMeta',
        'export function sanitizeSupportSearch',
        'export function escapeLikePattern',
    ]) {
        assert.ok(SUPPORT_LIB.includes(name), `${name} hilang dari lib/support.ts`);
    }
});
