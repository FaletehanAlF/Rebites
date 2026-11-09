import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

test('query pesanan penjual meneruskan galat, bukan berpura-pura toko kosong', () => {
    const storage = read('lib/order-storage.ts');
    assert.ok(storage.includes('getSellerOrdersResult(): Promise<SellerOrdersResult>'));
    assert.ok(storage.includes('Gagal memuat pesanan. Periksa koneksi lalu coba lagi.'));
    assert.ok(storage.includes('Profil toko belum terbaca.'));
});

test('hook useSellerOrders mewariskan error ke pemanggil', () => {
    const hook = read('hooks/use-seller-orders.ts');
    assert.ok(hook.includes('error: string | null;'));
    assert.ok(hook.includes('error: result.error'));
    assert.ok(hook.includes('error: snapshot.error'));
});

test('halaman pesanan penjual menampilkan banner gagal + coba lagi, bukan daftar kosong', () => {
    const page = read('app/(app)/dashboard/penjual/[storeId]/pesanan/page.tsx');
    assert.ok(page.includes('loadError ?'));
    assert.ok(page.includes('role="alert"'));
    assert.ok(page.includes('Gagal memuat pesanan'));
    assert.ok(page.includes('Coba lagi'));
});
