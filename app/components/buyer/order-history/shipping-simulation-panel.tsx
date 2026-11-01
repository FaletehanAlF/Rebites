'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Check,
  ChevronRight,
  CircleAlert,
  LocateFixed,
  MapPin,
  RotateCcw,
  Store,
  Truck,
  X,
} from 'lucide-react';
import type { StoredOrder } from '@/lib/types';
import { requestDeviceLocation } from '@/lib/device-location';
import {
  SHIPPING_SIM_STATUS_LABEL,
  SHIPPING_SIM_STATUS_ORDER,
  advanceShippingSimRecord,
  applyShippingSimTransition,
  buildSimRouteGeometry,
  createShippingSimRecord,
  distanceBetweenKm,
  getNextShippingSimAction,
  getSimCourierPosition,
  isValidLatitude,
  isValidLongitude,
  loadShippingSimRecord,
  parseCoordinate,
  removeShippingSimRecord,
  resolveShippingSimPoint,
  saveShippingSimRecord,
  setShippingSimModeEnabled,
  syncShippingSimModeFromSearch,
  type ShippingSimRecord,
  type ShippingSimStatus,
  type SimGeoPoint,
} from '@/lib/shipping-simulation';

const SOURCE_LABEL: Record<SimGeoPoint['source'], string> = {
  snapshot: 'koordinat dari data pesanan',
  device: 'lokasi GPS perangkat (titik uji)',
  manual: 'input manual penguji (titik uji)',
  simulated: 'titik simulasi',
};

type PickerTarget = 'origin' | 'destination';

