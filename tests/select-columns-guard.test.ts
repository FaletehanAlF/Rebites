import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const ROUTE_PESANAN = 'app/api/orders/[code]/route.ts';
const ROUTE_ALAMAT = 'app/api/profile/addresses/route.ts';
test('endpoint server tidak memakai select bintang', () => {
    for (const berkas of [ROUTE_PESANAN, ROUTE_ALAMAT]) {
        const source = readProjectFile(berkas);
        assert.doesNotMatch(source, /\.select\(\s*['"]\*['"]\s*\)/, `${berkas} kembali memakai select('*')`);
    }
});
test('endpoint server tetap memverifikasi pemanggil', () => {
    for (const berkas of [ROUTE_PESANAN, ROUTE_ALAMAT]) {
        const source = readProjectFile(berkas);
        assert.match(source, /getUserFromBearer/, `${berkas} tidak lagi memeriksa token`);
    }
});
test('kolom operasional tidak dikirim ke pemanggil pesanan', () => {
    const source = readProjectFile(ROUTE_PESANAN);
    for (const kolom of [
        'xendit_invoice_id',
        'idempotency_key',
        'stock_reserved_at',
        'stock_released_at',
        'coin_debit_status',
    ]) {
        assert.equal(source.includes(kolom), false, `${kolom} kembali ikut terkirim dari endpoint pesanan`);
    }
});
test('daftar kolom pesanan memuat kolom yang dipetakan klien', () => {
    const route = readProjectFile(ROUTE_PESANAN);
    const storage = readProjectFile('lib/order-storage.ts');
    const blok = storage.slice(storage.indexOf('export function rowToStoredOrder'), storage.indexOf('function storedOrderToRow'));
    const dipetakan = new Set([...blok.matchAll(/row\.([a-z0-9_]+)/g)].map((match) => match[1]));
    const dikecualikan = new Set([
        'biteship_order_id',
        'biteship_tracking_id',
        'biteship_waybill_id',
        'shipment_error',
    ]);
    for (const nama of dipetakan) {
        if (dikecualikan.has(nama))
            continue;
        assert.ok(route.includes(`'${nama}'`), `kolom ${nama} dipetakan klien tetapi tidak ada di ORDER_COLUMNS`);
    }
});
