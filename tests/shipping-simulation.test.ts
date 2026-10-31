import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SHIPPING_SIM_MODE_STORAGE_KEY,
  SHIPPING_SIM_STATUS_ORDER,
  advanceShippingSimRecord,
  applyShippingSimTransition,
  buildSimRouteGeometry,
  createShippingSimRecord,
  distanceBetweenKm,
  getNextShippingSimAction,
  getSimCourierPosition,
  getSimCourierTravelFraction,
  getSimulatedCourier,
  interpolateSimPosition,
  isShippingSimFlagInSearch,
  isShippingSimModeEnabled,
  isValidLatitude,
  isValidLongitude,
  isValidShippingSimTransition,
  isValidSimGeoPoint,
  loadShippingSimRecord,
  nextShippingSimStatus,
  parseCoordinate,
  parseShippingSimRecord,
  removeShippingSimRecord,
  resolveShippingSimPoint,
  saveShippingSimRecord,
  setShippingSimModeEnabled,
  shippingSimStorageKey,
  syncShippingSimModeFromSearch,
} from '../lib/shipping-simulation.ts';
import type {
  ShippingSimRecord,
  SimGeoPoint,
} from '../lib/shipping-simulation.ts';
import {
  MOCK_SHIPPING_PROVIDER_NAME,
  buildMockReferenceId,
  mockShippingProvider,
} from '../lib/shipping/mock-provider.ts';
import type { ShippingQuoteRequest } from '../lib/shipping/provider.ts';

const T0 = '2026-10-15T03:00:00.000Z';

/** Storage in-memory untuk menguji lapisan localStorage tanpa browser. */
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

/** Pasang `window.localStorage` palsu hanya selama callback berjalan. */
async function withFakeStorage<T>(
  fn: (storage: Storage) => T | Promise<T>
): Promise<T> {
  const storage = createMemoryStorage();
  const globalRecord = globalThis as Record<string, unknown>;
  const hadWindow = 'window' in globalRecord;
  const previousWindow = globalRecord.window;
  globalRecord.window = { localStorage: storage };
  try {
    return await fn(storage);
  } finally {
    if (hadWindow) globalRecord.window = previousWindow;
    else delete globalRecord.window;
  }
}

function point(latitude: number, longitude: number): SimGeoPoint {
  return { latitude, longitude, source: 'snapshot' };
}

function advanceToEnd(): ShippingSimRecord {
  let record = createShippingSimRecord('RB-TEST001', T0);
  let guard = 0;
  while (guard < 20) {
    const next = advanceShippingSimRecord(record, T0);
    if (!next) break;
    record = next;
    guard += 1;
  }
  return record;
}

test('urutan status simulasi lengkap dan berurutan', () => {
  assert.equal(SHIPPING_SIM_STATUS_ORDER.length, 8);
  const finalized = advanceToEnd();
  assert.equal(finalized.status, 'selesai');
  const visited = finalized.history.map((entry) => entry.status);
  assert.deepEqual(visited, [...SHIPPING_SIM_STATUS_ORDER]);
});

test('transisi hanya boleh ke tahap berikutnya (tidak bisa melompat)', () => {
  const record = createShippingSimRecord('RB-TEST002', T0);
  assert.equal(isValidShippingSimTransition('menunggu_penjual', 'siap_diambil'), true);
  assert.equal(isValidShippingSimTransition('menunggu_penjual', 'selesai'), false);
  assert.equal(isValidShippingSimTransition('menunggu_penjual', 'dalam_perjalanan'), false);
  assert.equal(applyShippingSimTransition(record, 'selesai', T0), null);
  assert.equal(applyShippingSimTransition(record, 'dalam_perjalanan', T0), null);
  assert.equal(nextShippingSimStatus('menunggu_penjual'), 'siap_diambil');
});

