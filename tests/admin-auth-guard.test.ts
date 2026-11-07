import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AdminProfileQueryError, SupabaseUnavailableError, classifyAdminProfile, isSupabaseUnavailable, } from '../lib/server/supabase-errors.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}
test('classifyAdminProfile: baris admin sah diterima', () => {
    assert.deepEqual(classifyAdminProfile({ role: 'admin', account_status: 'active' }, null), {
        status: 'admin',
    });
    assert.deepEqual(classifyAdminProfile({ role: 'admin' }, null), { status: 'admin' });
    assert.deepEqual(classifyAdminProfile({ role: 'admin', account_status: null }, null), {
        status: 'admin',
    });
    assert.deepEqual(classifyAdminProfile({ role: 'admin', account_status: '  ACTIVE  ' }, null), { status: 'admin' });
    assert.deepEqual(classifyAdminProfile({ role: 'admin', account_status: 'probation' }, null), {
        status: 'admin',
    });
});
test('classifyAdminProfile: non-admin dan baris kosong ditolak 403, bukan 5xx', () => {
    for (const data of [
        { role: 'buyer', account_status: 'active' },
        { role: 'umkm' },
        { role: null },
        {},
        null,
        undefined,
        'admin',
    ]) {
        assert.deepEqual(classifyAdminProfile(data, null), { status: 'not-admin' }, `data ${JSON.stringify(data)} harus not-admin`);
    }
});
test('classifyAdminProfile: sanksi suspend/ban tetap mencabut akses admin', () => {
    for (const account_status of ['suspended', 'banned', ' SUSPENDED ']) {
        assert.deepEqual(classifyAdminProfile({ role: 'admin', account_status }, null), {
            status: 'not-admin',
        });
    }
});
test('classifyAdminProfile: gangguan upstream bukan "bukan admin"', () => {
    const verdict = classifyAdminProfile(null, {
        message: 'TypeError: fetch failed',
        code: '',
    });
    assert.equal(verdict.status, 'unavailable');
    assert.equal(isSupabaseUnavailable((verdict as {
        error: unknown;
    }).error), true);
});
test('classifyAdminProfile: penolakan PostgREST ber-kode adalah profile-error (500), bukan 503/403', () => {
    const verdict = classifyAdminProfile(null, {
        message: 'permission denied for table profiles',
        code: '42501',
    });
    assert.equal(verdict.status, 'profile-error');
    assert.equal(isSupabaseUnavailable((verdict as {
        error: unknown;
    }).error), false);
});
test('error profil admin dapat dibedakan dari gangguan upstream', () => {
    assert.equal(isSupabaseUnavailable(new SupabaseUnavailableError(new Error('x'))), true);
    assert.equal(isSupabaseUnavailable(new AdminProfileQueryError(new Error('x'))), false);
});
test('getAdminUser: kegagalan query dilempar sebagai 503/500, bukan null', () => {
    const source = readProjectFile('lib/server/supabase.ts');
    assert.match(source, /classifyAdminProfile\(data, error\)/);
    assert.match(source, /if \(verdict\.status === 'unavailable'\)[\s\S]{0,120}throw new SupabaseUnavailableError/);
    assert.match(source, /if \(verdict\.status === 'profile-error'\)[\s\S]{0,120}throw new AdminProfileQueryError/);
    assert.doesNotMatch(source, /const \{ data \} = await service/);
    assert.doesNotMatch(source, /if \(!data \|\| data\.role !== 'admin'\) return null;/);
});
test('getAdminUser: query profil dibatasi waktu agar tidak menggantung', () => {
    const source = readProjectFile('lib/server/supabase.ts');
    assert.match(source, /createServiceClient\(SUPABASE_FETCH_TIMEOUT_MS\)/);
});
test('useRequireAdmin: empat status terpisah dan tidak redirect saat gangguan', () => {
    const source = readProjectFile('hooks/use-require-admin.ts');
    for (const status of ['loading', 'admin', 'forbidden', 'unauthenticated', 'error']) {
        assert.match(source, new RegExp(`"${status}"`), `status ${status} harus ada`);
    }
    assert.match(source, /if \(httpStatus === 401\)[\s\S]{0,160}router\.replace\("\/auth\/login"\)/);
    assert.match(source, /if \(httpStatus === 403\)[\s\S]{0,1500}getHomePathForRole\(role\)/);
    assert.match(source, /if \(httpStatus === 403\)[\s\S]{0,1500}router\.replace\(destination\)/);
    assert.match(source, /let destination = "\/home";/);
    assert.doesNotMatch(source, /httpStatus === 403[\s\S]{0,200}router\.replace\("\/"\)/);
    assert.match(source, /setErrorMessage\(ERROR_MESSAGE\);\s*setStatus\("error"\);/);
    assert.doesNotMatch(source, /catch \{\s*if \(mounted\) router\.replace/);
    assert.match(source, /isAdmin: status === "admin"/);
    assert.match(source, /ADMIN_CHECK_TIMEOUT_MS/);
});
test('AdminShell: menampilkan retry saat pemeriksaan gagal, tidak merender isi halaman', () => {
    const source = readProjectFile('app/components/admin/admin-shell.tsx');
    assert.match(source, /status === 'error'[\s\S]{0,400}onRetry=\{retry\}/);
    assert.match(source, /if \(status !== 'admin'\)/);
});
test('helper sesi: 401 yang berhasil di-refresh tidak dianggap selesai', () => {
    const source = readProjectFile('app/components/admin/admin-session.ts');
    assert.match(source, /if \(!refreshed\) \{\s*router\.replace\('\/auth\/login'\);\s*return true;\s*\}\s*return false;/);
    assert.match(source, /if \(status === 503\) \{\s*onOffline\(\);\s*return true;\s*\}/);
    const refreshCalls = source.match(/refreshAdminSessionSafe\(\)/g) ?? [];
    assert.equal(refreshCalls.length, 1);
});
test('delapan view admin memakai helper sesi bersama dan penjaga respons basi', () => {
    const views = [
        'app/components/admin/activity-logs-view.tsx',
        'app/components/admin/audit-logs-view.tsx',
        'app/components/admin/moderation-history.tsx',
        'app/components/admin/moderation-hub.tsx',
        'app/components/admin/products-management-view.tsx',
        'app/components/admin/role-requests-view.tsx',
        'app/components/admin/subscriptions-management-view.tsx',
        'app/components/admin/umkm-detail-view.tsx',
    ];
    for (const file of views) {
        const source = readProjectFile(file);
        assert.match(source, /import \{ redirectIfSessionExpired \} from '\.\/admin-session';/, `${file} harus memakai helper bersama`);
        assert.doesNotMatch(source, /async function redirectIfSessionExpired\(/, `${file} masih mendefinisikan salinan helper`);
        assert.match(source, /useRef\(0\)/, `${file} harus punya penjaga respons basi`);
        assert.match(source, /if \(requestId !== requestIdRef\.current\)[\s\S]{0,20}return;/, `${file} harus mengabaikan respons lama`);
        assert.match(source, /redirectIfSessionExpired\([\s\S]{0,600}setStatus\('error'\)/, `${file} harus menampilkan error setelah refresh berhasil`);
    }
});
test('enam lib admin: satu refresh + satu retry, tanpa getAdminAuthHeader', () => {
    const libs = [
        'lib/admin-products.ts',
        'lib/admin-subscriptions.ts',
        'lib/admin-umkm.ts',
        'lib/role-requests.ts',
        'lib/admin-activity-logs.ts',
        'lib/admin-audit-logs.ts',
        'lib/admin-users.ts',
    ];
    for (const file of libs) {
        const source = readProjectFile(file);
        assert.match(source, /fetchAdminWithAuth/, `${file} harus memakai fetchAdminWithAuth`);
        assert.doesNotMatch(source, /getAdminAuthHeader/, `${file} masih mengambil token tanpa retry 401`);
        assert.doesNotMatch(source, /while \(|for \(;;\)/, `${file} tidak boleh punya loop retry`);
        assert.match(source, /instanceof AuthError/, `${file} harus memetakan AuthError ke ApiError`);
    }
});
test('lib admin tidak menduplikasi helper fetch baru di view', () => {
    for (const file of [
        'app/components/admin/activity-logs-view.tsx',
        'app/components/admin/audit-logs-view.tsx',
        'app/components/admin/moderation-hub.tsx',
        'app/components/admin/products-management-view.tsx',
        'app/components/admin/role-requests-view.tsx',
        'app/components/admin/subscriptions-management-view.tsx',
        'app/components/admin/umkm-detail-view.tsx',
    ]) {
        const source = readProjectFile(file);
        assert.doesNotMatch(source, /fetchAdminWithAuth/, `${file} tidak boleh memanggil fetch mentah; gunakan lib admin${file.includes('activity-logs') ? '-activity-logs' : ''}`);
    }
});