interface GpsState {
  target: PickerTarget | null;
  status: 'idle' | 'requesting' | 'ok' | 'denied' | 'unavailable';
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Bagian tracking pengiriman SIMULASI di detail pesanan (delivery).
 *
 * - Hanya tampil saat mode simulasi aktif (`?shipping-sim=1` / build dev).
 * - State tersimpan lokal di browser (localStorage), bukan di Supabase.
 * - Tidak mengubah status pesanan, pembayaran, atau memanggil kurir sungguhan.
 */
export function ShippingSimulationSection({ order }: { order: StoredOrder }) {
  const searchParams = useSearchParams();
  const [modeEnabled, setModeEnabled] = useState(false);
  const [record, setRecord] = useState<ShippingSimRecord | null>(null);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsState>({ target: null, status: 'idle' });

  // Callback GPS asinkron bisa selesai setelah pengguna berpindah pesanan.
  // Ref ini memastikan hasilnya tidak pernah ditulis ke pesanan yang salah.
  const orderIdRef = useRef(order.orderId);
  // Generasi permintaan GPS: hasil yang telat (setelah reset/pindah pesanan/
  // titik manual disimpan/picker ditutup) tidak boleh menimpa state terbaru.
  const gpsRequestRef = useRef(0);
  // Record terbaru: callback GPS tidak boleh memakai salinan record yang basi
  // (mis. status sudah maju sebelum hasil GPS kembali).
  const recordRef = useRef<ShippingSimRecord | null>(null);

  useEffect(() => {
    const enabled = syncShippingSimModeFromSearch(
      `?${searchParams.toString()}`
    );
    setModeEnabled(enabled);
  }, [searchParams]);

  useEffect(() => {
    orderIdRef.current = order.orderId;
    gpsRequestRef.current += 1;
    const loaded = loadShippingSimRecord(order.orderId);
    recordRef.current = loaded;
    setRecord(loaded);
    setPickerTarget(null);
    setManualLat('');
    setManualLng('');
    setFormError(null);
    setGps({ target: null, status: 'idle' });
  }, [order.orderId]);

  // Panel ditutup saat GPS masih berjalan: hasil telat tidak boleh menulis
  // state apa pun (termasuk localStorage) setelah section tidak tampil.
  useEffect(
    () => () => {
      gpsRequestRef.current += 1;
    },
    []
  );

  // Titik uji: override penguji (manual/GPS) menang atas snapshot pesanan;
  // snapshot hanya dipakai bila pasangan angka valid (tanpa mengarang).
  const snapshotOrigin = resolveShippingSimPoint(
    null,
    order.shippingSnapshot?.origin?.latitude,
    order.shippingSnapshot?.origin?.longitude
  );
  const snapshotDestination = resolveShippingSimPoint(
    null,
    order.addressSnapshot?.latitude,
    order.addressSnapshot?.longitude
  );

  // Record hanya dianggap milik pesanan ini bila orderCode-nya cocok.
  // Mencegah satu render sempat menampilkan state simulasi pesanan lain.
  const activeRecord =
    record && record.orderCode === order.orderId ? record : null;

  const originPoint = resolveShippingSimPoint(
    activeRecord?.originOverride,
    order.shippingSnapshot?.origin?.latitude,
    order.shippingSnapshot?.origin?.longitude
  );
  const destinationPoint = resolveShippingSimPoint(
    activeRecord?.destinationOverride,
    order.addressSnapshot?.latitude,
    order.addressSnapshot?.longitude
  );
  const courierPoint =
    originPoint && destinationPoint
      ? getSimCourierPosition(
          activeRecord?.status ?? 'menunggu_penjual',
          originPoint,
          destinationPoint
        )
      : null;

  const persistRecord = useCallback((next: ShippingSimRecord | null) => {
    recordRef.current = next;
    if (next) saveShippingSimRecord(next);
    setRecord(next);
  }, []);

  const updateOverride = useCallback(
    (target: PickerTarget, point: SimGeoPoint) => {
      const current = recordRef.current;
      if (!current || current.orderCode !== order.orderId) return;
      // Titik baru (manual/GPS) membatalkan hasil GPS lain yang masih
      // terbang: yang terbaru menang, state lama tidak boleh dibangkitkan.
      gpsRequestRef.current += 1;
      const next: ShippingSimRecord = {
        ...current,
        originOverride:
          target === 'origin' ? point : current.originOverride,
        destinationOverride:
          target === 'destination' ? point : current.destinationOverride,
        updatedAt: new Date().toISOString(),
      };
      persistRecord(next);
      setPickerTarget(null);
      setManualLat('');
      setManualLng('');
      setFormError(null);
    },
    [persistRecord, order.orderId]
  );

  const handleStart = () => {
    persistRecord(createShippingSimRecord(order.orderId, new Date().toISOString()));
    setPickerTarget(
      snapshotOrigin && snapshotDestination
        ? null
        : snapshotOrigin
          ? 'destination'
          : 'origin'
    );
  };

  const handleAdvance = () => {
    if (!activeRecord) return;
    const next = advanceShippingSimRecord(
      activeRecord,
      new Date().toISOString()
    );
    if (next) persistRecord(next);
  };

  const handleCancel = () => {
    if (!activeRecord) return;
    const next = applyShippingSimTransition(
      activeRecord,
      'dibatalkan',
      new Date().toISOString(),
      'Dibatalkan oleh penguji (simulasi)'
    );
    if (next) persistRecord(next);
  };

  const handleReset = () => {
    gpsRequestRef.current += 1;
    removeShippingSimRecord(order.orderId);
    recordRef.current = null;
    setRecord(null);
    setPickerTarget(null);
    setManualLat('');
    setManualLng('');
    setFormError(null);
    setGps({ target: null, status: 'idle' });
  };

  const handleExitMode = () => {
    setShippingSimModeEnabled(false);
    setModeEnabled(false);
  };

  const handleSaveManual = (target: PickerTarget) => {
    const lat = parseCoordinate(manualLat);
    const lng = parseCoordinate(manualLng);
    if (lat === null || !isValidLatitude(lat)) {
      setFormError('Latitude harus angka antara -90 dan 90.');
      return;
    }
    if (lng === null || !isValidLongitude(lng)) {
      setFormError('Longitude harus angka antara -180 dan 180.');
      return;
    }
    updateOverride(target, { latitude: lat, longitude: lng, source: 'manual' });
  };

  const handleUseDevice = (target: PickerTarget) => {
    // Jalur lokasi bersama (lib/device-location) memvalidasi rentang koordinat
    // dan memetakan izin ditolak -> `denied`, error lain/perangkat tidak
    // mendukung -> `unavailable`; UI menyediakan fallback input manual.
    const requestId = gpsRequestRef.current + 1;
    gpsRequestRef.current = requestId;
    const requestOrderId = order.orderId;
    setGps({ target, status: 'requesting' });
    void requestDeviceLocation().then((result) => {
      if (
        gpsRequestRef.current !== requestId ||
        orderIdRef.current !== requestOrderId
      ) {
        return;
      }
      if (!result.ok) {
        setGps({ target, status: result.reason });
        return;
      }
      updateOverride(target, {
        latitude: result.latitude,
        longitude: result.longitude,
        source: 'device',
      });
      setGps({ target, status: 'ok' });
    });
  };

  if (order.fulfillment !== 'delivery') return null;
  if (!modeEnabled) return null;

  const nextAction = activeRecord
    ? getNextShippingSimAction(activeRecord.status)
    : null;
  const isTerminal =
    activeRecord?.status === 'selesai' || activeRecord?.status === 'dibatalkan';
  const historyMap = new Map<ShippingSimStatus, string>(
    (activeRecord?.history ?? []).map((entry) => [entry.status, entry.at])
  );
  // Tahap terjauh yang pernah dicapai (dari history) supaya progres tidak
  // hilang saat simulasi dibatalkan (status `dibatalkan` di luar urutan).
  const reachedIndex = activeRecord
    ? activeRecord.history.reduce((max, entry) => {
        const index = SHIPPING_SIM_STATUS_ORDER.indexOf(entry.status);
        return index > max ? index : max;
      }, -1)
    : -1;

  return (
    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50/70 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
            <Truck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-charcoal-900">
              Tracking Kurir
            </p>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
              Mode Simulasi
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExitMode}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
        >
          <X className="h-3 w-3" />
          Sembunyikan
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-charcoal-500">
        Fitur uji coba. Tidak ada kurir sungguhan yang dipesan, tidak ada
        perubahan status pesanan/pembayaran, dan tidak ada request ke Biteship.
        Data hanya tersimpan di browser ini.
      </p>

      {!activeRecord && (
        <div className="mt-3 space-y-2">
          <p className="rounded-lg bg-white px-3 py-2 text-[11px] text-charcoal-500 ring-1 ring-amber-200">
            Mulai simulasi untuk menjalankan tahapan pengiriman satu per satu:
            kesiapan penjual, penugasan kurir, penjemputan, perjalanan, tiba,
            lalu selesai.
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-amber-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-amber-700"
          >
            <Truck className="h-4 w-4" />
            Mulai Simulasi Pengiriman
          </button>
        </div>
      )}

      {activeRecord && (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-amber-200">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-900">
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
              {SHIPPING_SIM_STATUS_LABEL[activeRecord.status]}
            </div>
            <p className="mt-1 text-[11px] text-charcoal-500">
              Diperbarui {formatClock(activeRecord.updatedAt)} · kurir simulasi{' '}
              <span className="font-semibold text-charcoal-900">
                {activeRecord.courier.name}
              </span>{' '}
              ({activeRecord.courier.id}) · {activeRecord.courier.vehicle}
            </p>
            <p className="mt-0.5 text-[10px] italic text-amber-700">
              Identitas kurir ini fiktif untuk simulasi lokal, bukan data kurir
              nyata.
            </p>
          </div>

          {activeRecord.status === 'dibatalkan' && (
            <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
              <CircleAlert className="h-3.5 w-3.5" />
              Simulasi dibatalkan. Status pesanan asli tidak berubah.
            </p>
          )}

          <ol className="space-y-2">
            {SHIPPING_SIM_STATUS_ORDER.map((status, index) => {
              const done = reachedIndex >= 0 && index < reachedIndex;
              const current =
                index === reachedIndex && activeRecord.status !== 'dibatalkan';
              const at = historyMap.get(status);
              return (
                <li key={status} className="flex items-start gap-2.5">
                  <span
                    className={
                      done
                        ? 'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-white'
                        : current
                          ? 'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white'
                          : 'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-amber-200 bg-white'
                    }
                  >
                    {done && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
                    {current && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        current
                          ? 'block text-[12px] font-semibold text-charcoal-900'
                          : 'block text-[12px] text-charcoal-500'
                      }
                    >
                      {SHIPPING_SIM_STATUS_LABEL[status]}
                    </span>
                    {at && (
                      <span className="block text-[10px] text-charcoal-500">
                        {formatClock(at)}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
              Rute Simulasi (Sketsa)
            </p>
            {originPoint && destinationPoint ? (
              <>
                <SimulationMap
                  origin={originPoint}
                  destination={destinationPoint}
                  courier={courierPoint}
                />
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-charcoal-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-primary" /> Toko
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-caramel-dark" />{' '}
                    Tujuan
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Kurir
                    simulasi
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full border border-charcoal-500 bg-white" />{' '}
                    Awal kurir (simulasi)
                  </span>
                </div>
                <p className="mt-1 text-[10px] italic text-charcoal-500">
                  Sketsa rute dari koordinat yang tersedia (≈{' '}
                  {(
                    distanceBetweenKm(originPoint, destinationPoint) +
                    distanceBetweenKm(
                      buildSimRouteGeometry(originPoint, destinationPoint).depot,
                      originPoint
                    )
                  ).toLocaleString('id-ID', { maximumFractionDigits: 1 })}{' '}
                  km garis lurus). Bukan peta jalan sebenarnya, bukan GPS
                  langsung, tanpa ETA.
                </p>
              </>
            ) : (
              <p className="mt-1 rounded-lg bg-white px-3 py-2 text-[11px] text-charcoal-500 ring-1 ring-amber-200">
                Koordinat belum tersedia untuk order ini, jadi peta tidak
                ditampilkan. Isi titik uji di bawah (tidak dikirim ke server).
              </p>
            )}

            <div className="mt-1.5 space-y-1 text-[10px] text-charcoal-500">
              <p className="flex items-center gap-1">
                <Store className="h-3 w-3 text-primary" />
                Titik toko:{' '}
                {originPoint
                  ? `${originPoint.latitude.toFixed(5)}, ${originPoint.longitude.toFixed(5)} (${SOURCE_LABEL[originPoint.source]})`
                  : 'belum tersedia'}
              </p>
              <p className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-caramel-dark" />
                Titik tujuan:{' '}
                {destinationPoint
                  ? `${destinationPoint.latitude.toFixed(5)}, ${destinationPoint.longitude.toFixed(5)} (${SOURCE_LABEL[destinationPoint.source]})`
                  : 'belum tersedia'}
              </p>
            </div>

            {pickerTarget === null ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPickerTarget('origin');
                    setFormError(null);
                    setGps({ target: null, status: 'idle' });
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                >
                  <Store className="h-3.5 w-3.5" />
                  Atur titik toko
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPickerTarget('destination');
                    setFormError(null);
                    setGps({ target: null, status: 'idle' });
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Atur titik tujuan
                </button>
              </div>
            ) : (
              <PointPicker
                target={pickerTarget}
                gps={gps}
                manualLat={manualLat}
                manualLng={manualLng}
                formError={formError}
                onManualLatChange={setManualLat}
                onManualLngChange={setManualLng}
                onSaveManual={() => handleSaveManual(pickerTarget)}
                onUseDevice={() => handleUseDevice(pickerTarget)}
                onClose={() => {
                  gpsRequestRef.current += 1;
                  setPickerTarget(null);
                  setFormError(null);
                  setGps({ target: null, status: 'idle' });
                }}
              />
            )}
          </div>

          <div className="border-t border-amber-200 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
              Kontrol Simulasi (Manual)
            </p>
            <p className="mt-1 text-[10px] text-charcoal-500">
              Setiap tahap dijalankan eksplisit oleh penguji. Tidak ada timer
              otomatis dan tidak ada transisi yang dilompati.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {nextAction && (
                <button
                  type="button"
                  onClick={handleAdvance}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-amber-600 px-4 text-[12px] font-semibold text-white transition-colors hover:bg-amber-700"
                >
                  {nextAction.label}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
              {!isTerminal && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-300 bg-white px-3 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-50"
                >
                  Batalkan
                </button>
              )}
              {isTerminal && (
                <span className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-semibold text-charcoal-500 ring-1 ring-amber-200">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  {activeRecord.status === 'selesai'
                    ? 'Simulasi selesai'
                    : 'Simulasi dibatalkan'}
                </span>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 text-[12px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PointPicker({
  target,
  gps,
  manualLat,
  manualLng,
  formError,
  onManualLatChange,
  onManualLngChange,
  onSaveManual,
  onUseDevice,
  onClose,
}: {
  target: PickerTarget;
  gps: GpsState;
  manualLat: string;
  manualLng: string;
  formError: string | null;
  onManualLatChange: (value: string) => void;
  onManualLngChange: (value: string) => void;
  onSaveManual: () => void;
  onUseDevice: () => void;
  onClose: () => void;
}) {
  const label = target === 'origin' ? 'titik toko' : 'titik tujuan';
  const requesting = gps.target === target && gps.status === 'requesting';

  return (
    <div className="mt-2 rounded-lg bg-white p-3 ring-1 ring-amber-200">
      <p className="text-[12px] font-semibold text-charcoal-900">
        Atur {label} (khusus simulasi)
      </p>
      <p className="mt-0.5 text-[10px] text-charcoal-500">
        Titik ini hanya dipakai untuk simulasi di browser ini. Tidak dikirim
        ke server dan tidak mengubah alamat atau data pesanan.
      </p>

      <button
        type="button"
        onClick={onUseDevice}
        disabled={requesting}
        className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-primary px-3 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LocateFixed className="h-3.5 w-3.5" />
        {requesting
          ? 'Meminta izin lokasi…'
          : 'Gunakan lokasi perangkat (GPS)'}
      </button>

      {gps.target === target && gps.status === 'denied' && (
        <p className="mt-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-[10px] text-red-700 ring-1 ring-red-200">
          Izin lokasi ditolak browser. Aktifkan izin lokasi untuk situs ini,
          atau isi koordinat manual di bawah.
        </p>
      )}
      {gps.target === target && gps.status === 'unavailable' && (
        <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-700 ring-1 ring-amber-200">
          Lokasi perangkat tidak tersedia saat ini. Isi koordinat manual
          sebagai gantinya.
        </p>
      )}

      <p className="mt-2.5 text-center text-[10px] uppercase tracking-[0.14em] text-charcoal-500">
        atau isi manual
      </p>

      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-semibold text-charcoal-500">
            Latitude
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={manualLat}
            onChange={(event) => onManualLatChange(event.target.value)}
            placeholder="-6.20000"
            className="mt-0.5 h-9 w-full rounded-lg border border-hairline bg-cream-50 px-2.5 text-[12px] tabular-nums text-charcoal-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold text-charcoal-500">
            Longitude
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={manualLng}
            onChange={(event) => onManualLngChange(event.target.value)}
            placeholder="106.81667"
            className="mt-0.5 h-9 w-full rounded-lg border border-hairline bg-cream-50 px-2.5 text-[12px] tabular-nums text-charcoal-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>

      {formError && (
        <p className="mt-1.5 text-[10px] font-semibold text-red-600">
          {formError}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onSaveManual}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-primary px-3 text-[12px] font-semibold text-white transition-colors hover:bg-caramel"
        >
          Simpan titik uji
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center justify-center rounded-full border border-hairline px-3 text-[12px] font-semibold text-charcoal-500 transition-colors hover:bg-cream-100"
        >
          Batal
        </button>
      </div>
    </div>
  );
}

function buildProjection(
  points: SimGeoPoint[],
  width: number,
  height: number
): (point: SimGeoPoint) => { x: number; y: number } {
  const latAvg =
    points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const kx = Math.cos((latAvg * Math.PI) / 180) || 1;
  const xs = points.map((point) => point.longitude * kx);
  const ys = points.map((point) => point.latitude);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (maxX - minX < 1e-6) {
    minX -= 0.001;
    maxX += 0.001;
  }
  if (maxY - minY < 1e-6) {
    minY -= 0.001;
    maxY += 0.001;
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const pad = 26;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2 - minX * scale;
  const offsetY = (height - spanY * scale) / 2 + maxY * scale;
  return (point: SimGeoPoint) => ({
    x: point.longitude * kx * scale + offsetX,
    y: offsetY - point.latitude * scale,
  });
}

function SimulationMap({
  origin,
  destination,
  courier,
}: {
  origin: SimGeoPoint;
  destination: SimGeoPoint;
  courier: SimGeoPoint | null;
}) {
  const rawId = useId();
  const gridId = `sim-grid-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const geometry = buildSimRouteGeometry(origin, destination);
  const points = [
    geometry.depot,
    origin,
    destination,
    ...(courier ? [courier] : []),
  ];
  const project = buildProjection(points, 320, 190);
  const depot = project(geometry.depot);
  const originXY = project(origin);
  const destinationXY = project(destination);
  const courierXY = courier ? project(courier) : null;

  return (
    <svg
      viewBox="0 0 320 190"
      role="img"
      aria-label="Sketsa rute pengiriman simulasi"
      className="mt-1.5 w-full rounded-lg ring-1 ring-amber-200"
    >
      <defs>
        <pattern
          id={gridId}
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            className="stroke-hairline"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="320" height="190" className="fill-cream-50" />
      <rect width="320" height="190" fill={`url(#${gridId})`} />

      <polyline
        points={`${depot.x},${depot.y} ${originXY.x},${originXY.y} ${destinationXY.x},${destinationXY.y}`}
        fill="none"
        className="stroke-amber-500"
        strokeWidth="2"
        strokeDasharray="6 5"
        strokeLinecap="round"
      />

      <circle
        cx={depot.x}
        cy={depot.y}
        r="4"
        className="fill-white stroke-charcoal-500"
        strokeWidth="1.5"
      />
      <text
        x={depot.x}
        y={depot.y - 8}
        textAnchor="middle"
        className="fill-charcoal-500 text-[9px]"
      >
        awal kurir*
      </text>

      <circle
        cx={originXY.x}
        cy={originXY.y}
        r="6"
        className="fill-primary stroke-white"
        strokeWidth="2"
      />
      <text
        x={originXY.x}
        y={originXY.y + 16}
        textAnchor="middle"
        className="fill-charcoal-900 text-[9px] font-semibold"
      >
        Toko
      </text>

      <circle
        cx={destinationXY.x}
        cy={destinationXY.y}
        r="6"
        className="fill-caramel-dark stroke-white"
        strokeWidth="2"
      />
      <text
        x={destinationXY.x}
        y={destinationXY.y + 16}
        textAnchor="middle"
        className="fill-charcoal-900 text-[9px] font-semibold"
      >
        Tujuan
      </text>

      {courierXY && (
        <>
          <circle
            cx={courierXY.x}
            cy={courierXY.y}
            r="9"
            className="fill-amber-500/25"
          />
          <circle
            cx={courierXY.x}
            cy={courierXY.y}
            r="5"
            className="fill-amber-500 stroke-white"
            strokeWidth="1.5"
          />
          <text
            x={courierXY.x}
            y={courierXY.y - 12}
            textAnchor="middle"
            className="fill-amber-700 text-[9px] font-semibold"
          >
            kurir simulasi
          </text>
        </>
      )}

      <text
        x="8"
        y="184"
        className="fill-amber-700 text-[8px] font-semibold uppercase"
      >
        *Peta simulasi — bukan peta asli
      </text>
    </svg>
  );
}
