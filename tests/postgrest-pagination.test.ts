import test from 'node:test';
import assert from 'node:assert/strict';
import { PageLimitError, PageQueryError, fetchAllPages, } from '../lib/server/supabase-rows.ts';
test('fetchAllPages: membaca semua halaman dan memakai rentang berurutan', async () => {
    const calls: [
        number,
        number
    ][] = [];
    const pages = [[1, 2], [3, 4], [5]];
    const rows = await fetchAllPages<number>(async (from, to) => {
        calls.push([from, to]);
        const page = pages[calls.length - 1] ?? [];
        return { data: page, error: null };
    }, { pageSize: 2, maxRows: 10, label: 'uji' });
    assert.deepEqual(rows, [1, 2, 3, 4, 5]);
    assert.deepEqual(calls, [
        [0, 1],
        [2, 3],
        [4, 5],
        [5, 6],
    ]);
});
test('fetchAllPages: halaman penuh tepat di batas tetap diikuti query kosong', async () => {
    const calls: [
        number,
        number
    ][] = [];
    const pages = [[1, 2], [3, 4], []];
    const rows = await fetchAllPages<number>(async (from, to) => {
        calls.push([from, to]);
        return { data: pages[calls.length - 1] ?? [], error: null };
    }, { pageSize: 2, maxRows: 4, label: 'uji' });
    assert.deepEqual(rows, [1, 2, 3, 4]);
    assert.equal(calls.length, 3);
});
test('fetchAllPages: data kosong bukan kegagalan', async () => {
    const rows = await fetchAllPages<number>(async () => ({ data: [], error: null }), {
        pageSize: 1000,
        maxRows: 10,
        label: 'uji',
    });
    assert.deepEqual(rows, []);
});
test('fetchAllPages: kegagalan query dilempar dengan label dan cause', async () => {
    const cause = { message: 'permission denied', code: '42501' };
    await assert.rejects(fetchAllPages<number>(async () => ({ data: null, error: cause }), {
        pageSize: 1000,
        maxRows: 10,
        label: 'laporan',
    }), (err: unknown) => {
        assert.ok(err instanceof PageQueryError);
        assert.equal(err.label, 'laporan');
        assert.equal(err.queryError, cause);
        return true;
    });
});
test('fetchAllPages: batas baris melempar PageLimitError tanpa data parsial', async () => {
    await assert.rejects(fetchAllPages<number>(async (from) => ({
        data: from === 0 ? [1, 2] : [3, 4],
        error: null,
    }), { pageSize: 2, maxRows: 3, label: 'pesanan' }), (err: unknown) => {
        assert.ok(err instanceof PageLimitError);
        assert.equal(err.label, 'pesanan');
        assert.equal(err.maxRows, 3);
        assert.equal(err.observedAtLeast, 4);
        return true;
    });
});
