/**
 * Regresi fitur live GPS kurir.
 *
 * Source-guard lokal; tidak menjalankan browser atau database.
 *
 * YANG DIKUNCI DI SINI
 * 1. Migrasi membuat tabel kurir, penugasan, posisi, dan chat — dengan RLS.
 * 2. Penugasan kurir terjadi OTOMATIS saat pesanan masuk 'out_for_delivery'.
 * 3. Penulisan posisi hanya boleh dilakukan kurir yang DITUGASKAN, dan
 *    `order_id` ikut dipagari (WITH CHECK hanya mengikat kolom yang disebut).
 * 4. Posisi dihapus saat pesanan berakhir (data pribadi).
 * 5. Motor hijau di peta mengikuti posisi NYATA, dan animasi ilustratif
 *    MATI saat posisi tersedia (dua-duanya tidak boleh jalan bersamaan).
 * 6. Penjual boleh melihat posisi; chat hanya ditulis pembeli dan kurir.
 * 7. Kurir hanya bisa MAJU status penugasan.
 * 8. Tidak ada koordinat karangan: posisi yang tidak valid ditolak.
 *
 * Jalankan: node --test tests/courier-live-delivery.test.ts
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

/**
 * Buang komentar sebelum pemeriksaan.
 *
 * Pemeriksaan source-guard harus melihat KODE, bukan penjelasan. Kalau
 * komentar menjelaskan aturan ("WITH CHECK hanya mengikat kolom yang
 * disebut"), pemeriksaan mentah akan salah menyimpulkan aturan itu sudah
 * diterapkan.
 */
function stripComments(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      const tanpaBlok = line.replace(/\/\*[\s\S]*?\*\//g, '');
      return tanpaBlok.replace(/--.*$/, '').replace(/\/\/.*$/, '');
    })
    .join('\n');
}

/**
 * Normalisasi untuk pemeriksaan: huruf kecil + tanpa spasi berlebih.
 *
 * SQL dan TypeScript memakai kapitalisasi berbeda untuk hal yang sama
 * (`CREATE TABLE` vs `create table`), dan pemeriksaan source-guard tidak
 * seharusnya gagal hanya karena itu.
 */
function normalize(source: string): string {
  return stripComments(source).toLowerCase().replace(/\s+/g, ' ');
}

const MIGRATION = normalize(
  readProjectFile('supabase/migrations/20261031010000_courier_live_delivery.sql')
);
const MAP = normalize(readProjectFile('app/components/order-history/delivery-map.tsx'));
const LOCATION_ROUTE = normalize(readProjectFile('app/api/courier/location/route.ts'));
const MESSAGES_ROUTE = normalize(readProjectFile('app/api/courier/messages/route.ts'));
const ASSIGNMENTS_ROUTE = normalize(
  readProjectFile('app/api/courier/assignments/route.ts')
);
const COURIER_DASHBOARD = normalize(readProjectFile('app/dashboard/kurir/page.tsx'));
const CHAT = normalize(readProjectFile('app/components/order-history/courier-chat.tsx'));
const POSITION_PANEL = normalize(
  readProjectFile('app/components/order-history/courier-position-panel.tsx')
);
const LOCATION_HOOK = normalize(readProjectFile('hooks/use-courier-location.ts'));
const SELLER_PAGE = normalize(readProjectFile('app/(app)/dashboard/penjual/pesanan/page.tsx'));
const BUYER_PAGE = normalize(readProjectFile('app/riwayatPesanan/[orderCode]/page.tsx'));
const SIDEBAR = normalize(readProjectFile('app/components/shared/account-sidebar.tsx'));

test('migrasi membuat keempat tabel kurir', () => {
  for (const table of [
    'public.couriers',
    'public.delivery_assignments',
    'public.delivery_locations',
    'public.courier_messages',
  ]) {
    assert.ok(
      MIGRATION.includes(`create table if not exists ${table}`),
      `tabel ${table} harus dibuat`
    );
  }
});

test('setiap tabel kurir memakai RLS', () => {
  for (const table of [
    'public.couriers',
    'public.delivery_assignments',
    'public.delivery_locations',
    'public.courier_messages',
  ]) {
    assert.ok(
      MIGRATION.includes(`alter table ${table} enable row level security`),
      `tabel ${table} wajib memakai RLS`
    );
  }
});

test('penugasan kurir otomatis terjadi saat pesanan out_for_delivery', () => {
  assert.ok(
    MIGRATION.includes('auto_assign_courier_to_delivery'),
    'fungsi auto-assign harus ada'
  );
  assert.ok(
    MIGRATION.includes("new.order_status = 'out_for_delivery'"),
    'auto-assign harus dipicu pada status out_for_delivery'
  );
  assert.ok(
    MIGRATION.includes('trg_orders_auto_assign_courier'),
    'trigger auto-assign harus dipasang pada tabel orders'
  );
});

