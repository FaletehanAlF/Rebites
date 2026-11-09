'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, LocateFixed } from 'lucide-react';
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import type { AddressLabel, DeliveryAddress } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { AddressFormValues } from '@/hooks/buyer/use-addresses';
import { parseCoordinatePairInput } from '@/lib/location-validation';
import { resolveFormCoordinates } from '@/lib/delivery-map-plan';
import {
  requestDeviceLocation,
  type DeviceLocationReason,
} from '@/lib/device-location';
import { useCheckout } from './checkout-context';

// Peta dimuat hanya saat form alamat terbuka (MapLibre berat).
const LocationPickerMap = dynamic(
  () => import('@/app/components/shared/location-picker-map'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[220px] animate-pulse rounded-xl border border-hairline bg-cream-100 sm:h-[260px]" />
    ),
  }
);

const LABELS: AddressLabel[] = ['Rumah', 'Kos', 'Sekolah', 'Lainnya'];

const DEFAULT_PROVINCE = 'Jawa Barat';
const DEFAULT_CITY = 'Kota Depok';
const DEPOK_DISTRICTS = [
  'Beji',
  'Bojongsari',
  'Cilodong',
  'Cimanggis',
  'Cinere',
  'Depok',
  'Limo',
  'Pancoran Mas',
  'Sawangan',
  'Sukmajaya',
  'Tapos',
];

const INPUT_CLASS =
  'w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

