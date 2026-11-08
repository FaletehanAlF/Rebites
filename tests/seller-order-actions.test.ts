/**
 * Regresi alur status pesanan: satu sumber kebenaran + tombol penjual.
 *
 * Source-guard lokal; tidak menjalankan browser atau database.
 *
 * CACAT YANG DILAPORKAN
 * "kenapa antarnya lama banget" — pesanan macet di status `paid`.
 *
 * AKARNYA
 * 1. `progress_status` diisi 'disiapkan' saat checkout lalu TIDAK PERNAH diubah
 *    siapa pun. Syarat tombol dashboard penjual
 *    (`actions.length > 0 && !order.progressStatus && isOngoing`) karena itu
 *    selalu false, sehingga tombol "Mulai Siapkan Pesanan" tidak pernah
 *    muncul.
 * 2. UI jatuh ke tombol cadangan `handleAdvance` yang mencoba
 *    `paid -> out_for_delivery`. Transisi itu DITOLAK trigger database
 *    (dari `paid` hanya boleh `processing` atau `cancelled`), jadi tombol itu
 *    selalu berakhir dengan alert galat.
 *
 * YANG DIKUNCI DI SINI
 * 1. Dashboard penjual memakai fase dari `lib/order-status-source.ts` — satu
 *    sumber kebenaran — bukan syarat `!order.progressStatus`.
 * 2. Tidak ada lagi jalur tombol yang mencoba `paid -> out_for_delivery`.
 * 3. `getOrderSubStatus` (dipakai kartu pembeli, modal, dan halaman detail)
 *    diturunkan dari fase yang sama, sehingga satu pesanan tidak tampil
 *    berbeda di dua layar.
 * 4. `progress_status` TIDAK BOLEH menentukan tampilan sendiri.
 *
 * Jalankan: node --test tests/seller-order-actions.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  getSellerAction,
  resolveOrderPhase,
} from '../lib/order-status-source.ts';

/**
 * Baca berkas proyek sebagai teks berakhiran LF.
 *
 * Di Windows dengan core.autocrlf=true checkout berupa CRLF; pemeriksaan
 * berbasis baris akan gagal pada kode yang benar tanpa penyeragaman ini.
 */
function readProjectFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(
    /\r\n/g,
    '\n'
  );
}

const SELLER_PAGE = readProjectFile('app/(app)/dashboard/penjual/pesanan/page.tsx');
const ORDER_UTILS = readProjectFile('lib/order-utils.ts');
const STATUS_SOURCE = readProjectFile('lib/order-status-source.ts');

/**
 * Buang komentar dari kode sebelum diperiksa.
 *
 * Pemeriksaan sumber-guard harus melihat KODE, bukan komentar. Kalau
 * komentar menjelaskan bug lama ("sebelumnya syarat tombol memakai
 * `!order.progressStatus`"), pemeriksaan mentah akan salah menyimpulkan
 * bahwa bug itu masih ada.
 */
function stripComments(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      const tanpaBlok = line.replace(/\/\*.*?\*\//g, '');
      return tanpaBlok.replace(/\/\/.*$/, '');
    })
    .join('\n');
}

const SELLER_CODE = stripComments(SELLER_PAGE);
const ORDER_UTILS_CODE = stripComments(ORDER_UTILS);
const STATUS_SOURCE_CODE = stripComments(STATUS_SOURCE);

test('dashboard penjual memakai sumber kebenaran tunggal', () => {
  // Syarat lama `!order.progressStatus` HARUS hilang: itulah yang membuat
  // tombol "Mulai Siapkan Pesanan" tidak pernah muncul.
  assert.ok(
    !SELLER_CODE.includes('!order.progressStatus'),
    'dashboard penjual masih memakai syarat !order.progressStatus'
  );
  assert.ok(
    SELLER_CODE.includes('resolveOrderPhase'),
    'dashboard penjual harus menentukan fase lewat resolveOrderPhase'
  );
  assert.ok(
    SELLER_CODE.includes('getSellerAction'),
    'dashboard penjual harus menentukan aksi lewat getSellerAction'
  );
});

test('dashboard penjual tidak lagi memakai getValidActions', () => {
  // `getValidActions` bekerja pada `order_status` mentah dan tidak tahu
  // soal jaring pengaman pesanan lama. Sumber tunggal menggantikannya.
  assert.ok(
    !SELLER_CODE.includes('getValidActions'),
    'dashboard penjual masih memakai getValidActions (lama)'
  );
});

