import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { subStatusForPhase, SUB_STATUS_LABEL } from '../lib/order-substatus.ts';

function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}

test('pesanan dibatalkan tidak pernah tampil sebagai Selesai', () => {
    assert.equal(subStatusForPhase('cancelled'), 'dibatalkan');
    assert.notEqual(subStatusForPhase('cancelled'), 'selesai');
    assert.equal(SUB_STATUS_LABEL[subStatusForPhase('cancelled')], 'Dibatalkan');
});

test('pesanan belum dibayar tampil Menunggu pembayaran, bukan Sedang diantar', () => {
    assert.equal(subStatusForPhase('pending'), 'menunggu-pembayaran');
});

test('pemetaan fase operasional ke sub-status lengkap', () => {
    assert.equal(subStatusForPhase('paid'), 'disiapkan');
    assert.equal(subStatusForPhase('processing'), 'disiapkan');
    assert.equal(subStatusForPhase('out_for_delivery'), 'diantar');
    assert.equal(subStatusForPhase('ready_for_pickup'), 'siap-diambil');
    assert.equal(subStatusForPhase('completed'), 'selesai');
});

test('setiap sub-status yang mungkin punya label tampil', () => {
    const phases = ['pending', 'paid', 'processing', 'out_for_delivery', 'ready_for_pickup', 'completed', 'cancelled'] as const;
    for (const phase of phases) {
        const label = SUB_STATUS_LABEL[subStatusForPhase(phase)];
        assert.ok(typeof label === 'string' && label.trim().length > 0, `label kosong untuk fase ${phase}`);
    }
});

test('order-utils menurunkan sub-status dari fase, bukan dari kemajuan waktu', () => {
    const code = readProjectFile('lib/order-utils.ts');
    assert.ok(code.includes('subStatusForPhase(resolveOrderPhase(order))'), 'order-utils harus mendelegasikan ke subStatusForPhase');
    assert.ok(!/progress >= 0\.6/.test(code), 'tebakan sub-status berbasis kemajuan waktu harus sudah hilang');
});

test('kartu pesanan tidak lagi menjadikan pesanan batal sebagai Selesai', () => {
    const card = readProjectFile('app/components/buyer/order-history/order-card.tsx');
    assert.ok(!card.includes("sub === 'selesai' ? 'Selesai'"), 'cabang label pesanan batal masih menebak selesai');
});
