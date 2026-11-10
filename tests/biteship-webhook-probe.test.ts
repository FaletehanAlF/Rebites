import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyBiteshipWebhookRequest } from '../lib/server/biteship-webhook-guard.ts';

const SECRET = 'a'.repeat(48);

function cek(input: { rawBody: string; providedSecret: string | null; expectedSecret: string | null }) {
    return classifyBiteshipWebhookRequest(input);
}

test('permintaan uji tanpa isi dan tanpa kunci dijawab sebagai probe, bukan ditolak', () => {
    assert.equal(cek({ rawBody: '', providedSecret: null, expectedSecret: SECRET }).action, 'probe');
    assert.equal(cek({ rawBody: '   \n ', providedSecret: null, expectedSecret: SECRET }).action, 'probe');
});

test('badan JSON kosong tanpa kunci juga dianggap permintaan uji', () => {
    assert.equal(cek({ rawBody: '{}', providedSecret: null, expectedSecret: SECRET }).action, 'probe');
});

test('permintaan uji tetap diterima walau kuncinya belum di-set di server', () => {
    assert.equal(cek({ rawBody: '', providedSecret: null, expectedSecret: null }).action, 'probe');
});

test('notifikasi sungguhan tanpa kunci tetap ditolak, tidak pernah dianggap permintaan uji', () => {
    const badan = JSON.stringify({ event: 'order.status', order_id: 'shp_1', status: 'picked' });
    assert.equal(cek({ rawBody: badan, providedSecret: null, expectedSecret: SECRET }).action, 'unauthorized');
});

test('notifikasi sungguhan dengan kunci salah ditolak', () => {
    const badan = JSON.stringify({ event: 'order.status', order_id: 'shp_1' });
    assert.equal(cek({ rawBody: badan, providedSecret: 'b'.repeat(48), expectedSecret: SECRET }).action, 'unauthorized');
    assert.equal(cek({ rawBody: badan, providedSecret: 'a'.repeat(47), expectedSecret: SECRET }).action, 'unauthorized');
});

test('notifikasi sungguhan dengan kunci benar diteruskan apa adanya', () => {
    const badan = JSON.stringify({ event: 'order.status', order_id: 'shp_1', status: 'picked' });
    const hasil = cek({ rawBody: badan, providedSecret: SECRET, expectedSecret: SECRET });
    assert.equal(hasil.action, 'ready');
    assert.equal(hasil.action === 'ready' ? hasil.payload.order_id : null, 'shp_1');
});

test('kunci benar tapi isi tidak terurai tetap ditolak sebagai JSON tidak sah', () => {
    assert.equal(cek({ rawBody: 'bukan json', providedSecret: SECRET, expectedSecret: SECRET }).action, 'invalid-json');
    assert.equal(cek({ rawBody: '[1,2,3]', providedSecret: SECRET, expectedSecret: SECRET }).action, 'invalid-json');
    assert.equal(cek({ rawBody: 'null', providedSecret: SECRET, expectedSecret: SECRET }).action, 'invalid-json');
});

test('kunci benar dengan badan kosong tidak pernah menyentuh basis data', () => {
    assert.equal(cek({ rawBody: '', providedSecret: SECRET, expectedSecret: SECRET }).action, 'probe');
});

test('kunci server kosong dilaporkan sebagai salah konfigurasi, bukan sebagai tidak sah', () => {
    const badan = JSON.stringify({ event: 'order.status', order_id: 'shp_1' });
    assert.equal(cek({ rawBody: badan, providedSecret: SECRET, expectedSecret: '' }).action, 'misconfigured');
    assert.equal(cek({ rawBody: badan, providedSecret: SECRET, expectedSecret: null }).action, 'misconfigured');
});

test('penjaga ini benar-benar bisa gagal: tanpa aturan probe, badan kosong jatuh ke unauthorized', () => {
    const badan = '';
    assert.notEqual(cek({ rawBody: badan, providedSecret: null, expectedSecret: SECRET }).action, 'unauthorized');
    const tanpaProbe = cek({ rawBody: badan, providedSecret: null, expectedSecret: SECRET });
    assert.equal(tanpaProbe.action === 'ready', false);
});