// Tampilkan koordinat tersimpan sebagai teks input; kosong = belum ada.
function coordinateToInput(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

type GpsStatus = 'idle' | 'requesting' | 'ok' | DeviceLocationReason;

function toFormValues(editing: DeliveryAddress | null): AddressFormValues {
  if (!editing) {
    return {
      label: 'Rumah',
      receiverName: '',
      phone: '',
      province: DEFAULT_PROVINCE,
      city: DEFAULT_CITY,
      district: '',
      fullAddress: '',
      note: '',
      // kode pos opsional; koordinat opsional (diisi blok GPS/manual).
      postalCode: null,
      latitude: null,
      longitude: null,
    };
  }

  return {
    label: editing.label,
    receiverName: editing.receiverName,
    phone: editing.phone,
    province: editing.province || DEFAULT_PROVINCE,
    city: editing.city || DEFAULT_CITY,
    district: editing.district,
    fullAddress: editing.fullAddress,
    note: editing.note,
    postalCode: editing.postalCode ?? null,
    latitude: editing.latitude ?? null,
    longitude: editing.longitude ?? null,
  };
}

export function AddressFormView({
  editing,
  onDone,
}: {
  editing: DeliveryAddress | null;
  onDone: () => void;
}) {
  const { addAddress, updateAddress } = useCheckout();
  const [form, setForm] = useState<AddressFormValues>(() =>
    toFormValues(editing),
  );
  const [error, setError] = useState<string | null>(null);
  // input koordinat (GPS / manual). Baru dipakai saat simpan.
  const [latInput, setLatInput] = useState(() => coordinateToInput(editing?.latitude));
  const [lngInput, setLngInput] = useState(() => coordinateToInput(editing?.longitude));
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');

  // Nilai peta hanya untuk tampilan marker: difilter lewat helper yang sama
  // dengan peta Tahap A, sehingga titik tidak sah tidak pernah menjadi marker.
  const pickerPoint = resolveFormCoordinates(latInput, lngInput, parseCoordinatePairInput);
  const pickerLat = pickerPoint?.latitude ?? null;
  const pickerLng = pickerPoint?.longitude ?? null;

  const handleUseDeviceLocation = async () => {
    setGpsStatus('requesting');
    const result = await requestDeviceLocation();
    if (!result.ok) {
      // Ditolak/tidak tersedia: pengguna tetap bisa isi manual di bawah.
      setGpsStatus(result.reason);
      return;
    }
    setLatInput(result.latitude.toFixed(6));
    setLngInput(result.longitude.toFixed(6));
    setGpsStatus('ok');
  };

  const setField = <K extends keyof AddressFormValues>(
    key: K,
    value: AddressFormValues[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    if (!form.receiverName.trim()) return setError('Nama penerima wajib diisi.');
    if (!/^[0-9+\-\s]{9,16}$/.test(form.phone.trim()))
      return setError('Nomor telepon tidak valid (9–16 digit).');
    if (!form.district.trim()) return setError('Kecamatan wajib dipilih.');
    // kode pos opsional; string kosong = NULL (bukan valid).
    // Jika diisi harus 5 digit Indonesia.
    const postalTrimmed = (form.postalCode ?? '').trim();
    if (postalTrimmed !== '' && !/^[0-9]{5}$/.test(postalTrimmed))
      return setError('Kode pos harus 5 digit angka (cth. 16424).');
    // koordinat opsional — dua-duanya atau tidak sama sekali; tidak
    // pernah menyimpan setengah pasangan atau nilai karangan.
    const coordinatePair = parseCoordinatePairInput(latInput, lngInput);
    if (!coordinatePair.ok) return setError(coordinatePair.error);
    if (form.fullAddress.trim().length < 8)
      return setError('Alamat lengkap minimal 8 karakter.');

    const values: AddressFormValues = {
      ...form,
      receiverName: form.receiverName.trim(),
      fullAddress: form.fullAddress.trim(),
      note: form.note?.trim() || undefined,
      postalCode: postalTrimmed === '' ? null : postalTrimmed,
      latitude: coordinatePair.latitude,
      longitude: coordinatePair.longitude,
    };

    if (editing) {
      updateAddress(editing.id, values);
    } else {
      addAddress(values);
    }
    onDone();
  };

  return (
    <>
      <DialogHeader className="pr-10 text-left">
        <DialogTitle className="font-display text-xl font-semibold text-foreground">
          {editing ? 'Ubah Alamat' : 'Tambah Alamat Baru'}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Alamat aktif akan dipakai untuk pengantaran pesanan ini.
        </DialogDescription>
      </DialogHeader>

      { }
      <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
        { }
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Label Alamat
          </legend>
          <div className="flex flex-wrap gap-2">
            {LABELS.map((label) => (
              <button
                key={label}
                type="button"
                aria-pressed={form.label === label}
                onClick={() => setField('label', label)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
                  form.label === label
                    ? 'bg-primary text-white'
                    : 'border border-border bg-white text-muted-foreground hover:border-primary/30 hover:text-primary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nama Penerima
            </span>
            <input
              value={form.receiverName}
              onChange={(e) => setField('receiverName', e.target.value)}
              placeholder="cth. Arga"
              aria-label="Nama penerima"
              autoComplete="name"
              className={INPUT_CLASS}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nomor Telepon
            </span>
            <input
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="08xxxxxxxxxx"
              inputMode="tel"
              autoComplete="tel"
              aria-label="Nomor telepon"
              className={INPUT_CLASS}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kecamatan{' '}
            <span className="normal-case text-muted-foreground">
              (wilayah Kota Depok)
            </span>
          </span>
          <span className="relative block">
            <select
              value={form.district}
              onChange={(e) => setField('district', e.target.value)}
              aria-label="Kecamatan di Kota Depok"
              className={cn(
                INPUT_CLASS,
                'appearance-none pr-10',
                !form.district && 'text-muted-foreground',
              )}
            >
              <option value="" disabled>
                Pilih kecamatan
              </option>
              {DEPOK_DISTRICTS.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-500">
            Kode Pos{' '}
            <span className="normal-case text-sage-500">(opsional, 5 digit)</span>
          </span>
          <input
            value={form.postalCode ?? ''}
            onChange={(e) => setField('postalCode', e.target.value)}
            placeholder="cth. 16424"
            inputMode="numeric"
            maxLength={5}
            autoComplete="postal-code"
            aria-label="Kode pos"
            className={INPUT_CLASS}
          />
        </label>

        <div className="rounded-xl border border-sage-100 bg-cream-50/70 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-charcoal-500">
              Koordinat Lokasi{' '}
              <span className="normal-case text-sage-500">(opsional)</span>
            </span>
            <button
              type="button"
              onClick={() => void handleUseDeviceLocation()}
              disabled={gpsStatus === 'requesting'}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LocateFixed className="h-3.5 w-3.5" />
              {gpsStatus === 'requesting' ? 'Meminta izin…' : 'Gunakan lokasi saat ini'}
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-charcoal-500">
            Dipakai untuk simulasi pengiriman dan akurasi ongkir. Kosongkan jika
            belum diketahui — jangan asal isi.
          </p>
          {gpsStatus === 'denied' && (
            <p className="mt-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 ring-1 ring-red-200">
              Izin lokasi ditolak browser. Isi koordinat manual di bawah.
            </p>
          )}
          {gpsStatus === 'unavailable' && (
            <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 ring-1 ring-amber-200">
              Lokasi perangkat tidak tersedia saat ini. Isi koordinat manual di
              bawah.
            </p>
          )}
          {gpsStatus === 'ok' && (
            <p className="mt-1.5 rounded-md bg-primary/5 px-2.5 py-1.5 text-[11px] text-primary ring-1 ring-primary/20">
              Koordinat terisi dari perangkat. Periksa lalu simpan.
            </p>
          )}
          <div className="mt-2">
            <LocationPickerMap
              latitude={pickerLat}
              longitude={pickerLng}
              initialLatitude={editing?.latitude ?? null}
              initialLongitude={editing?.longitude ?? null}
              onPick={(lat, lng) => {
                setLatInput(lat.toFixed(6));
                setLngInput(lng.toFixed(6));
                setGpsStatus('idle');
              }}
            />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-500">
                Latitude
              </span>
              <input
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                placeholder="cth. -6.20000"
                inputMode="decimal"
                aria-label="Latitude lokasi"
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-500">
                Longitude
              </span>
              <input
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                placeholder="cth. 106.81667"
                inputMode="decimal"
                aria-label="Longitude lokasi"
                className={INPUT_CLASS}
              />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-500">
            Alamat Lengkap
          </span>
          <textarea
            value={form.fullAddress}
            onChange={(e) => setField('fullAddress', e.target.value)}
            placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan"
            rows={3}
            autoComplete="street-address"
            aria-label="Alamat lengkap"
            className={cn(INPUT_CLASS, 'resize-none')}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Catatan untuk Kurir{' '}
            <span className="normal-case text-muted-foreground">(opsional)</span>
          </span>
          <input
            value={form.note ?? ''}
            onChange={(e) => setField('note', e.target.value)}
            placeholder="cth. Titip di pos ronda jika tidak ada di rumah"
            aria-label="Catatan untuk kurir"
            className={INPUT_CLASS}
          />
        </label>
      </div>

      { }
      <div className="mt-3 shrink-0 border-t border-border pt-3">
        {error && (
          <p role="alert" className="mb-2.5 text-xs font-medium text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-full border border-border px-5 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            {editing ? 'Simpan Perubahan' : 'Simpan Alamat'}
          </button>
        </div>
      </div>
    </>
  );
}