test('auto-assign tidak menugaskan kurir yang posisinya tidak diketahui', () => {
  // Tanpa posisi, jarak tidak bisa dihitung. Menebak berarti mengacak
  // kurir yang mungkin jauh dari toko.
  assert.ok(
    MIGRATION.includes('c.last_latitude is not null'),
    'kandidat harus punya posisi yang diketahui'
  );
  assert.ok(
    MIGRATION.includes('c.last_seen_at is not null'),
    'kandidat harus punya waktu terakhir terlihat'
  );
});

test('auto-assign menolak kurir yang sedang mengantar pesanan lain', () => {
  assert.ok(
    MIGRATION.includes('a2.courier_user_id = c.user_id'),
    'kurir yang sedang sibuk harus dikecualikan'
  );
});

test('penulisan posisi hanya untuk kurir yang ditugaskan', () => {
  // `order_id` WAJIB ikut dipagari: WITH CHECK hanya mengikat kolom yang
  // disebutkannya, jadi satu kolom saja membuka celah "kurir A menulis ke
  // pesanan B".
  assert.ok(
    MIGRATION.includes('from public.delivery_assignments a'),
    'policy posisi harus memeriksa tabel penugasan'
  );
  assert.ok(
    MIGRATION.includes('a.order_id = delivery_locations.order_id'),
    'policy posisi harus mengikat order_id'
  );
  assert.ok(
    MIGRATION.includes('a.courier_user_id = auth.uid()'),
    'policy posisi harus mengikat courier_user_id'
  );
});

test('posisi dihapus saat pesanan berakhir', () => {
  assert.ok(
    MIGRATION.includes('cleanup_delivery_location_on_terminal'),
    'fungsi pembersih posisi harus ada'
  );
  assert.ok(
    MIGRATION.includes('delete from public.delivery_locations where order_id = new.id'),
    'posisi harus dihapus saat pesanan terminal'
  );
});

test('chat hanya boleh ditulis pembeli dan kurir', () => {
  assert.ok(MESSAGES_ROUTE.includes('isbuyer'), 'server harus memeriksa pembeli pesanan');
  assert.ok(
    MESSAGES_ROUTE.includes('iscourier'),
    'server harus memeriksa kurir yang ditugaskan'
  );
  assert.ok(MESSAGES_ROUTE.includes('403'), 'server harus menolak yang bukan peserta');
});

test('penjual boleh melihat posisi kurir', () => {
  // Kebijakan eksplisit: penjual adalah pihak yang terlibat di perjalanan
  // pengantaran dan perlu tahu posisi kurir.
  assert.ok(
    MIGRATION.includes('u.id = o.umkm_id and u.user_id = auth.uid()'),
    'policy posisi harus mengizinkan penjual pesanan'
  );
  assert.ok(
    POSITION_PANEL.includes('usecourierlocation'),
    'panel posisi untuk penjual harus membaca posisi live'
  );
  assert.ok(
    SELLER_PAGE.includes('courierpositionpanel'),
    'dashboard penjual harus menampilkan panel posisi kurir'
  );
});

test('panel posisi untuk penjual hanya membaca, tidak menulis', () => {
  // Penjual bukan kurir: tidak boleh ada pengiriman GPS dari perangkatnya.
  assert.ok(
    !POSITION_PANEL.includes("'/api/courier/location'"),
    'panel posisi penjual tidak boleh mengirim posisi'
  );
});

test('motor di peta mengikuti posisi nyata dan animasi mati', () => {
  assert.ok(MAP.includes('projectontoroute'), 'peta harus memproyeksikan posisi ke rute');
  assert.ok(
    MAP.includes('courierposition != null'),
    'animasi ilustratif harus mati saat posisi nyata tersedia'
  );
  assert.ok(
    MAP.includes("'posisi kurir (live)'"),
    'peta harus memberi tahu bahwa motor adalah posisi live'
  );
  assert.ok(
    MAP.includes("'motor ilustratif'"),
    'peta harus memberi tahu bahwa motor hanya ilustrasi'
  );
});

test('halaman pembeli memakai posisi live dan menampilkan chat', () => {
  assert.ok(
    BUYER_PAGE.includes('usecourierlocation'),
    'halaman detail pesanan harus membaca posisi kurir'
  );
  assert.ok(BUYER_PAGE.includes('courierchat'), 'halaman detail harus menampilkan chat');
  assert.ok(
    BUYER_PAGE.includes('courierposition'),
    'halaman detail pesanan harus mengirim posisi ke peta'
  );
});