test('status terminal tidak bisa dilanjutkan lagi', () => {
  const done = advanceToEnd();
  assert.equal(advanceShippingSimRecord(done, T0), null);
  assert.equal(nextShippingSimStatus(done.status), null);
  assert.equal(getNextShippingSimAction(done.status), null);
  assert.equal(isValidShippingSimTransition('selesai', 'dibatalkan'), false);
  assert.equal(isValidShippingSimTransition('dibatalkan', 'menunggu_penjual'), false);
});

test('pembatalan valid dari setiap tahap non-terminal', () => {
  for (const status of SHIPPING_SIM_STATUS_ORDER.slice(0, -1)) {
    let record = createShippingSimRecord('RB-TEST003', T0);
    while (record.status !== status) {
      const next = advanceShippingSimRecord(record, T0);
      assert.ok(next, `harus bisa maju ke ${status}`);
      record = next;
    }
    const cancelled = applyShippingSimTransition(
      record,
      'dibatalkan',
      '2026-10-15T04:00:00.000Z',
      'uji batal'
    );
    assert.ok(cancelled, `batal dari ${status} harus valid`);
    assert.equal(cancelled?.status, 'dibatalkan');
    assert.equal(cancelled?.history.at(-1)?.note, 'uji batal');
  }
});

test('history transisi mencatat waktu dan status secara berurutan', () => {
  let record = createShippingSimRecord('RB-TEST004', T0);
  record = applyShippingSimTransition(record, 'siap_diambil', '2026-10-15T03:05:00.000Z')!;
  record = applyShippingSimTransition(record, 'kurir_ditugaskan', '2026-10-15T03:06:00.000Z')!;
  assert.equal(record.history.length, 3);
  assert.deepEqual(
    record.history.map((entry) => entry.at),
    [T0, '2026-10-15T03:05:00.000Z', '2026-10-15T03:06:00.000Z']
  );
  assert.equal(record.updatedAt, '2026-10-15T03:06:00.000Z');
  assert.equal(record.startedAt, T0);
});

test('kurir simulasi deterministik per order dan berlabel simulasi', () => {
  const a = getSimulatedCourier('RB-ABC123');
  const b = getSimulatedCourier('RB-ABC123');
  assert.deepEqual(a, b);
  assert.match(a.id, /^SIM-\d{4}$/);
  assert.ok(a.name.length > 0);
  assert.equal(a.label, 'Kurir Simulasi');
});

test('label aksi tahap berikutnya tersedia sampai tiba di tujuan', () => {
  assert.deepEqual(getNextShippingSimAction('menunggu_penjual'), {
    target: 'siap_diambil',
    label: 'Pesanan Siap Diambil',
  });
  assert.deepEqual(getNextShippingSimAction('tiba_di_tujuan'), {
    target: 'selesai',
    label: 'Selesaikan Pengiriman',
  });
  assert.equal(getNextShippingSimAction('selesai'), null);
  assert.equal(getNextShippingSimAction('dibatalkan'), null);
});

test('fraksi perjalanan kurir null sebelum penugasan dan monoton setelahnya', () => {
  assert.equal(getSimCourierTravelFraction('menunggu_penjual'), null);
  assert.equal(getSimCourierTravelFraction('siap_diambil'), null);
  assert.equal(getSimCourierTravelFraction('dibatalkan'), null);
  const fractions = [
    getSimCourierTravelFraction('kurir_ditugaskan'),
    getSimCourierTravelFraction('menuju_penjemputan'),
    getSimCourierTravelFraction('pesanan_diambil'),
    getSimCourierTravelFraction('dalam_perjalanan'),
    getSimCourierTravelFraction('tiba_di_tujuan'),
    getSimCourierTravelFraction('selesai'),
  ];
  for (let i = 0; i < fractions.length; i += 1) {
    assert.notEqual(fractions[i], null);
    if (i > 0) {
      assert.ok(fractions[i]! >= fractions[i - 1]!);
    }
  }
});

