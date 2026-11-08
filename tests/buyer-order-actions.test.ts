/**
 * Aksi pembeli pada pesanan: membatalkan pesanan yang belum dibayar, dan
 * penerimaan pesanan — keduanya harus lewat jalur yang sama.
 *
 * CACAT YANG DILAPORKAN
 * Pesanan yang pembayarannya ditinggalkan tidak bisa dibatalkan pembeli.
 * Stok produk terkunci sampai kedaluwarsa, padahal pembeli sudah tahu tidak
 * akan membayar, dan trigger database sendiri sudah mengizinkan
 * `pending -> cancelled` dari sesi pembeli.
 *
 * KENAPA PEMBATALAN DIBATASI PADA `pending` SAJA
 * Setelah `paid`, pembatalan menyangkut uang yang sudah berpindah. Membuka
 * jalur itu lewat tombol di sisi pembeli berarti penjual bisa kehilangan
 * pesanan yang sedang disiapkan tanpa pernah diberi tahu.
 *
 * Jalankan: node --test tests/buyer-order-actions.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Teks berkas sebagai LF; checkout Windows ber-CRLF dengan core.autocrlf. */
function readProjectFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(
    /\r\n/g,
    '\n'
  );
}

const MACHINE = readProjectFile('lib/order-state-machine.ts');
// Komentar dibuang: yang diperiksa perilaku, bukan penjelasan di atasnya.
const MACHINE_CODE = MACHINE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const MODAL = readProjectFile('app/components/order-history/order-detail-modal.tsx');
const MODAL_CODE = MODAL.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '');

test('pembeli boleh membatalkan pesanan yang belum dibayar', () => {
  // Syarat `pending` harus muncul di jalur pembatalan, bukan sekadar di
  // komentar: tanpa baris ini tombol di UI akan selalu ditolak server.
  const cancelBranch = MACHINE_CODE.match(
    /if \(newStatus === 'cancelled'\) \{[\s\S]*?\n {6}\}/
  );
  assert.ok(cancelBranch, 'cabang pembatalan untuk pembeli tidak ditemukan');
  assert.match(cancelBranch[0], /currentStatus !== 'pending'/);
});

test('pembeli tetap tidak boleh membatalkan pesanan yang sudah dibayar', () => {
  assert.match(
    MACHINE_CODE,
    /tidak dapat dibatalkan sendiri/,
    'pesan penolakan untuk pesanan yang sudah dibayar tidak ada'
  );
  // Pesanan `paid` hanya boleh dibatalkan penjual; jangan longgarkan cek
  // milik pembeli agar `paid -> cancelled` ikut terbuka.
  assert.doesNotMatch(
    MACHINE_CODE,
    /currentStatus !== 'pending' && currentStatus !== 'paid'/
  );
});

test('tombol batal hanya tampil untuk pesanan pending dan berlangsung', () => {
  assert.match(
    MODAL_CODE,
    /canCancelOrder\s*=\s*order\?\.status === 'ongoing' && orderStatus === 'pending'/,
    'syarat tampil tombol batal berubah atau hilang'
  );
});

test('tombol batal memanggil transisi cancelled lewat state machine', () => {
  const handler = MODAL_CODE.match(/const handleCancelOrder = [\s\S]*?\n {2}\};/);
  assert.ok(handler, 'handler pembatalan tidak ditemukan');
  assert.match(handler[0], /transitionOrderStatus\(/);
  assert.match(handler[0], /'cancelled'/);
  // Konfirmasi wajib: pembatalan tidak bisa dibatalkan lagi.
  assert.match(handler[0], /window\.confirm\(/);
});

test('tombol batal dirender dari canCancelOrder', () => {
  assert.match(MODAL_CODE, /\{canCancelOrder && \(/);
  assert.match(MODAL_CODE, /Batalkan Pesanan/);
});
