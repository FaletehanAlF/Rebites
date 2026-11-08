import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SupabaseUnavailableError, firstFailedQuery, isSupabaseUnavailable, isTransportFailure, } from '../lib/server/supabase-errors.ts';
import { isStructuralSafe, sanitizeSearchTerm, sanitizeSearchTermKeepingWords, } from '../lib/filter-search.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}
test('isSupabaseUnavailable: SupabaseUnavailableError dikenali sebagai gangguan upstream', () => {
    assert.equal(isSupabaseUnavailable(new SupabaseUnavailableError(new Error('boom'))), true);
});
test('isSupabaseUnavailable: bentuk nyata PostgREST saat TLS/DNS gagal dianggap gangguan', () => {
    assert.equal(isSupabaseUnavailable({
        message: 'TypeError: fetch failed',
        details: 'unable to verify the first certificate (UNABLE_TO_VERIFY_LEAF_SIGNATURE)',
        code: '',
    }), true);
    assert.equal(isSupabaseUnavailable({ message: 'fetch failed', code: '' }), true);
    assert.equal(isSupabaseUnavailable({ message: 'getaddrinfo ENOTFOUND db.example', code: '' }), true);
    assert.equal(isSupabaseUnavailable({ message: 'The operation timed out', code: '', name: 'TimeoutError' }), true);
});
test('isSupabaseUnavailable: penolakan PostgREST yang sah TIDAK dianggap gangguan upstream', () => {
    const rejections = [
        { message: 'permission denied for table profiles', code: '42501' },
        { message: 'relation "public.warnings" does not exist', code: '42P01' },
        { message: 'JSON object requested, multiple rows returned', code: 'PGRST116' },
        { message: 'duplicate key value violates unique constraint', code: '23505' },
    ];
    for (const err of rejections) {
        assert.equal(isSupabaseUnavailable(err), false, `seharusnya bukan unavailable: ${err.code}`);
    }
});
test('isSupabaseUnavailable: penolakan token tetap 401, bukan 503', () => {
    assert.equal(isSupabaseUnavailable({ name: 'AuthApiError', status: 403, message: 'invalid claim: missing sub claim' }), false);
    assert.equal(isSupabaseUnavailable({ name: 'AuthApiError', status: 401, message: 'invalid JWT' }), false);
    assert.equal(isSupabaseUnavailable({ name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' }), true);
});
test('isSupabaseUnavailable: nilai aneh tidak melempar dan tidak salah klasifikasi', () => {
    for (const value of [null, undefined, 0, '', false, [], 'fetch failed', {}, { code: '42501' }]) {
        assert.doesNotThrow(() => isSupabaseUnavailable(value));
        assert.equal(isSupabaseUnavailable(value), false, `nilai ${String(value)} bukan gangguan upstream`);
    }
});
test('isTransportFailure: butuh pesan transport DAN code kosong', () => {
    assert.equal(isTransportFailure({ message: 'fetch failed', code: '' }), true);
    assert.equal(isTransportFailure({ message: 'fetch failed', code: '42501' }), false);
    assert.equal(isTransportFailure({ message: 'semua baik', code: '' }), false);
    assert.equal(isTransportFailure({ code: '' }), false);
    assert.equal(isTransportFailure(null), false);
});
test('firstFailedQuery: query sukses dengan count nol BUKAN kegagalan', () => {
    const ok = [
        ['profiles total', { count: 0, data: null, error: null }],
        ['orders today', { count: 0, data: null, error: null }],
    ] as const;
    assert.equal(firstFailedQuery(ok), null);
});
test('firstFailedQuery: query sukses dengan data juga bukan kegagalan', () => {
    const ok = [
        ['profiles total', { count: 7, data: null, error: null }],
        ['warnings', { data: [{ user_id: 'a', warning_level: 1 }], error: null }],
    ] as const;
    assert.equal(firstFailedQuery(ok), null);
});
test('firstFailedQuery: error PostgREST terdeteksi dan menyebut query mana yang gagal', () => {
    const failed = firstFailedQuery([
        ['profiles total', { count: 0, data: null, error: null }],
        ['orders 14d', { data: null, error: { message: 'TypeError: fetch failed', code: '' } }],
        ['warnings', { data: null, error: { message: 'permission denied', code: '42501' } }],
    ] as const);
    assert.notEqual(failed, null);
    assert.equal(failed?.label, 'orders 14d');
});
test('firstFailedQuery: tidak ada kegagalan pada daftar kosong', () => {
    assert.equal(firstFailedQuery([]), null);
});
test('firstFailedQuery: hasil null/undefined tidak dianggap gagal', () => {
    assert.equal(firstFailedQuery([['x', null], ['y', undefined]] as const), null);
});
test('dashboard route: memakai firstFailedQuery dan berhenti sebelum menyusun statistik', () => {
    const route = readProjectFile('app/api/admin/dashboard/route.ts');
    assert.match(route, /firstFailedQuery\(/);
    assert.match(route, /if \(failed\) \{/);
    assert.match(route, /queryFailureResponse\(failed\.error, /);
    const failureIdx = route.indexOf('firstFailedQuery(');
    const firstZeroIdx = route.indexOf('.count ?? 0');
    assert.ok(failureIdx >= 0 && firstZeroIdx > failureIdx, 'count ?? 0 harus berada setelah pemeriksaan kegagalan');
});
test('dashboard route: autentikasi & otorisasi admin tidak dilonggarkan', () => {
    const route = readProjectFile('app/api/admin/dashboard/route.ts');
    assert.match(route, /getAdminUser\(authHeader\)/);
    assert.match(route, /status: user \? 403 : 401/);
    assert.match(route, /createAuthedServerClient\(authHeader\)/);
});
test('sanitizeSearchTerm: pencarian biasa dipertahankan', () => {
    assert.equal(sanitizeSearchTerm('kopi susu'), 'kopi susu');
    assert.equal(sanitizeSearchTerm('  Kopi  '), 'Kopi');
    assert.equal(sanitizeSearchTerm('warung-nasi_2'), 'warung-nasi_2');
    assert.equal(sanitizeSearchTerm('kafé'), 'kafé');
});
test('sanitizeSearchTerm: input kosong/null menjadi string kosong', () => {
    for (const value of [null, undefined, '', '   ']) {
        assert.equal(sanitizeSearchTerm(value), '');
    }
});
test('sanitizeSearchTerm: koma dan kurung dibuang (tidak bisa menambah kondisi or())', () => {
    const injected = sanitizeSearchTerm('kopi,status.eq.resolved');
    assert.equal(isStructuralSafe(injected), true);
    assert.ok(!injected.includes(','));
    assert.ok(!injected.includes('('));
    assert.ok(!injected.includes(')'));
    const grouped = sanitizeSearchTerm('a(b)c');
    assert.equal(grouped, 'abc');
});
test('sanitizeSearchTerm: wildcard % dibuang agar pencarian literal', () => {
    assert.equal(sanitizeSearchTerm('%'), '');
    assert.equal(sanitizeSearchTerm('kopi%'), 'kopi');
    assert.equal(sanitizeSearchTerm('%a%b%'), 'ab');
});
test('sanitizeSearchTerm: panjang dibatasi sebelum karakter struktur dibuang', () => {
    const long = 'a'.repeat(500);
    assert.equal(sanitizeSearchTerm(long, 100).length, 100);
    assert.equal(sanitizeSearchTerm(long).length, 100);
    assert.equal(sanitizeSearchTerm('abcdef', 3), 'abc');
});
test('sanitizeSearchTerm: urutan trim-lalu-potong dipertahankan (perilaku asli)', () => {
    const padded = ' '.repeat(30) + 'x'.repeat(150);
    assert.equal(sanitizeSearchTerm(padded).length, 100);
    assert.equal(sanitizeSearchTerm(padded), 'x'.repeat(100));
});
test('sanitizeSearchTermKeepingWords: koma/kurung diganti spasi, batas kata utuh', () => {
    assert.equal(sanitizeSearchTermKeepingWords('kopi,susu'), 'kopi susu');
    assert.equal(sanitizeSearchTermKeepingWords('teh(manis)'), 'teh manis');
    assert.equal(sanitizeSearchTermKeepingWords('nasi,ayam,pedas'), 'nasi ayam pedas');
    for (const raw of ['kopi,susu', 'teh(manis)', 'a)b(c', '%,%']) {
        assert.equal(isStructuralSafe(sanitizeSearchTermKeepingWords(raw)), true, `gagal: ${raw}`);
    }
});
test('sanitizeSearchTermKeepingWords: spasi tepi setelah penggantian dibuang', () => {
    assert.equal(sanitizeSearchTermKeepingWords(',kopi'), 'kopi');
    assert.equal(sanitizeSearchTermKeepingWords('kopi,'), 'kopi');
    assert.equal(sanitizeSearchTermKeepingWords('  ,,,  '), '');
    assert.equal(sanitizeSearchTermKeepingWords('a b'), 'a b');
});
test('sanitizeSearchTermKeepingWords: null/kosong dan batas panjang', () => {
    for (const value of [null, undefined, '']) {
        assert.equal(sanitizeSearchTermKeepingWords(value), '');
    }
    assert.equal(sanitizeSearchTermKeepingWords(' '.repeat(30) + 'y'.repeat(150)).length, 100);
    assert.equal(sanitizeSearchTermKeepingWords('abcdef', 3), 'abc');
});
test('route produk memakai varian keeping-words; enam route lain memakai varian hapus', () => {
    const products = readProjectFile('app/api/admin/products/route.ts');
    assert.match(products, /sanitizeSearchTermKeepingWords\(/);
    assert.doesNotMatch(products, /[^g]sanitizeSearchTerm\(q\)/);
    for (const file of [
        'app/api/admin/users/route.ts',
        'app/api/admin/orders/route.ts',
        'app/api/admin/subscriptions/route.ts',
        'app/api/admin/umkm/route.ts',
        'app/api/admin/articles/route.ts',
        'app/api/articles/route.ts',
    ]) {
        const source = readProjectFile(file);
        assert.match(source, /sanitizeSearchTerm\(/, `${file} harus memakai varian hapus`);
        assert.doesNotMatch(source, /sanitizeSearchTermKeepingWords\(/, `${file} tidak boleh ikut berubah ke varian keeping-words`);
    }
});
test('sanitizeSearchTerm: seluruh hasil selalu bebas karakter struktur', () => {
    const attacks = [
        'x,role.eq.admin',
        'a),or(id.neq.0',
        '(((',
        '%,%,%',
        'normal,teks(berbahaya)%',
    ];
    for (const attack of attacks) {
        assert.equal(isStructuralSafe(sanitizeSearchTerm(attack)), true, `gagal untuk: ${attack}`);
    }
});
test('isStructuralSafe: definisi konsisten dengan sanitizer', () => {
    assert.equal(isStructuralSafe('aman'), true);
    assert.equal(isStructuralSafe(''), true);
    for (const ch of [',', '(', ')', '%']) {
        assert.equal(isStructuralSafe(`a${ch}b`), false, `karakter ${ch} harus terdeteksi`);
    }
});
test('route admin: tidak mengirim pesan exception mentah ke client', () => {
    const files = [
        'app/api/admin/dashboard/route.ts',
        'app/api/admin/users/route.ts',
        'app/api/admin/orders/route.ts',
        'app/api/admin/sanctions/route.ts',
        'app/api/admin/reports/route.ts',
        'app/api/admin/products/route.ts',
        'app/api/admin/subscriptions/route.ts',
        'app/api/admin/articles/route.ts',
        'app/api/admin/role-requests/route.ts',
        'app/api/admin/warnings/route.ts',
        'app/api/admin/umkm/route.ts',
        'app/api/admin/health/route.ts',
    ];
    for (const file of files) {
        const source = readProjectFile(file);
        assert.doesNotMatch(source, /err instanceof Error \? err\.message/, `${file} masih mengembalikan err.message ke client`);
    }
});
test('route admin: logging server dipertahankan untuk penelusuran', () => {
    const route = readProjectFile('app/api/admin/dashboard/route.ts');
    assert.match(route, /console\.error\('\[admin\/dashboard\]/);
});
test('route yang membangun or() memakai sanitizer bersama', () => {
    const files = [
        'app/api/admin/users/route.ts',
        'app/api/admin/orders/route.ts',
        'app/api/admin/subscriptions/route.ts',
        'app/api/admin/articles/route.ts',
        'app/api/admin/products/route.ts',
        'app/api/articles/route.ts',
    ];
    for (const file of files) {
        const source = readProjectFile(file);
        assert.match(source, /from '@\/lib\/filter-search'/, `${file} belum memakai sanitizer bersama`);
        assert.doesNotMatch(source, /function sanitizeSearch\(raw: string \| null\): string \{\s*\n\s*if \(!raw\) return '';/, `${file} masih mendefinisikan sanitizeSearch lokal`);
    }
});
