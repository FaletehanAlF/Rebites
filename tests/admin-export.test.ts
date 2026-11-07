import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ADMIN_EXPORT_MAX_ROWS, adminExportFilename, adminExportLimitMessage, chunkValues, fetchRowsInChunks, } from '../lib/admin-export-rules.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}
const EXPORT_ROUTES = [
    'app/api/admin/users/export/route.ts',
    'app/api/admin/orders/export/route.ts',
    'app/api/admin/products/export/route.ts',
    'app/api/admin/umkm/export/route.ts',
];
test('nama berkas ekspor memakai tanggal WIB, bukan zona waktu server', () => {
    assert.equal(adminExportFilename('pengguna', Date.parse('2026-10-26T16:59:59.000Z')), 'pengguna-rebites-2026-10-26.xlsx');
    assert.equal(adminExportFilename('pengguna', Date.parse('2026-10-26T17:00:00.000Z')), 'pengguna-rebites-2026-10-27.xlsx');
});
test('pesan batas memuat angka batas dan perintah mempersempit filter', () => {
    const message = adminExportLimitMessage('pengguna', 7500);
    assert.ok(message.includes('7.500'));
    assert.ok(message.includes(ADMIN_EXPORT_MAX_ROWS.toLocaleString('id-ID')));
    assert.ok(message.includes('Persempit filter'));
});
test('chunkValues: tidak menghilangkan atau menggandakan nilai', () => {
    assert.deepEqual(chunkValues([], 3), []);
    assert.deepEqual(chunkValues(['a', 'b', 'c', 'd', 'e'], 2), [
        ['a', 'b'],
        ['c', 'd'],
        ['e'],
    ]);
    assert.deepEqual(chunkValues(['a', 'b'], 0), [['a'], ['b']]);
    assert.deepEqual(chunkValues(['a', 'b'], Number.NaN), [['a'], ['b']]);
});
test('fetchRowsInChunks: berhenti pada error pertama, tidak menganggapnya lengkap', async () => {
    const calls: string[][] = [];
    const result = await fetchRowsInChunks<{
        id: string;
    }>(['a', 'b', 'c'], 2, async (chunk) => {
        calls.push(chunk);
        if (chunk.includes('c'))
            return { data: null, error: new Error('gagal') };
        return { data: [{ id: chunk[0] }], error: null };
    });
    assert.deepEqual(calls, [['a', 'b'], ['c']]);
    assert.ok(result.error instanceof Error);
    assert.deepEqual(result.rows, [{ id: 'a' }]);
});
test('fetchRowsInChunks: tanpa id tidak ada permintaan sama sekali', async () => {
    let called = 0;
    const result = await fetchRowsInChunks<{
        id: string;
    }>([], 200, async () => {
        called += 1;
        return { data: [], error: null };
    });
    assert.equal(called, 0);
    assert.deepEqual(result.rows, []);
    assert.equal(result.error, null);
});
test('route ekspor: penjaga admin, sesi RLS, tanpa service role', () => {
    for (const path of EXPORT_ROUTES) {
        const source = readProjectFile(path);
        assert.match(source, /getAdminUser\(authHeader\)/, `${path} tanpa penjaga admin`);
        assert.ok(source.includes('status: user ? 403 : 401'), `${path} tanpa jalur 403/401`);
        assert.match(source, /createAuthedServerClient\(authHeader\)/, `${path} tidak memakai sesi admin (RLS)`);
        assert.doesNotMatch(source, /createServiceClient|service_role|SERVICE_ROLE/, `${path} memakai kunci layanan`);
        assert.doesNotMatch(source, /select\('\*'\)/, `${path} memakai select bintang`);
        assert.doesNotMatch(source, /select\("\*"\)/, `${path} memakai select bintang`);
        assert.doesNotMatch(source, /err instanceof Error \? err\.message/, `${path} membocorkan pesan internal`);
    }
});
test('route ekspor: batas baris ditolak 413 dengan pesan jelas', () => {
    for (const path of EXPORT_ROUTES) {
        const source = readProjectFile(path);
        assert.match(source, /fetchAllPages/, `${path} tidak membaca semua halaman`);
        assert.match(source, /ADMIN_EXPORT_MAX_ROWS/, `${path} tanpa batas baris`);
        assert.match(source, /PageLimitError/, `${path} tanpa penanganan batas`);
        assert.match(source, /status: 413/, `${path} tidak menjawab 413`);
        assert.match(source, /adminExportLimitMessage/, `${path} tanpa pesan batas bersama`);
        assert.match(source, /buildAdminExportResponse/, `${path} tidak memakai pembangun respons bersama`);
        assert.match(source, /adminExportFilename/, `${path} tanpa nama berkas WIB`);
    }
});
test('ekspor pengguna memakai filter dan istilah yang sama dengan daftar', () => {
    const source = readProjectFile('app/api/admin/users/export/route.ts');
    assert.match(source, /sellerStatus/);
    assert.match(source, /resolveSellerStatus/);
    assert.match(source, /isSuperAdminUserId/);
    assert.match(source, /computeCoinBalance/);
    assert.match(source, /includeDeleted/);
    assert.ok(source.includes(".is('deleted_at', null)"));
});
test('ekspor pesanan memakai allowlist filter yang sama dengan daftar', () => {
    const source = readProjectFile('app/api/admin/orders/export/route.ts');
    for (const nama of [
        'ORDER_STATUS_ALLOWLIST',
        'PAYMENT_STATUS_ALLOWLIST',
        'DELIVERY_OPTION_ALLOWLIST',
        'LIFECYCLE_ALLOWLIST',
        'SHIPMENT_ALLOWLIST',
    ]) {
        assert.ok(source.includes(nama), `${nama} hilang dari ekspor pesanan`);
    }
    assert.match(source, /sanitizeSearchTerm/);
    assert.match(source, /fetchRowsInChunks/);
});
test('ekspor produk memakai varian pencarian keeping-words dan relasi toko', () => {
    const source = readProjectFile('app/api/admin/products/export/route.ts');
    assert.match(source, /sanitizeSearchTermKeepingWords/);
    assert.match(source, /umkm:umkm_profiles/);
    assert.doesNotMatch(source, /fetchRowsInChunks/);
});
test('ekspor UMKM menyembunyikan yang terhapus default dan memakai nama tampilan toko', () => {
    const source = readProjectFile('app/api/admin/umkm/export/route.ts');
    assert.match(source, /VERIFICATION_ALLOWLIST/);
    assert.match(source, /includeDeleted/);
    assert.ok(source.includes(".is('deleted_at', null)"));
    assert.match(source, /displayBusinessName/);
});
test('empat halaman admin punya tombol ekspor yang menunjuk rute dan filter aktifnya', () => {
    const hook = readProjectFile('hooks/use-admin-export.ts');
    const controls = readProjectFile('app/components/admin/admin-export-controls.tsx');
    assert.match(hook, /downloadAdminExport/);
    assert.match(hook, /new AbortController/);
    assert.match(hook, /isAbortError/);
    assert.match(hook, /Ekspor dibatalkan karena filter berubah/);
    assert.match(hook, /redirectIfSessionExpired/);
    assert.match(controls, /Ekspor Excel/);
    assert.match(controls, /5\.000/);
    const halaman: {
        path: string;
        url: string;
    }[] = [
        { path: 'app/components/admin/users-management-view.tsx', url: '/api/admin/users/export' },
        { path: 'app/components/admin/orders-management-view.tsx', url: '/api/admin/orders/export' },
        {
            path: 'app/components/admin/products-management-view.tsx',
            url: '/api/admin/products/export',
        },
        { path: 'app/components/admin/umkm-management-view.tsx', url: '/api/admin/umkm/export' },
    ];
    for (const { path, url } of halaman) {
        const source = readProjectFile(path);
        assert.ok(source.includes(url), `${path} tidak menunjuk ${url}`);
        assert.match(source, /useAdminExport\(/, `${path} tidak memakai hook ekspor bersama`);
        assert.match(source, /AdminExportButton/, `${path} tanpa tombol ekspor bersama`);
        assert.match(source, /AdminExportNotice/, `${path} tanpa pesan hasil ekspor`);
        assert.match(source, /new URLSearchParams\(\)/, `${path} tidak menyusun filter ekspor`);
    }
});
