/**
 * Kurir DEMO — penjadwalan tahap dan balasan otomatis.
 *
 * CACAT YANG DILAPORKAN
 * "chat dengan kurir saya chat kok ga di bales ... pastikan ketika memesan bisa
 * beneran sampai tahap pesanan selesai"
 *
 * Penyebabnya bukan UI: tanpa kurir terdaftar, penugasan otomatis tidak
 * menemukan kandidat, jadi tidak ada lawan bicara yang sah dan tidak ada yang
 * memajukan status. Modul ini memberi jalur uji yang JUJUR: berlabel demo.
 *
 * Yang dikunci di sini:
 * 1. Tahap hanya MAJU. Status yang sudah lebih jauh tidak pernah dimundurkan.
 * 2. Pesanan terminal dan pesanan yang belum dibayar tidak pernah disentuh.
 * 3. Waktu mulai yang tidak valid menghasilkan `null`, bukan tebakan.
 * 4. Pesanan ambil sendiri memakai jadwal tanpa pengantaran.
 * 5. Balasan selalu ada dan tidak pernah kosong.
 *
 * Jalankan: node --test tests/demo-courier.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDemoCourierReply,
  demoGreeting,
  demoScheduleFor,
  DEMO_DELIVERY_SCHEDULE,
  DEMO_PICKUP_SCHEDULE,
  resolveDemoTarget,
} from '../lib/demo-courier.ts';

const START = Date.parse('2026-10-31T12:00:00Z');
const at = (minutes: number) => START + minutes * 60_000;
const startIso = new Date(START).toISOString();

const target = (over: Partial<Parameters<typeof resolveDemoTarget>[0]> = {}) =>
  resolveDemoTarget({
    currentStatus: 'paid',
    fulfillment: 'delivery',
    startedAtIso: startIso,
    now: at(0),
    ...over,
  });

test('pembayaran langsung memajukan pesanan ke processing', () => {
  const result = target();
  assert.ok(result);
  assert.equal(result.status, 'processing');
  assert.equal(result.assignmentStatus, 'assigned');
});

test('belum dua menit belum berangkat', () => {
  const result = target({ currentStatus: 'processing', now: at(1.9) });
  assert.equal(result, null);
});

test('dua menit kemudian kurir demo mulai mengantar', () => {
  const result = target({ currentStatus: 'processing', now: at(2) });
  assert.ok(result);
  assert.equal(result.status, 'out_for_delivery');
  assert.equal(result.assignmentStatus, 'delivering');
});

test('enam menit kemudian pesanan selesai', () => {
  const result = target({ currentStatus: 'out_for_delivery', now: at(6) });
  assert.ok(result);
  assert.equal(result.status, 'completed');
  assert.equal(result.assignmentStatus, 'completed');
});

test('status tidak pernah mundur walau waktu mulai baru', () => {
  // Demo baru diaktifkan, tetapi pesanan sudah diantar oleh kurir nyata.
  const result = target({ currentStatus: 'out_for_delivery', now: at(0) });
  assert.equal(result, null);
});

test('pesanan selesai atau batal tidak disentuh', () => {
  for (const status of ['completed', 'cancelled', 'refunded', 'pending']) {
    assert.equal(
      target({ currentStatus: status, now: at(60) }),
      null,
      `status ${status} tidak boleh dimajukan`
    );
  }
});

test('waktu mulai tidak valid menghasilkan null, bukan tebakan', () => {
  assert.equal(target({ startedAtIso: null, now: at(60) }), null);
  assert.equal(target({ startedAtIso: 'bukan-tanggal', now: at(60) }), null);
  assert.equal(target({ startedAtIso: undefined, now: at(60) }), null);
});

test('waktu mulai di masa depan tidak memajukan apa pun', () => {
  // Jam server bisa meleset; memajukan pesanan dengan selisih negatif salah.
  assert.equal(target({ now: START - 60_000 }), null);
});

test('ambil sendiri memakai jadwal tanpa pengantaran', () => {
  const schedule = demoScheduleFor('pickup');
  assert.deepEqual(schedule, DEMO_PICKUP_SCHEDULE);
  assert.equal(
    schedule.some((stage) => stage.status === 'out_for_delivery'),
    false
  );
  assert.equal(demoScheduleFor('delivery'), DEMO_DELIVERY_SCHEDULE);
});

test('jadwal delivery selalu mulai dari processing dan berakhir completed', () => {
  assert.equal(DEMO_DELIVERY_SCHEDULE[0].status, 'processing');
  assert.equal(DEMO_DELIVERY_SCHEDULE.at(-1)?.status, 'completed');
  // Waktu harus naik, bukan acak turun.
  for (let i = 1; i < DEMO_DELIVERY_SCHEDULE.length; i += 1) {
    assert.ok(
      DEMO_DELIVERY_SCHEDULE[i].afterMinutes >
        DEMO_DELIVERY_SCHEDULE[i - 1].afterMinutes,
      'jadwal harus berurutan naik'
    );
  }
});

test('sapaan pertama menyatakan dirinya simulasi', () => {
  const greeting = demoGreeting('RB-123');
  assert.match(greeting, /RB-123/);
  assert.match(greeting, /simulasi/i);
  assert.match(greeting, /Kurir Demo/i);
});

test('balasan tidak pernah kosong untuk semua tahap', () => {
  for (const stage of ['processing', 'out_for_delivery', 'ready_for_pickup', 'completed']) {
    for (const message of ['halo', 'pesanannya mana', 'berapa lama', 'terima kasih']) {
      const reply = buildDemoCourierReply({ message, stage, orderCode: 'RB-9' });
      assert.ok(reply.trim().length > 0, `balasan kosong untuk ${stage}/${message}`);
    }
  }
});

test('pertanyaan estimasi dijawab dengan estimasi, bukan template umum', () => {
  const reply = buildDemoCourierReply({
    message: 'berapa lama lagi sampai?',
    stage: 'out_for_delivery',
    orderCode: 'RB-77',
  });
  assert.match(reply, /RB-77/);
  assert.match(reply, /perkiraan tiba|estimasi/i);
});

test('pertanyaan lokasi saat diantar menunjuk peta pesanan', () => {
  const reply = buildDemoCourierReply({
    message: 'kamu di mana sekarang?',
    stage: 'out_for_delivery',
    orderCode: 'RB-77',
  });
  assert.match(reply, /peta/i);
});

test('balasan deterministik: pesan sama menghasilkan jawaban sama', () => {
  const one = buildDemoCourierReply({ message: 'halo', stage: 'processing', orderCode: 'RB-1' });
  const two = buildDemoCourierReply({ message: 'halo', stage: 'processing', orderCode: 'RB-1' });
  assert.equal(one, two);
});