test('tidak ada jalur tombol yang mencoba paid langsung ke out_for_delivery', () => {
  // Handler `handleAdvance` lama justru melakukan ini: paid -> out_for_delivery,
  // yang ditolak trigger database. Handler itu harus dihapus.
  assert.ok(
    !/const target = order\.fulfillment === 'delivery' \? 'out_for_delivery'/.test(
      SELLER_CODE
    ),
    'masih ada handler yang mencoba paid -> out_for_delivery'
  );
});

test('getOrderSubStatus diturunkan dari fase operasional', () => {
  // Kartu pembeli, modal detail, dan halaman detail semuanya memakai
  // getOrderSubStatus. Kalau fungsi ini masih membaca progress_status
  // langsung, tampilan akan berbeda lagi.
  assert.ok(
    ORDER_UTILS_CODE.includes('resolveOrderPhase'),
    'getOrderSubStatus harus memakai resolveOrderPhase'
  );
  const body = ORDER_UTILS_CODE.slice(
    ORDER_UTILS_CODE.indexOf('export function getOrderSubStatus')
  );
  const beforeFallback = body.slice(0, body.indexOf('SUB_STATUS_LABEL'));
  assert.ok(
    !/order\.progressStatus/.test(beforeFallback),
    'getOrderSubStatus masih membaca progress_status secara langsung'
  );
});

test('modul sumber kebenaran tidak memakai progress_status sebagai penentu', () => {
  // 'disiapkan' adalah nilai default checkout. Kalau nilai ini boleh
  // menentukan fase, pesanan yang sudah dibayar akan terlihat belum dimulai.
  const advancedBlock = STATUS_SOURCE_CODE.slice(
    STATUS_SOURCE_CODE.indexOf('const PROGRESS_ADVANCED'),
    STATUS_SOURCE_CODE.indexOf('const NOT_YET_ADVANCED')
  );
  assert.ok(
    !advancedBlock.includes('disiapkan'),
    "PROGRESS_ADVANCED tidak boleh memuat 'disiapkan'"
  );
});

test('alur dua langkah dari paid bisa diselesaikan', () => {
  // Uji alur PENUH yang dipakai penjual: paid -> processing -> diantar.
  let order = {
    status: 'ongoing',
    orderStatus: 'paid',
    progressStatus: 'disiapkan',
    fulfillment: 'delivery',
  };

  const first = getSellerAction(resolveOrderPhase(order), order.fulfillment);
  assert.ok(first, 'harus ada aksi pada status paid');
  assert.equal(first.targetStatus, 'processing');

  order = { ...order, orderStatus: first.targetStatus };
  const second = getSellerAction(resolveOrderPhase(order), order.fulfillment);
  assert.ok(second, 'harus ada aksi pada status processing');
  assert.equal(second.targetStatus, 'out_for_delivery');

  order = { ...order, orderStatus: second.targetStatus };
  const third = getSellerAction(resolveOrderPhase(order), order.fulfillment);
  assert.ok(third, 'harus ada aksi pada status out_for_delivery');
  assert.equal(third.targetStatus, 'completed');
});

test('setiap langkah alur ini diizinkan trigger database', () => {
  // Trigger `guard_orders_update` hanya mengizinkan pasangan tertentu.
  // Kalau langkah di atas tidak termasuk, alur dua langkah akan gagal di
  // produksi walau tes unit lolos.
  const allowed = new Set([
    'paid>processing',
    'processing>out_for_delivery',
    'processing>ready_for_pickup',
    'out_for_delivery>completed',
    'ready_for_pickup>completed',
  ]);
  const phases = ['paid', 'processing', 'out_for_delivery', 'ready_for_pickup'] as const;
  for (const phase of phases) {
    for (const fulfillment of ['delivery', 'pickup']) {
      const action = getSellerAction(phase, fulfillment);
      if (!action) continue;
      assert.ok(
        allowed.has(`${phase}>${action.targetStatus}`),
        `pasangan ${phase}>${action.targetStatus} tidak diizinkan trigger`
      );
    }
  }
});

test('pesanan lama dengan progress_status diantar tidak kembali ke pending', () => {
  // Jaring pengaman: pesanan yang order_status-nya tak pernah bergerak tapi
  // progress_status-nya 'diantar' harus tetap terlihat sedang diantar.
  const phase = resolveOrderPhase({
    status: 'ongoing',
    orderStatus: 'paid',
    progressStatus: 'diantar',
  });
  assert.equal(phase, 'out_for_delivery');
});
