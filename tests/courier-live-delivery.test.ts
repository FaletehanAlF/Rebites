import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
function stripComments(source: string): string {
    return source
        .split('\n')
        .map((line) => {
        const tanpaBlok = line.replace(/\/\*[\s\S]*?\*\//g, '');
        return tanpaBlok.replace(/--.*$/, '').replace(/\/\/.*$/, '');
    })
        .join('\n');
}
function normalize(source: string): string {
    return stripComments(source).toLowerCase().replace(/\s+/g, ' ');
}
const MIGRATION = normalize(readProjectFile('supabase/migrations/20261031010000_courier_live_delivery.sql'));
const MAP = normalize(readProjectFile('app/components/buyer/order-history/delivery-map.tsx'));
const LOCATION_ROUTE = normalize(readProjectFile('app/api/courier/location/route.ts'));
const MESSAGES_ROUTE = normalize(readProjectFile('app/api/courier/messages/route.ts'));
const ASSIGNMENTS_ROUTE = normalize(readProjectFile('app/api/courier/assignments/route.ts'));
const COURIER_DASHBOARD = normalize(readProjectFile('app/dashboard/kurir/page.tsx'));
const CHAT = normalize(readProjectFile('app/components/buyer/order-history/courier-chat.tsx'));
const POSITION_PANEL = normalize(readProjectFile('app/components/buyer/order-history/courier-position-panel.tsx'));
const LOCATION_HOOK = normalize(readProjectFile('hooks/use-courier-location.ts'));
const SELLER_PAGE = normalize(readProjectFile('app/(app)/dashboard/penjual/[storeId]/pesanan/page.tsx'));
const BUYER_PAGE = normalize(readProjectFile('app/riwayatPesanan/[orderCode]/page.tsx'));
const SIDEBAR = normalize(readProjectFile('app/components/shared/profile-sidebar-nav.tsx'));
test('migrasi membuat keempat tabel kurir', () => {
    for (const table of [
        'public.couriers',
        'public.delivery_assignments',
        'public.delivery_locations',
        'public.courier_messages',
    ]) {
        assert.ok(MIGRATION.includes(`create table if not exists ${table}`), `tabel ${table} harus dibuat`);
    }
});
test('setiap tabel kurir memakai RLS', () => {
    for (const table of [
        'public.couriers',
        'public.delivery_assignments',
        'public.delivery_locations',
        'public.courier_messages',
    ]) {
        assert.ok(MIGRATION.includes(`alter table ${table} enable row level security`), `tabel ${table} wajib memakai RLS`);
    }
});
test('penugasan kurir otomatis terjadi saat pesanan out_for_delivery', () => {
    assert.ok(MIGRATION.includes('auto_assign_courier_to_delivery'), 'fungsi auto-assign harus ada');
    assert.ok(MIGRATION.includes("new.order_status = 'out_for_delivery'"), 'auto-assign harus dipicu pada status out_for_delivery');
    assert.ok(MIGRATION.includes('trg_orders_auto_assign_courier'), 'trigger auto-assign harus dipasang pada tabel orders');
});
test('auto-assign tidak menugaskan kurir yang posisinya tidak diketahui', () => {
    assert.ok(MIGRATION.includes('c.last_latitude is not null'), 'kandidat harus punya posisi yang diketahui');
    assert.ok(MIGRATION.includes('c.last_seen_at is not null'), 'kandidat harus punya waktu terakhir terlihat');
});
test('auto-assign menolak kurir yang sedang mengantar pesanan lain', () => {
    assert.ok(MIGRATION.includes('a2.courier_user_id = c.user_id'), 'kurir yang sedang sibuk harus dikecualikan');
});
test('penulisan posisi hanya untuk kurir yang ditugaskan', () => {
    assert.ok(MIGRATION.includes('from public.delivery_assignments a'), 'policy posisi harus memeriksa tabel penugasan');
    assert.ok(MIGRATION.includes('a.order_id = delivery_locations.order_id'), 'policy posisi harus mengikat order_id');
    assert.ok(MIGRATION.includes('a.courier_user_id = auth.uid()'), 'policy posisi harus mengikat courier_user_id');
});
test('posisi dihapus saat pesanan berakhir', () => {
    assert.ok(MIGRATION.includes('cleanup_delivery_location_on_terminal'), 'fungsi pembersih posisi harus ada');
    assert.ok(MIGRATION.includes('delete from public.delivery_locations where order_id = new.id'), 'posisi harus dihapus saat pesanan terminal');
});
test('chat hanya boleh ditulis pembeli dan kurir', () => {
    assert.ok(MESSAGES_ROUTE.includes('isbuyer'), 'server harus memeriksa pembeli pesanan');
    assert.ok(MESSAGES_ROUTE.includes('iscourier'), 'server harus memeriksa kurir yang ditugaskan');
    assert.ok(MESSAGES_ROUTE.includes('403'), 'server harus menolak yang bukan peserta');
});
test('penjual boleh melihat posisi kurir, tanpa percakapan pribadi', () => {
    assert.ok(MIGRATION.includes('u.id = o.umkm_id and u.user_id = auth.uid()'), 'policy posisi harus mengizinkan penjual pesanan');
    assert.ok(!POSITION_PANEL.includes('usecourierlocation'), 'panel posisi tidak boleh berlangganan sendiri; data datang dari induk');
    assert.ok(POSITION_PANEL.includes('freshness'), 'panel posisi menerima kesegaran posisi dari induk');
    assert.ok(SELLER_PAGE.includes('courierpositionpanel'), 'dashboard penjual harus menampilkan panel posisi kurir');
    assert.ok(SELLER_PAGE.includes('deliverymap'), 'dashboard penjual harus menampilkan peta posisi kurir');
    assert.ok(SELLER_PAGE.includes('components/order-history/delivery-map'), 'peta penjual memakai komponen yang sama dengan halaman pembeli');
    assert.ok(SELLER_PAGE.includes('usecourierlocation'), 'peta penjual harus membaca posisi kurir live');
    assert.ok(!SELLER_PAGE.includes('courierchat') && !SELLER_PAGE.includes('chat kurir'), 'halaman penjual tidak menampilkan chat kurir');
});
test('panel posisi untuk penjual hanya membaca, tidak menulis', () => {
    assert.ok(!POSITION_PANEL.includes("'/api/courier/location'"), 'panel posisi penjual tidak boleh mengirim posisi');
});
test('motor di peta mengikuti posisi nyata dan animasi mati', () => {
    assert.ok(MAP.includes('projectontoroute'), 'peta harus memproyeksikan posisi ke rute');
    assert.ok(MAP.includes('courierposition != null'), 'animasi ilustratif harus mati saat posisi nyata tersedia');
    assert.ok(MAP.includes("'posisi kurir (live)'"), 'peta harus memberi tahu bahwa motor adalah posisi live');
    assert.ok(MAP.includes("'motor ilustratif'"), 'peta harus memberi tahu bahwa motor hanya ilustrasi');
});
test('halaman pembeli memakai posisi live dan menampilkan chat', () => {
    assert.ok(BUYER_PAGE.includes('usecourierlocation'), 'halaman detail pesanan harus membaca posisi kurir');
    assert.ok(BUYER_PAGE.includes('courierchat'), 'halaman detail harus menampilkan chat');
    assert.ok(BUYER_PAGE.includes('courierposition'), 'halaman detail pesanan harus mengirim posisi ke peta');
});
test('dashboard kurir mengirim posisi dan punya chat', () => {
    assert.ok(COURIER_DASHBOARD.includes('usecourierpositionsender'), 'dashboard kurir harus mengirim posisi');
    assert.ok(COURIER_DASHBOARD.includes('courierchat'), 'dashboard kurir harus punya chat');
    assert.ok(CHAT.includes("'/api/courier/messages'"), 'komponen chat harus memakai endpoint pesan');
});
test('status penugasan hanya boleh maju', () => {
    const start = ASSIGNMENTS_ROUTE.indexOf('allowed_next');
    assert.ok(start >= 0, 'daftar transisi penugasan harus ada');
    const block = ASSIGNMENTS_ROUTE.slice(start, start + 400);
    assert.ok(block.includes("assigned: ['picked_up'"), 'assigned harus bisa ke picked_up');
    assert.ok(block.includes("picked_up: ['delivering'"), 'picked_up harus bisa ke delivering');
    assert.ok(block.includes("delivering: ['completed'"), 'delivering harus bisa ke completed');
    assert.ok(!/picked_up:\s*\[[^\]]*'assigned'/.test(block), 'status tidak boleh bisa mundur ke assigned');
    assert.ok(!/delivering:\s*\[[^\]]*'picked_up'/.test(block), 'status tidak boleh bisa mundur ke picked_up');
});
test('koordinat tidak valid ditolak, bukan disimpan', () => {
    assert.ok(LOCATION_ROUTE.includes('isvalidcourierposition'), 'route lokasi harus memvalidasi koordinat');
    assert.ok(LOCATION_ROUTE.includes('status: 400'), 'koordinat tidak valid harus ditolak');
});
test('realtime memakai postgres_changes, bukan broadcast publik', () => {
    assert.ok(LOCATION_HOOK.includes("'postgres_changes'"), 'hook posisi harus memakai postgres_changes');
    assert.ok(!LOCATION_HOOK.includes('channel(`delivery:'), 'tidak boleh memakai kanal broadcast publik');
    assert.ok(MIGRATION.includes('alter publication supabase_realtime add table public.delivery_locations'), 'tabel posisi harus masuk publikasi realtime');
});
test('kanal posisi unik per langganan, bukan satu topik per pesanan', () => {
    assert.ok(LOCATION_HOOK.includes('channelcounter'), 'topik harus diberi penomoran');
    assert.ok(LOCATION_HOOK.includes('rebites-courier-location-${orderdbid}-${channelcounter}'), 'topik kanal harus memuat nomor langganan yang unik');
    assert.ok(!LOCATION_HOOK.includes('rebites-courier-location-${orderdbid}`'), 'topik tanpa nomor langganan akan bertabrakan antar pemasangan hook');
    assert.ok(CHAT.includes('rebites-courier-messages-${orderdbid}-${channelcounter}'), 'kanal chat harus memakai topik unik per langganan');
    assert.ok(!CHAT.includes('rebites-courier-messages-${orderdbid}`'), 'kanal chat dengan topik tetap akan melempar error setelah subscribe');
});
test('pintu masuk dashboard kurir ada di sidebar', () => {
    assert.ok(SIDEBAR.includes('/dashboard/kurir'), 'sidebar harus punya tautan dashboard kurir');
    assert.ok(SIDEBAR.includes('useiscourier'), 'sidebar harus memeriksa status kurir');
});