test('interpolasi posisi kurir: depot -> toko -> tujuan', () => {
  const origin = point(-6.2, 106.8);
  const destination = point(-6.25, 106.85);
  const geometry = buildSimRouteGeometry(origin, destination);
  assert.equal(geometry.depot.source, 'simulated');

  const atStart = interpolateSimPosition(geometry, 0);
  assert.equal(atStart.latitude, geometry.depot.latitude);
  assert.equal(atStart.longitude, geometry.depot.longitude);

  const atPickup = interpolateSimPosition(geometry, 0.5);
  assert.equal(atPickup.latitude, origin.latitude);
  assert.equal(atPickup.longitude, origin.longitude);

  const atEnd = interpolateSimPosition(geometry, 1);
  assert.equal(atEnd.latitude, destination.latitude);
  assert.equal(atEnd.longitude, destination.longitude);

  const midway = interpolateSimPosition(geometry, 0.25);
  assert.ok(midway.latitude < geometry.depot.latitude);
  assert.ok(midway.latitude > origin.latitude);
});

test('posisi kurir hanya ada setelah kurir ditugaskan', () => {
  const origin = point(-6.2, 106.8);
  const destination = point(-6.25, 106.85);
  assert.equal(getSimCourierPosition('menunggu_penjual', origin, destination), null);
  assert.equal(getSimCourierPosition('siap_diambil', origin, destination), null);
  const assigned = getSimCourierPosition('kurir_ditugaskan', origin, destination);
  assert.ok(assigned);
  assert.equal(assigned?.source, 'simulated');
  const delivered = getSimCourierPosition('selesai', origin, destination);
  assert.equal(delivered?.latitude, destination.latitude);
  assert.equal(delivered?.longitude, destination.longitude);
});

test('perubahan status menggerakkan kurir maju tanpa mundur (sketsa rute)', () => {
  // Koordinat contoh hanya untuk pengujian lokal.
  const origin = point(-6.1754, 106.8272);
  const destination = point(-6.26, 106.9);
  const geometry = buildSimRouteGeometry(origin, destination);

  let record = createShippingSimRecord('RB-MOVE1', T0);
  const samples: Array<{
    status: string;
    fraction: number | null;
    toDestinationKm: number | null;
  }> = [];
  for (;;) {
    const fraction = getSimCourierTravelFraction(record.status);
    const position = getSimCourierPosition(record.status, origin, destination);
    samples.push({
      status: record.status,
      fraction,
      toDestinationKm: position ? distanceBetweenKm(position, destination) : null,
    });
    const next = advanceShippingSimRecord(record, T0);
    if (!next) break;
    record = next;
  }

  assert.equal(record.status, 'selesai');
  // Sebelum kurir ditugaskan: belum ada posisi di peta.
  assert.equal(samples[0].fraction, null);
  assert.equal(samples[0].toDestinationKm, null);
  assert.equal(samples[1].fraction, null);
  // Saat ditugaskan: mulai dari titik awal kurir (depot simulasi), bukan toko.
  const assigned = getSimCourierPosition('kurir_ditugaskan', origin, destination)!;
  assert.equal(assigned.latitude, geometry.depot.latitude);
  assert.equal(assigned.longitude, geometry.depot.longitude);
  // Fraksi tidak pernah mundur dan jarak ke tujuan tidak pernah bertambah.
  const assignedSamples = samples.filter((sample) => sample.fraction !== null);
  assert.ok(assignedSamples.length >= 5);
  for (let i = 1; i < assignedSamples.length; i += 1) {
    assert.ok(
      assignedSamples[i].fraction! >= assignedSamples[i - 1].fraction!,
      `fraksi mundur di ${assignedSamples[i].status}`
    );
    assert.ok(
      assignedSamples[i].toDestinationKm! <= assignedSamples[i - 1].toDestinationKm!,
      `jarak ke tujuan bertambah di ${assignedSamples[i].status}`
    );
  }
  // Selesai: kurir tepat di titik tujuan.
  assert.equal(samples.at(-1)?.toDestinationKm, 0);
});

