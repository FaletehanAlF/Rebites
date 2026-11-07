import test from 'node:test';
import assert from 'node:assert/strict';
import { getSellerAction, resolveOrderPhase, type OrderPhaseInput, } from '../lib/order-status-source.ts';
test('order_status modern dipakai apa adanya', () => {
    const cases: Array<[
        string,
        string
    ]> = [
        ['pending', 'pending'],
        ['paid', 'paid'],
        ['processing', 'processing'],
        ['out_for_delivery', 'out_for_delivery'],
        ['ready_for_pickup', 'ready_for_pickup'],
        ['completed', 'completed'],
    ];
    for (const [orderStatus, expected] of cases) {
        assert.equal(resolveOrderPhase({ status: 'ongoing', orderStatus }), expected, `order_status ${orderStatus}`);
    }
});
test('lifecycle completed menang atas order_status lain', () => {
    assert.equal(resolveOrderPhase({ status: 'completed', orderStatus: 'out_for_delivery' }), 'completed');
});
test('order_status terminal -> cancelled', () => {
    for (const status of ['cancelled', 'refunded', 'failed']) {
        assert.equal(resolveOrderPhase({ status: 'ongoing', orderStatus: status }), 'cancelled', `order_status ${status}`);
    }
});
test('status legacy punya alias ke fase modern', () => {
    assert.equal(resolveOrderPhase({ orderStatus: 'preparing' }), 'processing');
    assert.equal(resolveOrderPhase({ orderStatus: 'ready' }), 'ready_for_pickup');
});
test('progress_status "disiapkan" TIDAK boleh menimpa paid', () => {
    const phase = resolveOrderPhase({
        status: 'ongoing',
        orderStatus: 'paid',
        progressStatus: 'disiapkan',
    });
    assert.equal(phase, 'paid');
});
test('progress_status "disiapkan" TIDAK boleh menimpa processing', () => {
    const phase = resolveOrderPhase({
        status: 'ongoing',
        orderStatus: 'processing',
        progressStatus: 'disiapkan',
    });
    assert.equal(phase, 'processing');
});
test('progress_status "diantar" menyelamatkan pesanan lama', () => {
    const phase = resolveOrderPhase({
        status: 'ongoing',
        orderStatus: 'paid',
        progressStatus: 'diantar',
    });
    assert.equal(phase, 'out_for_delivery');
});
test('progress_status "siap-diambil" menyelamatkan pesanan lama', () => {
    const phase = resolveOrderPhase({
        status: 'ongoing',
        orderStatus: 'processing',
        progressStatus: 'siap-diambil',
    });
    assert.equal(phase, 'ready_for_pickup');
});
test('order_status modern TIDAK ditimpa progress_status', () => {
    const phase = resolveOrderPhase({
        status: 'ongoing',
        orderStatus: 'out_for_delivery',
        progressStatus: 'disiapkan',
    });
    assert.equal(phase, 'out_for_delivery');
});
test('order_status tidak dikenal -> pending, bukan tebakan', () => {
    const phase = resolveOrderPhase({
        status: 'ongoing',
        orderStatus: 'entah-apa',
        progressStatus: 'diantar',
    });
    assert.equal(phase, 'pending');
});
test('order_status kosong tanpa progress -> pending', () => {
    assert.equal(resolveOrderPhase({ status: 'ongoing' }), 'pending');
});
test('order_status kosong + progress "disiapkan" -> pending', () => {
    const phase = resolveOrderPhase({
        status: 'ongoing',
        orderStatus: null,
        progressStatus: 'disiapkan',
    });
    assert.equal(phase, 'pending');
});
test('aksi penjual pada paid adalah mulai menyiapkan', () => {
    const action = getSellerAction('paid', 'delivery');
    assert.ok(action);
    assert.equal(action.targetStatus, 'processing');
    assert.equal(action.label, 'Mulai Siapkan Pesanan');
});
test('aksi penjual pada processing: delivery -> antarkan', () => {
    const action = getSellerAction('processing', 'delivery');
    assert.ok(action);
    assert.equal(action.targetStatus, 'out_for_delivery');
    assert.equal(action.label, 'Antarkan Pesanan');
});
test('aksi penjual pada processing: pickup -> siap diambil', () => {
    const action = getSellerAction('processing', 'pickup');
    assert.ok(action);
    assert.equal(action.targetStatus, 'ready_for_pickup');
    assert.equal(action.label, 'Makanan Sudah Siap');
});
test('aksi penjual saat sedang diantar: tandai selesai', () => {
    const action = getSellerAction('out_for_delivery', 'delivery');
    assert.ok(action);
    assert.equal(action.targetStatus, 'completed');
});
test('aksi penjual saat siap diambil: tandai selesai', () => {
    const action = getSellerAction('ready_for_pickup', 'pickup');
    assert.ok(action);
    assert.equal(action.targetStatus, 'completed');
});
test('tanpa aksi untuk pending, selesai, dan dibatalkan', () => {
    for (const phase of ['pending', 'completed', 'cancelled'] as const) {
        assert.equal(getSellerAction(phase, 'delivery'), null, `fase ${phase}`);
    }
});
test('SEMUA pasangan target aksi diizinkan trigger database', () => {
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
            if (!action)
                continue;
            const key = `${phase}>${action.targetStatus}`;
            assert.ok(allowed.has(key), `pasangan ${key} tidak diizinkan trigger`);
        }
    }
});
test('fase tidak dikenal tidak menghasilkan aksi', () => {
    const input: OrderPhaseInput = { orderStatus: 'entah-apa' };
    const phase = resolveOrderPhase(input);
    assert.equal(getSellerAction(phase, 'delivery'), null);
});
test('pengiriman dengan toko bertitik lokasi: kurir berangkat tanpa tombol kedua', () => {
    const action = getSellerAction('processing', 'delivery', {
        autoAdvanceTo: 'out_for_delivery',
    });
    assert.ok(action);
    assert.equal(action.targetStatus, 'out_for_delivery');
    assert.match(action.description, /otomatis/i);
});
test('pengiriman tanpa titik lokasi toko tetap dua langkah', () => {
    const action = getSellerAction('processing', 'delivery', {
        autoAdvanceTo: null,
    });
    assert.ok(action);
    assert.equal(action.targetStatus, 'out_for_delivery');
    assert.doesNotMatch(action.description, /otomatis/i);
});
test('auto dispatch tidak berlaku untuk pickup', () => {
    const action = getSellerAction('processing', 'pickup', {
        autoAdvanceTo: 'out_for_delivery',
    });
    assert.ok(action);
    assert.equal(action.targetStatus, 'ready_for_pickup');
});
test('auto dispatch tidak mengubah fase lain', () => {
    const paid = getSellerAction('paid', 'delivery', { autoAdvanceTo: 'out_for_delivery' });
    assert.ok(paid);
    assert.equal(paid.targetStatus, 'processing');
    const done = getSellerAction('out_for_delivery', 'delivery', {
        autoAdvanceTo: 'out_for_delivery',
    });
    assert.ok(done);
    assert.equal(done.targetStatus, 'completed');
});
