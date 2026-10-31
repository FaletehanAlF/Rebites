/**
 * Regresi realtime daftar pesanan penjual.
 *
 * Source-guard lokal; tidak menjalankan browser atau database.
 *
 * CACAT YANG DILAPORKAN
 * "pada saat user mesan menyiapkan pesanan jangan lama banget" — penjual
 * hanya melihat pesanan baru setelah polling 30 detik, padahal notifikasinya
 * sudah berbunyi. Pembeli menunggu tanpa ada yang mulai menyiapkan.
 *
 * YANG DIKUNCI DI SINI
 * 1. Ada langganan `postgres_changes` pada tabel `orders`.
 * 2. Langganan TANPA filter kolom: filter pada postgres_changes memerlukan
 *    REPLICA IDENTITY FULL, dan repo ini tidak memasangnya pada `orders`.
 * 3. Perubahan di-debounce: satu transisi status bisa menghasilkan beberapa
 *    event, dan tanpa debounce masing-masing memicu fetch sendiri.
 * 4. Kanal SELALU dilepas saat subscriber terakhir pergi. Kanal Realtime yang
 *    tertinggal membuat websocket terus membuka langganan yang tidak dipakai.
 * 5. Polling TETAP ada sebagai fallback: Realtime bisa diam tanpa memberi tahu.
 *
 * Jalankan: node --test tests/seller-orders-realtime.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

/** Buang komentar: pemeriksaan harus melihat KODE, bukan penjelasan. */
function stripComments(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      const tanpaBlok = line.replace(/\/\*[\s\S]*?\*\//g, '');
      return tanpaBlok.replace(/\/\/.*$/, '');
    })
    .join('\n');
}

const REALTIME = stripComments(readProjectFile('lib/orders-realtime.ts'));
const SELLER_HOOK = stripComments(readProjectFile('hooks/use-seller-orders.ts'));

test('ada langganan postgres_changes pada tabel orders', () => {
  assert.ok(
    REALTIME.includes("'postgres_changes'"),
    'langganan harus memakai postgres_changes'
  );
  // Tabel sekarang bisa dipilih (timeline riwayat status memakai tabel lain),
  // jadi yang mengunci "orders" adalah NILAI DEFAULT-nya. Tanpa default yang
  // benar, dashboard penjual akan berlangganan tabel yang salah.
  assert.match(
    REALTIME,
    /table = 'orders'/,
    'tabel langganan default harus orders'
  );
  assert.match(
    REALTIME,
    /\{\s*event: '\*',\s*schema: 'public',\s*table\s*\}/,
    'payload langganan harus memakai tabel yang dipilih'
  );
});

test('langganan TIDAK memakai filter kolom', () => {
  // Filter pada postgres_changes memerlukan REPLICA IDENTITY FULL. Dengan
  // identitas default, record lama pada UPDATE/DELETE tidak membawa kolom
  // filter sehingga event bisa tidak pernah sampai. RLS tetap membatasi
  // baris mana yang diterima, jadi tanpa filter pun penjual hanya menerima
  // pesanan tokonya sendiri.
  assert.ok(
    !REALTIME.includes('filter:'),
    'langganan orders tidak boleh memakai filter kolom'
  );
});

test('perubahan di-debounce, bukan langsung memicu fetch', () => {
  assert.ok(REALTIME.includes('setTimeout'), 'harus ada penundaan debounce');
  assert.ok(REALTIME.includes('clearTimeout'), 'timer debounce harus dibersihkan');
  assert.ok(
    REALTIME.includes('debounceMs'),
    'interval debounce harus bisa diatur'
  );
});

test('kanal selalu dilepas saat pembongkaran', () => {
  assert.ok(
    REALTIME.includes('removeChannel'),
    'kanal Realtime wajib dilepas'
  );
});

test('hook penjual memakai langganan realtime', () => {
  assert.ok(
    SELLER_HOOK.includes('subscribeOrdersRealtime'),
    'hook penjual harus memakai langganan realtime'
  );
});

test('hook penjual melepas langganan saat subscriber terakhir pergi', () => {
  assert.ok(
    SELLER_HOOK.includes('unsubscribeRealtime'),
    'hook penjual harus menyimpan pembongkar langganan'
  );
  // Pembongkaran harus berada di cabang "listeners kosong", bukan di luar.
  const cleanup = SELLER_HOOK.slice(SELLER_HOOK.indexOf('listeners.length === 0'));
  assert.ok(
    cleanup.includes('unsubscribeRealtime()'),
    'langganan harus dilepas saat subscriber terakhir pergi'
  );
});

test('polling tetap ada sebagai fallback', () => {
  // Realtime bisa terputus tanpa memberi tahu (jaringan berpindah, laptop
  // tidur). Pesanan yang tidak pernah muncul lebih buruk daripada telat.
  assert.ok(
    SELLER_HOOK.includes('POLL_INTERVAL_MS'),
    'polling fallback harus dipertahankan'
  );
  assert.ok(
    SELLER_HOOK.includes('setInterval'),
    'polling fallback harus benar-benar dipasang'
  );
});

test('tidak memakai kanal broadcast publik', () => {
  // Broadcast publik bisa dilanggani siapa pun yang tahu nama kanal. Itu sebab
  // fitur live tracking lama dimatikan.
  assert.ok(
    !REALTIME.includes('broadcast'),
    'tidak boleh memakai kanal broadcast publik'
  );
});