test('validasi koordinat menolak nilai di luar rentang', () => {
  assert.equal(isValidLatitude(-6.2), true);
  assert.equal(isValidLatitude(90), true);
  assert.equal(isValidLatitude(90.01), false);
  assert.equal(isValidLatitude(Number.NaN), false);
  assert.equal(isValidLongitude(106.8), true);
  assert.equal(isValidLongitude(180), true);
  assert.equal(isValidLongitude(-180.01), false);
});

test('parseCoordinate hanya menerima angka valid (tidak mengarang)', () => {
  assert.equal(parseCoordinate(' -6.2 '), -6.2);
  assert.equal(parseCoordinate('-6,2'), -6.2);
  assert.equal(parseCoordinate(-6.2), -6.2);
  assert.equal(parseCoordinate(''), null);
  assert.equal(parseCoordinate('abc'), null);
  assert.equal(parseCoordinate('1.2.3'), null);
  assert.equal(parseCoordinate('12abc'), null);
  assert.equal(parseCoordinate(Number.POSITIVE_INFINITY), null);
  assert.equal(parseCoordinate(null), null);
});

test('resolusi titik rute: override penguji menang, snapshot hanya bila valid', () => {
  // Koordinat contoh hanya untuk pengujian lokal (area Jakarta).
  const override: SimGeoPoint = {
    latitude: -6.2,
    longitude: 106.8,
    source: 'manual',
  };
  assert.deepEqual(
    resolveShippingSimPoint(override, -6.1754, 106.8272),
    override
  );

  assert.deepEqual(resolveShippingSimPoint(null, -6.1754, 106.8272), {
    latitude: -6.1754,
    longitude: 106.8272,
    source: 'snapshot',
  });

  // Nilai tidak sah tidak pernah dipakai (tanpa mengarang titik).
  assert.equal(resolveShippingSimPoint(null, '-6.1754', 106.8272), null);
  assert.equal(resolveShippingSimPoint(null, -6.1754, '106.8272'), null);
  assert.equal(resolveShippingSimPoint(null, 91, 106.8272), null);
  assert.equal(resolveShippingSimPoint(null, -6.1754, 181), null);
  assert.equal(resolveShippingSimPoint(null, Number.NaN, 106.8272), null);
  assert.equal(resolveShippingSimPoint(null, -6.1754, undefined), null);
  assert.equal(resolveShippingSimPoint(null, null, null), null);
  assert.equal(resolveShippingSimPoint(undefined, null, null), null);

  // Override rusak jatuh ke snapshot valid, bukan dipakai mentah-mentah.
  const brokenOverride = {
    latitude: Number.NaN,
    longitude: 106.8,
    source: 'device',
  } as unknown as SimGeoPoint;
  assert.deepEqual(resolveShippingSimPoint(brokenOverride, -6.1754, 106.8272), {
    latitude: -6.1754,
    longitude: 106.8272,
    source: 'snapshot',
  });
});

test('kunci storage simulasi per order, tidak menimpa kunci lain', () => {
  assert.equal(shippingSimStorageKey('RB-1'), 'rebites-shipping-sim-v1:RB-1');
  assert.notEqual(shippingSimStorageKey('RB-1'), shippingSimStorageKey('RB-2'));
});

test('penyimpanan simulasi: round-trip per order, data rusak aman, reset bersih', async () => {
  await withFakeStorage((storage) => {
    const record = advanceShippingSimRecord(
      createShippingSimRecord('RB-STORE1', T0),
      T0
    )!;
    saveShippingSimRecord(record);
    const key = shippingSimStorageKey('RB-STORE1');
    assert.notEqual(storage.getItem(key), null);
    assert.deepEqual(loadShippingSimRecord('RB-STORE1'), record);

    // Tidak bercampur antar pesanan.
    assert.equal(loadShippingSimRecord('RB-STORE2'), null);

    // JSON rusak tidak pernah dipakai mentah-mentah.
    storage.setItem(key, '{bukan json');
    assert.equal(loadShippingSimRecord('RB-STORE1'), null);

    // Simpan ulang lalu reset: kunci benar-benar bersih.
    saveShippingSimRecord(record);
    removeShippingSimRecord('RB-STORE1');
    assert.equal(storage.getItem(key), null);
    assert.equal(loadShippingSimRecord('RB-STORE1'), null);
  });
});

