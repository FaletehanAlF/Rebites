import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SHIPMENT_STATE_LABEL, TO_SHIP_STALE_HOURS, deriveShipmentState, isShipmentToShipStale, shipmentNeedsAttention, shipmentToShipAgeHours, shipmentToShipAgeLabel, staleToShipAgeLabel, } from '../lib/shipment-state.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const NOW = Date.parse('2026-11-05T10:00:00.000Z');
const FUTURE = '2026-11-05T12:00:00.000Z';
const PAST = '2026-11-05T08:00:00.000Z';
test('deriveShipmentState: dibayar tetapi belum diserahkan = menunggu dikirim', () => {
    for (const order_status of ['paid', 'processing', 'preparing', 'ready']) {
        assert.equal(deriveShipmentState({ payment_status: 'paid', order_status }, NOW), 'to_ship', `status ${order_status} harus menunggu dikirim`);
    }
    assert.equal(deriveShipmentState({ payment_status: 'paid', order_status: 'paid' }, NOW), 'to_ship');
    assert.equal(deriveShipmentState({ payment_status: 'PAID', order_status: ' Processing ' }, NOW), 'to_ship');
});
test('deriveShipmentState: belum dibayar tidak masuk siklus pengiriman', () => {
    assert.equal(deriveShipmentState({ payment_status: 'unpaid', order_status: 'processing' }, NOW), 'inactive');
    assert.equal(deriveShipmentState({ payment_status: 'failed', order_status: 'processing' }, NOW), 'inactive');
});
test('deriveShipmentState: sedang diantar, terlambat hanya bila estimasi terlewat', () => {
    assert.equal(deriveShipmentState({ payment_status: 'paid', order_status: 'out_for_delivery', estimated_arrival_at: FUTURE }, NOW), 'in_transit');
    assert.equal(deriveShipmentState({ payment_status: 'paid', order_status: 'out_for_delivery', estimated_arrival_at: null }, NOW), 'in_transit');
    assert.equal(deriveShipmentState({ payment_status: 'paid', order_status: 'out_for_delivery', estimated_arrival_at: PAST }, NOW), 'late');
    assert.equal(deriveShipmentState({
        payment_status: 'paid',
        order_status: 'out_for_delivery',
        estimated_arrival_at: 'bukan-tanggal',
    }, NOW), 'in_transit');
});
test('deriveShipmentState: selesai dan status lain di luar siklus', () => {
    assert.equal(deriveShipmentState({ payment_status: 'paid', order_status: 'completed', estimated_arrival_at: PAST }, NOW), 'done', 'selesai menang atas estimasi yang terlewat');
    for (const order_status of ['pending', 'cancelled', 'refunded', 'entah-apa']) {
        assert.equal(deriveShipmentState({ payment_status: 'paid', order_status }, NOW), 'inactive', `status ${order_status} bukan kiriman`);
    }
});
test('deriveShipmentState: pesanan ambil sendiri tidak pernah jadi kiriman', () => {
    assert.equal(deriveShipmentState({ payment_status: 'paid', order_status: 'processing', delivery_option: 'pickup' }, NOW), 'inactive');
    assert.equal(deriveShipmentState({ payment_status: 'paid', order_status: 'out_for_delivery', delivery_option: 'pickup' }, NOW), 'inactive');
    assert.equal(deriveShipmentState({ payment_status: 'paid', order_status: 'processing', delivery_option: 'delivery' }, NOW), 'to_ship');
});
test('shipmentNeedsAttention: hanya menunggu dikirim dan terlambat', () => {
    assert.equal(shipmentNeedsAttention('to_ship'), true);
    assert.equal(shipmentNeedsAttention('late'), true);
    assert.equal(shipmentNeedsAttention('in_transit'), false);
    assert.equal(shipmentNeedsAttention('done'), false);
    assert.equal(shipmentNeedsAttention('inactive'), false);
});
test('label status tersedia untuk kelima keadaan', () => {
    for (const state of ['to_ship', 'in_transit', 'late', 'done', 'inactive'] as const) {
        assert.equal(typeof SHIPMENT_STATE_LABEL[state], 'string');
        assert.ok(SHIPMENT_STATE_LABEL[state].length > 0);
    }
});
test('umur kiriman: hanya dihitung untuk yang menunggu dikirim', () => {
    const created = new Date(NOW - 3 * 60 * 60 * 1000).toISOString();
    assert.equal(shipmentToShipAgeHours(created, 'to_ship', NOW), 3);
    for (const state of ['in_transit', 'late', 'done', 'inactive'] as const) {
        assert.equal(shipmentToShipAgeHours(created, state, NOW), null, `state ${state}`);
    }
});
test('umur kiriman: tanggal tak terbaca dan waktu masa depan dijawab "tidak tahu"', () => {
    for (const value of [null, undefined, '', '  ', 'bukan-tanggal']) {
        assert.equal(shipmentToShipAgeHours(value, 'to_ship', NOW), null, `nilai ${String(value)}`);
        assert.equal(isShipmentToShipStale(value, 'to_ship', NOW), false);
        assert.equal(staleToShipAgeLabel(value, 'to_ship', NOW), null);
    }
    const future = new Date(NOW + 60 * 60 * 1000).toISOString();
    assert.equal(shipmentToShipAgeHours(future, 'to_ship', NOW), null);
    assert.equal(isShipmentToShipStale(future, 'to_ship', NOW), false);
});
test('batas macet: tepat 24 jam belum, lebih sedikit sudah', () => {
    const tepat = new Date(NOW - TO_SHIP_STALE_HOURS * 60 * 60 * 1000).toISOString();
    assert.equal(isShipmentToShipStale(tepat, 'to_ship', NOW), false);
    assert.equal(staleToShipAgeLabel(tepat, 'to_ship', NOW), null);
    const lewatSemenit = new Date(NOW - TO_SHIP_STALE_HOURS * 60 * 60 * 1000 - 60 * 1000).toISOString();
    assert.equal(isShipmentToShipStale(lewatSemenit, 'to_ship', NOW), true);
    assert.equal(staleToShipAgeLabel(lewatSemenit, 'to_ship', NOW), 'Menunggu 24 jam');
});
test('label umur: jam di bawah dua hari, hari setelahnya', () => {
    assert.equal(shipmentToShipAgeLabel(1), 'Menunggu 1 jam');
    assert.equal(shipmentToShipAgeLabel(25.9), 'Menunggu 25 jam');
    assert.equal(shipmentToShipAgeLabel(47.9), 'Menunggu 47 jam');
    assert.equal(shipmentToShipAgeLabel(48), 'Menunggu 2 hari');
    assert.equal(shipmentToShipAgeLabel(72), 'Menunggu 3 hari');
    assert.equal(shipmentToShipAgeLabel(null), null);
    assert.equal(shipmentToShipAgeLabel(-1), null);
    assert.equal(shipmentToShipAgeLabel(Number.NaN), null);
});
test('ringkasan kiriman macet memakai ambang dan definisi yang sama di dua route', () => {
    const shipmentsRoute = readProjectFile('app/api/admin/shipments/route.ts');
    const dashboardRoute = readProjectFile('app/api/admin/dashboard/route.ts');
    const lib = readProjectFile('lib/shipment-state.ts');
    assert.match(lib, /export const TO_SHIP_STALE_HOURS = 24/);
    assert.match(shipmentsRoute, /TO_SHIP_STALE_HOURS/);
    assert.match(dashboardRoute, /TO_SHIP_STALE_HOURS/);
    assert.match(lib, /export const TO_SHIP_STATUSES/);
    assert.match(shipmentsRoute, /TO_SHIP_STATUSES/);
    assert.match(dashboardRoute, /TO_SHIP_STATUSES/);
    assert.match(shipmentsRoute, /lt\('created_at', staleToShipCutoffIso\)/);
    assert.match(dashboardRoute, /lt\('created_at', staleShipmentCutoffIso\)/);
    assert.match(shipmentsRoute, /stale: countOf\(summaryResults\[4\]\)/);
    assert.match(dashboardRoute, /shipments: \{ stale: staleShipmentCount\(/);
    const libClient = readProjectFile('lib/admin-shipments.ts');
    assert.match(libClient, /stale: number;/);
    const dashboardClient = readProjectFile('lib/admin-dashboard.ts');
    assert.match(dashboardClient, /shipments: \{[\s\S]{0,40}stale: number/);
});
test('halaman Pengiriman menyorot kiriman macet dan membaca filter dari tautan', () => {
    const view = readProjectFile('app/components/admin/shipments-management-view.tsx');
    assert.match(view, /staleToShipAgeLabel/);
    assert.match(view, /label="Menunggu > 24 jam"/);
    assert.match(view, /new URLSearchParams\(window\.location\.search\)\.get\('state'\)/);
    assert.match(view, /STATE_VALUES/);
    const attention = readProjectFile('app/components/admin/dashboard/dashboard-attention.tsx');
    assert.match(attention, /data\.shipments\.stale > 0/);
    assert.match(attention, /\/dashboard\/admin\/pengiriman\?state=to_ship/);
});
test('route daftar pengiriman: filter state, pencarian, dan tanpa service role', () => {
    const route = readProjectFile('app/api/admin/shipments/route.ts');
    assert.match(route, /STATE_ALLOWLIST = \['to_ship', 'in_transit', 'late', 'done'\] as const/);
    assert.match(route, /Filter state tidak valid/);
    assert.match(route, /eq\('delivery_option', 'delivery'\)/);
    assert.match(route, /deriveShipmentState\(/);
    assert.match(route, /sanitizeSearchTerm\(/);
    assert.match(route, /queryFailureResponse\(/);
    assert.match(route, /toShip: countOf\(/);
    assert.match(route, /inTransit: countOf\(/);
    assert.match(route, /late: countOf\(/);
    assert.match(route, /done: countOf\(/);
    assert.doesNotMatch(route, /createServiceClient/);
    assert.doesNotMatch(route, /export async function (POST|PATCH|DELETE)/);
});
test('lib klien pengiriman memakai fetchAdminWithAuth + AuthError', () => {
    const lib = readProjectFile('lib/admin-shipments.ts');
    assert.match(lib, /fetchAdminWithAuth/);
    assert.doesNotMatch(lib, /getAdminAuthHeader/);
    assert.match(lib, /instanceof AuthError/);
    assert.match(lib, /\/api\/admin\/shipments\?/);
});
test('halaman dan menu Pengiriman terpasang', () => {
    const page = readProjectFile('app/dashboard/admin/pengiriman/page.tsx');
    assert.match(page, /ShipmentsManagementView/);
    const view = readProjectFile('app/components/admin/shipments-management-view.tsx');
    assert.match(view, /redirectIfSessionExpired/);
    assert.match(view, /useRef\(0\)/);
    assert.match(view, /ShipmentStateBadge/);
    const sidebar = readProjectFile('app/components/admin/admin-sidebar.tsx');
    assert.match(sidebar, /\/dashboard\/admin\/pengiriman/);
    assert.match(sidebar, /Truck/);
    const topbar = readProjectFile('app/components/admin/admin-topbar.tsx');
    assert.match(topbar, /href: '\/dashboard\/admin\/pengiriman', title: 'Pengiriman'/);
});
test('Pantau berpindah halaman, bukan membuka pop up', () => {
    const view = readProjectFile('app/components/admin/shipments-management-view.tsx');
    assert.match(view, /href=\{`\/dashboard\/admin\/pengiriman\/\$\{item\.id\}`\}/);
    assert.doesNotMatch(view, /<Dialog/);
    const page = readProjectFile('app/dashboard/admin/pengiriman/[id]/page.tsx');
    assert.match(page, /ShipmentDetailView/);
    const detail = readProjectFile('app/components/admin/shipment-detail-view.tsx');
    assert.match(detail, /SmartImage/);
    assert.match(detail, /paymentMethodName/);
    assert.match(detail, /formatJarak/);
    assert.match(detail, /useCourierLocation/);
    assert.match(detail, /buildMapPlan/);
});
test('route detail kiriman: read-only, tanpa service role, koordinat tidak dikarang', () => {
    const route = readProjectFile('app/api/admin/shipments/[id]/route.ts');
    assert.match(route, /getAdminUser\(/);
    assert.match(route, /shipping_snapshot/);
    assert.match(route, /address_snapshot/);
    assert.match(route, /asCoordinate\(/);
    assert.match(route, /deriveShipmentState\(/);
    assert.match(route, /delivery_assignments/);
    assert.doesNotMatch(route, /export async function (POST|PATCH|DELETE)/);
    assert.doesNotMatch(route, /createServiceClient/);
});
test('badge merah Pengiriman hilang setelah halaman dibuka', () => {
    const view = readProjectFile('app/components/admin/shipments-management-view.tsx');
    const detail = readProjectFile('app/components/admin/shipment-detail-view.tsx');
    const prefs = readProjectFile('lib/admin-preferences.ts');
    const hook = readProjectFile('hooks/use-shipment-badge.ts');
    const sidebar = readProjectFile('app/components/admin/admin-sidebar.tsx');
    assert.match(view, /markShipmentsSeen\(\)/);
    assert.match(detail, /markShipmentsSeen\(\)/);
    assert.match(prefs, /ADMIN_SHIPMENTS_SEEN_KEY/);
    assert.match(prefs, /ADMIN_SHIPMENTS_SEEN_EVENT/);
    assert.match(prefs, /export function markShipmentsSeen/);
    assert.match(hook, /delivery_option', 'delivery'/);
    assert.match(hook, /gt\('created_at', seenAt\)/);
    assert.match(sidebar, /useShipmentBadge\(me !== null\)/);
    assert.match(sidebar, /badgeKind: 'shipment'/);
});