test('dashboard kurir mengirim posisi dan punya chat', () => {
  assert.ok(
    COURIER_DASHBOARD.includes('usecourierpositionsender'),
    'dashboard kurir harus mengirim posisi'
  );
  assert.ok(COURIER_DASHBOARD.includes('courierchat'), 'dashboard kurir harus punya chat');
  assert.ok(
    CHAT.includes("'/api/courier/messages'"),
    'komponen chat harus memakai endpoint pesan'
  );
});

test('status penugasan hanya boleh maju', () => {
  // Mundur berarti ada keadaan "kurir mengantar tapi statusnya bilang belum
  // diambil" — kebohongan operasional.
  const start = ASSIGNMENTS_ROUTE.indexOf('allowed_next');
  assert.ok(start >= 0, 'daftar transisi penugasan harus ada');
  const block = ASSIGNMENTS_ROUTE.slice(start, start + 400);
  assert.ok(block.includes("assigned: ['picked_up'"), 'assigned harus bisa ke picked_up');
  assert.ok(block.includes("picked_up: ['delivering'"), 'picked_up harus bisa ke delivering');
  assert.ok(block.includes("delivering: ['completed'"), 'delivering harus bisa ke completed');
  assert.ok(
    !/picked_up:\s*\[[^\]]*'assigned'/.test(block),
    'status tidak boleh bisa mundur ke assigned'
  );
  assert.ok(
    !/delivering:\s*\[[^\]]*'picked_up'/.test(block),
    'status tidak boleh bisa mundur ke picked_up'
  );
});

test('koordinat tidak valid ditolak, bukan disimpan', () => {
  assert.ok(
    LOCATION_ROUTE.includes('isvalidcourierposition'),
    'route lokasi harus memvalidasi koordinat'
  );
  assert.ok(LOCATION_ROUTE.includes('status: 400'), 'koordinat tidak valid harus ditolak');
});

test('realtime memakai postgres_changes, bukan broadcast publik', () => {
  // Broadcast publik bisa dibaca siapa pun yang tahu nama kanal — itu sebab
  // fitur live tracking lama dimatikan.
  assert.ok(
    LOCATION_HOOK.includes("'postgres_changes'"),
    'hook posisi harus memakai postgres_changes'
  );
  assert.ok(
    !LOCATION_HOOK.includes('channel(`delivery:'),
    'tidak boleh memakai kanal broadcast publik'
  );
  assert.ok(
    MIGRATION.includes(
      'alter publication supabase_realtime add table public.delivery_locations'
    ),
    'tabel posisi harus masuk publikasi realtime'
  );
});

test('kanal posisi unik per langganan, bukan satu topik per pesanan', () => {
  // `supabase.channel(topic)` mengembalikan kanal yang topiknya sama bila
  // masih terdaftar. Halaman detail pesanan memasang hook ini DUA kali
  // (halaman + DeliveryStatusPanel), dan StrictMode menjalankan effect dua
  // kali sebelum removeChannel async selesai. Dengan topik tetap, `.on()`
  // kedua berjalan pada kanal yang sudah subscribe dan melempar
  // "cannot add postgres_changes callbacks ... after subscribe()" sehingga
  // halaman Pesanan jatuh dengan Unhandled Runtime Error.
  assert.ok(LOCATION_HOOK.includes('channelcounter'), 'topik harus diberi penomoran');
  assert.ok(
    LOCATION_HOOK.includes('rebites-courier-location-${orderdbid}-${channelcounter}'),
    'topik kanal harus memuat nomor langganan yang unik'
  );
  assert.ok(
    !LOCATION_HOOK.includes('rebites-courier-location-${orderdbid}`'),
    'topik tanpa nomor langganan akan bertabrakan antar pemasangan hook'
  );

  // Chat kurir dipasang di halaman detail pesanan yang sama, jadi kanalnya
  // menghadapi tabrakan topik yang persis sama.
  assert.ok(
    CHAT.includes('rebites-courier-messages-${orderdbid}-${channelcounter}'),
    'kanal chat harus memakai topik unik per langganan'
  );
  assert.ok(
    !CHAT.includes('rebites-courier-messages-${orderdbid}`'),
    'kanal chat dengan topik tetap akan melempar error setelah subscribe'
  );
});

test('pintu masuk dashboard kurir ada di sidebar', () => {
  assert.ok(SIDEBAR.includes('/dashboard/kurir'), 'sidebar harus punya tautan dashboard kurir');
  assert.ok(SIDEBAR.includes('useiscourier'), 'sidebar harus memeriksa status kurir');
});