test('mode simulasi: flag URL menang & tersimpan; opt-out dihormati', async () => {
  await withFakeStorage((storage) => {
    // Tanpa nilai tersimpan, default mengikuti build (dev = aktif).
    assert.equal(
      isShippingSimModeEnabled(),
      process.env.NODE_ENV !== 'production'
    );
    assert.equal(syncShippingSimModeFromSearch('?shipping-sim=1'), true);
    assert.equal(storage.getItem(SHIPPING_SIM_MODE_STORAGE_KEY), '1');
    assert.equal(syncShippingSimModeFromSearch('?shipping-sim=0'), false);
    assert.equal(storage.getItem(SHIPPING_SIM_MODE_STORAGE_KEY), '0');

    // Tanpa parameter: nilai tersimpan yang dipakai.
    storage.setItem(SHIPPING_SIM_MODE_STORAGE_KEY, '1');
    assert.equal(syncShippingSimModeFromSearch('?orderId=RB-1'), true);
    setShippingSimModeEnabled(false);
    assert.equal(isShippingSimModeEnabled(), false);
    assert.equal(syncShippingSimModeFromSearch('?orderId=RB-1'), false);
  });

  assert.equal(isShippingSimFlagInSearch('?shipping-sim=1'), true);
  assert.equal(isShippingSimFlagInSearch('shipping-sim=1&x=2'), true);
  assert.equal(isShippingSimFlagInSearch('?shipping-sim=0'), false);
  assert.equal(isShippingSimFlagInSearch('?shipping-sim'), false);
});

test('jarak haversine wajar untuk dua titik berbeda', () => {
  const km = distanceBetweenKm(point(-6.2, 106.8), point(-6.25, 106.85));
  assert.ok(km > 5 && km < 15, `jarak tak wajar: ${km}`);
  assert.equal(distanceBetweenKm(point(-6.2, 106.8), point(-6.2, 106.8)), 0);
});

test('state tidak valid ditolak: batal dua kali, lanjut setelah batal, koordinat ekstrem', () => {
  const cancelled = applyShippingSimTransition(
    createShippingSimRecord('RB-CANCEL1', T0),
    'dibatalkan',
    T0
  )!;
  assert.equal(cancelled.status, 'dibatalkan');
  assert.equal(applyShippingSimTransition(cancelled, 'dibatalkan', T0), null);
  assert.equal(advanceShippingSimRecord(cancelled, T0), null);
  assert.equal(
    getSimCourierPosition('dibatalkan', point(-6.2, 106.8), point(-6.3, 106.9)),
    null
  );
  assert.equal(isValidLatitude(Number.POSITIVE_INFINITY), false);
  assert.equal(isValidLatitude(Number.NEGATIVE_INFINITY), false);
  assert.equal(isValidLongitude(Number.NaN), false);
});

test('reset mengembalikan simulasi ke keadaan awal tanpa sisa riwayat', () => {
  const advanced = advanceShippingSimRecord(
    createShippingSimRecord('RB-RESET1', T0),
    T0
  )!;
  assert.equal(advanced.status, 'siap_diambil');
  const restarted = createShippingSimRecord('RB-RESET1', '2026-10-15T05:00:00.000Z');
  assert.equal(restarted.status, 'menunggu_penjual');
  assert.equal(restarted.history.length, 1);
  assert.equal(restarted.history[0].status, 'menunggu_penjual');
  assert.equal(getNextShippingSimAction(restarted.status)?.target, 'siap_diambil');
});

