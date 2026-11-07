import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const MACHINE = readProjectFile('lib/order-state-machine.ts');
const MACHINE_CODE = MACHINE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const MODAL = readProjectFile('app/riwayatPesanan/[orderCode]/page.tsx');
const MODAL_CODE = MODAL.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');
test('pembeli boleh membatalkan pesanan yang belum dibayar', () => {
    const cancelBranch = MACHINE_CODE.match(/newStatus === 'cancelled'[\s\S]{0,400}currentStatus !== 'pending'/);
    assert.ok(cancelBranch, 'cabang pembatalan untuk pembeli tidak ditemukan');
    assert.match(cancelBranch[0], /currentStatus !== 'pending'/);
});
test('pembeli tetap tidak boleh membatalkan pesanan yang sudah dibayar', () => {
    assert.match(MACHINE_CODE, /tidak dapat dibatalkan sendiri/, 'pesan penolakan untuk pesanan yang sudah dibayar tidak ada');
    assert.doesNotMatch(MACHINE_CODE, /currentStatus !== 'pending' && currentStatus !== 'paid'/);
});
test('tombol batal hanya tampil untuk pesanan pending dan berlangsung', () => {
    assert.match(MODAL_CODE, /canCancelOrder\s*=\s*order\?\.status === 'ongoing' && orderStatus === 'pending'/, 'syarat tampil tombol batal berubah atau hilang');
});
test('tombol batal memanggil transisi cancelled lewat state machine', () => {
    const handler = MODAL_CODE.match(/const handleCancelOrder = [\s\S]*?\n {4}\};/);
    assert.ok(handler, 'handler pembatalan tidak ditemukan');
    assert.match(handler[0], /transitionOrderStatus\(/);
    assert.match(handler[0], /'cancelled'/);
    assert.match(handler[0], /window\.confirm\(/);
});
test('tombol batal dirender dari canCancelOrder', () => {
    assert.match(MODAL_CODE, /\{canCancelOrder && \(/);
    assert.match(MODAL_CODE, /Batalkan Pesanan/);
});
