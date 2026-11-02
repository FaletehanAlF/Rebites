/**
 * Penanda "butuh aksi" dan akses chat kurir di dashboard penjual.
 *
 * MASALAH YANG DILAPORKAN
 * 1. Badge merah pada ikon lonceng tidak ikut berubah saat pesanan baru
 *    masuk — penjual harus menunggu, tanpa tanda bahwa ada yang perlu
 *    dikerjakan.
 * 2. Kartu pesanan tidak menandai pesanan mana yang menunggu diketuk, jadi
 *    di tab "Semua" semuanya terlihat sama.
 * 3. Chat kurir tidak ada di halaman pesanan penjual sama sekali.
 *
 * Jalankan: node --test tests/seller-orders-attention.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { needsSellerAction, resolveOrderPhase } from '../lib/order-status-source.ts';

/** Teks berkas sebagai LF; checkout Windows ber-CRLF dengan core.autocrlf. */
function readProjectFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(
    /\r\n/g,
    '\n'
  );
}

const PAGE = readProjectFile('app/dashboard/penjual/pesanan/page.tsx');
const PAGE_CODE = PAGE.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\{\s*\}/g, '');
const TOPBAR = readProjectFile('app/components/dashboard-penjual/Topbar.tsx');

test('pesanan dibayar dan disiapkan dihitung butuh aksi penjual', () => {
  assert.equal(needsSellerAction('paid'), true);
  assert.equal(needsSellerAction('processing'), true);
});

test('pesanan yang belum dibayar bukan beban penjual', () => {
  // `pending` = pembeli belum membayar; tidak ada yang bisa dikerjakan
  // penjual dan menghitungnya membuat badge tidak pernah kosong.
  assert.equal(needsSellerAction('pending'), false);
  assert.equal(needsSellerAction('cancelled'), false);
  assert.equal(needsSellerAction('completed'), false);
  // Setelah kurir berangkat penjual hanya menunggu, bukan mengerjakan.
  assert.equal(needsSellerAction('out_for_delivery'), false);
  assert.equal(needsSellerAction('ready_for_pickup'), false);
});

test('penanda memakai fase yang sama dengan sumber status pesanan', () => {
  // Kalau kelak aturan fase berubah, penanda harus ikut — bukan bercabang
  // sendiri memakai order_status mentah.
  const paidPhase = resolveOrderPhase({ status: 'ongoing', orderStatus: 'paid' });
  const processingPhase = resolveOrderPhase({ status: 'ongoing', orderStatus: 'processing' });
  const pendingPhase = resolveOrderPhase({ status: 'ongoing', orderStatus: 'pending' });
  assert.equal(needsSellerAction(paidPhase), true);
  assert.equal(needsSellerAction(processingPhase), true);
  assert.equal(needsSellerAction(pendingPhase), false);
});

test('lonceng penjual menyegarkan hitungan saat ada perubahan pesanan', () => {
  // Tanpa ini badge hanya bergerak bila ada notifikasi baru dari Realtime,
  // dan pesanan baru bisa terlewat dari pandangan penjual.
  assert.match(TOPBAR, /ORDERS_UPDATED_EVENT/);
  assert.match(TOPBAR, /addEventListener\(ORDERS_UPDATED_EVENT/);
  assert.match(TOPBAR, /removeEventListener\(ORDERS_UPDATED_EVENT/);
});

test('kartu pesanan menampilkan tanda butuh aksi dan garis tegas', () => {
  assert.match(PAGE_CODE, /const waitingForSeller = isOngoing && needsSellerAction\(phase\)/);
  assert.match(PAGE_CODE, /Butuh aksi/);
  assert.match(PAGE_CODE, /waitingForSeller \? 'border-destructive\/40'/);
});

test('ada tab Butuh Aksi yang menghitung pesanan menunggu', () => {
  assert.match(PAGE_CODE, /value: 'butuh-aksi' as const/);
  assert.match(PAGE_CODE, /tab === 'butuh-aksi'/);
  assert.match(PAGE_CODE, /waitingOrders\.filter|ongoing\.filter\(\(order\) => needsSellerAction/);
});

test('chat kurir tersedia di kartu pesanan, mode pantau saja', () => {
  assert.match(PAGE_CODE, /<CourierChat orderDbId=\{order\.dbId\} canSend=\{false\}/);
  assert.match(PAGE_CODE, /Chat Kurir/);
  // Penjual bukan pihak yang mengantar: jangan pernah membuka kolom kirim.
  assert.doesNotMatch(PAGE_CODE, /<CourierChat orderDbId=\{order\.dbId\} canSend=\{true\}/);
});

test('tombol chat hanya muncul untuk pesanan pengiriman yang punya id database', () => {
  assert.match(
    PAGE_CODE,
    /const canChatWithCourier =\s*order\.fulfillment === 'delivery' && Boolean\(order\.dbId\)/
  );
});