test('record dua pesanan terisolasi: kunci beda dan tidak bercampur', () => {
  const recordA = advanceShippingSimRecord(
    createShippingSimRecord('RB-ORDER-A', T0),
    T0
  )!;
  const recordB = createShippingSimRecord('RB-ORDER-B', T0);
  assert.equal(recordA.status, 'siap_diambil');
  assert.equal(recordB.status, 'menunggu_penjual');
  assert.deepEqual(
    recordA.history.map((entry) => entry.status),
    ['menunggu_penjual', 'siap_diambil']
  );
  assert.deepEqual(
    recordB.history.map((entry) => entry.status),
    ['menunggu_penjual']
  );
  assert.notEqual(shippingSimStorageKey('RB-ORDER-A'), shippingSimStorageKey('RB-ORDER-B'));
  // Raw record pesanan lain harus ditolak saat dimuat untuk order ini.
  assert.equal(parseShippingSimRecord(JSON.stringify(recordA), 'RB-ORDER-B'), null);
  assert.ok(parseShippingSimRecord(JSON.stringify(recordA), 'RB-ORDER-A'));
  // Record asal tidak ikut berubah oleh transisi independen.
  assert.deepEqual(
    recordB.history.map((entry) => entry.status),
    ['menunggu_penjual']
  );
});

test('parseShippingSimRecord menolak data rusak dan membersihkan override', () => {
  const valid = createShippingSimRecord('RB-PARSE1', T0);
  const roundTrip = parseShippingSimRecord(JSON.stringify(valid), 'RB-PARSE1');
  assert.deepEqual(roundTrip, valid);

  assert.equal(parseShippingSimRecord('{bukan json', 'RB-PARSE1'), null);
  assert.equal(
    parseShippingSimRecord(JSON.stringify({ ...valid, version: 2 }), 'RB-PARSE1'),
    null
  );
  assert.equal(
    parseShippingSimRecord(
      JSON.stringify({ ...valid, status: 'melayang' }),
      'RB-PARSE1'
    ),
    null
  );
  assert.equal(
    parseShippingSimRecord(JSON.stringify({ ...valid, history: 'x' }), 'RB-PARSE1'),
    null
  );
  assert.equal(
    parseShippingSimRecord(JSON.stringify({ ...valid, history: [] }), 'RB-PARSE1'),
    null
  );
  assert.equal(
    parseShippingSimRecord(
      JSON.stringify({ ...valid, courier: { name: '' } }),
      'RB-PARSE1'
    ),
    null
  );
  // Status tidak cocok dengan entri history terakhir = tidak konsisten.
  assert.equal(
    parseShippingSimRecord(
      JSON.stringify({ ...valid, status: 'selesai' }),
      'RB-PARSE1'
    ),
    null
  );

  const sanitized = parseShippingSimRecord(
    JSON.stringify({
      ...valid,
      originOverride: { latitude: 'bukan-angka', longitude: 106.8, source: 'manual' },
      destinationOverride: { latitude: -6.2, longitude: 106.8, source: 'alien' },
    }),
    'RB-PARSE1'
  );
  assert.ok(sanitized);
  assert.equal(sanitized?.originOverride, null);
  assert.equal(sanitized?.destinationOverride, null);

  const withPoint = parseShippingSimRecord(
    JSON.stringify({
      ...valid,
      originOverride: { latitude: -6.2, longitude: 106.8, source: 'manual' },
    }),
    'RB-PARSE1'
  );
  assert.deepEqual(withPoint?.originOverride, {
    latitude: -6.2,
    longitude: 106.8,
    source: 'manual',
  });
});

test('isValidSimGeoPoint menolak source tidak dikenal (tanpa mengarang lokasi)', () => {
  assert.equal(
    isValidSimGeoPoint({ latitude: -6.2, longitude: 106.8, source: 'manual' }),
    true
  );
  assert.equal(
    isValidSimGeoPoint({ latitude: -6.2, longitude: 106.8, source: 'device' }),
    true
  );
  assert.equal(
    isValidSimGeoPoint({ latitude: -6.2, longitude: 106.8, source: 'nope' }),
    false
  );
  assert.equal(isValidSimGeoPoint({ latitude: -6.2, longitude: 106.8 }), false);
  assert.equal(
    isValidSimGeoPoint({ latitude: 91, longitude: 106.8, source: 'manual' }),
    false
  );
});

test('mock provider: quote deterministik, lokal, dan berlabel simulasi', async () => {
  const request: ShippingQuoteRequest = {
    orderCode: 'RB-MOCK-1',
    origin: { latitude: -6.2, longitude: 106.8 },
    destination: { latitude: -6.25, longitude: 106.85 },
    quantity: 2,
  };
  const first = await mockShippingProvider.getQuote(request, T0);
  const second = await mockShippingProvider.getQuote(request, T0);
  assert.deepEqual(first, second);
  assert.equal(first.provider, MOCK_SHIPPING_PROVIDER_NAME);
  assert.equal(first.isSimulation, true);
  assert.equal(mockShippingProvider.networkAccess, 'none');
  assert.equal(first.referenceId, buildMockReferenceId('RB-MOCK-1'));
  assert.match(first.referenceId, /^SIMREF-\d{6}$/);
  assert.ok(first.options.length >= 2);
  for (let i = 0; i < first.options.length; i += 1) {
    const option = first.options[i];
    assert.ok(Number.isInteger(option.price) && option.price > 0);
    assert.match(option.courierName, /Simulasi/);
    assert.match(option.serviceName, /Simulasi/);
    // Jarak dan waktu adalah dua field terpisah. Sebelumnya keduanya berbagi
    // satu field `duration`, sehingga UI menempelkan jarak setelah kata
    // "Estimasi tiba" ("Estimasi tiba Estimasi 5 km").
    assert.ok(option.etaLabel.length > 0, 'label waktu wajib terisi');
    assert.match(option.etaLabel, /menit/);
    assert.ok(option.distanceLabel.length > 0, 'label jarak wajib terisi');
    assert.match(option.distanceLabel, /km/);
    if (i > 0) {
      assert.ok(option.price >= first.options[i - 1].price);
    }
  }
});

test('mock provider: input tidak valid ditolak dengan jelas', async () => {
  await assert.rejects(
    () =>
      mockShippingProvider.getQuote(
        {
          orderCode: 'RB-MOCK-2',
          origin: { latitude: 91, longitude: 106.8 },
          destination: { latitude: -6.25, longitude: 106.85 },
          quantity: 1,
        },
        T0
      ),
    /tidak valid/
  );
  await assert.rejects(
    () =>
      mockShippingProvider.getQuote(
        {
          orderCode: 'RB-MOCK-2',
          origin: { latitude: -6.2, longitude: 106.8 },
          destination: { latitude: -6.25, longitude: 106.85 },
          quantity: 0,
        },
        T0
      ),
    /quantity/
  );
  await assert.rejects(
    () =>
      mockShippingProvider.getQuote(
        {
          orderCode: '  ',
          origin: { latitude: -6.2, longitude: 106.8 },
          destination: { latitude: -6.25, longitude: 106.85 },
          quantity: 1,
        },
        T0
      ),
    /orderCode/
  );
});

test('mock provider: shipment dan tracking dummy konsisten serta dapat dibatalkan', async () => {
  const shipment = await mockShippingProvider.createShipment(
    {
      orderCode: 'RB-MOCK-3',
      courierCode: 'sim_instant',
      serviceCode: 'sim_instant_food',
    },
    T0
  );
  assert.equal(shipment.status, 'assigned');
  assert.equal(shipment.isSimulation, true);
  assert.match(shipment.label, /Simulasi/);
  assert.equal(shipment.referenceId, buildMockReferenceId('RB-MOCK-3'));

  const tracking = await mockShippingProvider.getTracking(shipment);
  assert.equal(tracking.status, 'assigned');
  assert.equal(tracking.entries.at(-1)?.status, 'assigned');
  assert.equal(tracking.isSimulation, true);

  const delivered = await mockShippingProvider.getTracking({
    ...shipment,
    status: 'delivered',
  });
  assert.equal(delivered.entries.at(-1)?.status, 'delivered');
  const statuses = delivered.entries.map((entry) => entry.status);
  assert.deepEqual(statuses, [
    'assigned',
    'picking_up',
    'picked',
    'in_transit',
    'delivered',
  ]);
  for (const entry of delivered.entries) {
    assert.ok(entry.note.length > 0);
    assert.ok(!Number.isNaN(Date.parse(entry.at)));
  }

  const cancelled = await mockShippingProvider.getTracking({
    ...shipment,
    status: 'cancelled',
  });
  assert.equal(cancelled.entries.at(-1)?.status, 'cancelled');

  await assert.rejects(
    () =>
      mockShippingProvider.createShipment(
        { orderCode: 'RB-MOCK-3', courierCode: 'sim_instant', serviceCode: 'tidak-ada' },
        T0
      ),
    /tidak dikenal/
  );
});

test('sumber simulasi & mock bebas jaringan dan bebas Supabase', () => {
  const files = [
    '../lib/shipping-simulation.ts',
    '../lib/device-location.ts',
    '../lib/shipping/provider.ts',
    '../lib/shipping/mock-provider.ts',
    '../app/components/order-history/shipping-simulation-panel.tsx',
  ];
  const forbidden = [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /\baxios\b/,
    /navigator\.sendBeacon/,
    /new\s+WebSocket/,
    /\bEventSource\b/,
    /https?:\/\//,
    /supabase\.(from|rpc|storage)/,
    /from\s+['"]@\/lib\/supabase['"]/,
    // Tanpa modul server (Biteship/shipment/Xendit) di jalur simulasi.
    /from\s+['"][^'"]*biteship[^'"]*['"]/i,
    /from\s+['"]@\/lib\/server\//,
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const pattern of forbidden) {
      assert.doesNotMatch(
        source,
        pattern,
        `${file} mengandung pola terlarang ${String(pattern)}`
      );
    }
  }
});

test('panel simulasi tidak menyentuh status pesanan resmi', () => {
  const source = readFileSync(
    new URL(
      '../app/components/order-history/shipping-simulation-panel.tsx',
      import.meta.url
    ),
    'utf8'
  );
  assert.doesNotMatch(source, /transitionOrderStatus/);
  assert.doesNotMatch(source, /order_state_machine|order-state-machine/);
  assert.doesNotMatch(source, /order_status|payment_status/);
  // Tidak ada pesanan/shipment nyata yang dibuat dari panel.
  assert.doesNotMatch(source, /saveOrder|patchOrder|createShipment/);
});

test('panel simulasi memakai jalur lokasi perangkat bersama + fallback manual', () => {
  const source = readFileSync(
    new URL(
      '../app/components/order-history/shipping-simulation-panel.tsx',
      import.meta.url
    ),
    'utf8'
  );
  // GPS harus lewat modul bersama yang diuji di tests/coordinate-capture.test.ts
  // (validasi rentang + pemetaan denied/unavailable), bukan API browser langsung.
  assert.match(source, /from\s+['"]@\/lib\/device-location['"]/);
  assert.match(source, /requestDeviceLocation\(\)/);
  assert.doesNotMatch(source, /navigator\.geolocation/);

  // Fallback input manual wajib tersedia untuk denied maupun unavailable.
  assert.match(source, /status === 'denied'/);
  assert.match(source, /status === 'unavailable'/);
  assert.match(source, /Simpan titik uji/);
  assert.match(source, /inputMode="decimal"/);

  // Hasil GPS yang telat tidak boleh menimpa state yang lebih baru.
  assert.match(source, /gpsRequestRef\.current !== requestId/);
  assert.match(source, /recordRef\.current/);
});
