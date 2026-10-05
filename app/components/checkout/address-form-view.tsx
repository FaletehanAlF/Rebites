'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import type { AddressLabel, DeliveryAddress } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { AddressFormValues } from '@/hooks/use-addresses';
import { useCheckout } from './checkout-context';

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
  'w-full rounded-xl border border-sage-100 bg-white px-3.5 py-2.5 text-sm text-charcoal-900 placeholder:text-sage-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

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
      // 7B-1: kode pos opsional; lat/lng selalu NULL (tanpa map-picker).
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

  const setField = <K extends keyof AddressFormValues>(
    key: K,
    value: AddressFormValues[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    if (!form.receiverName.trim()) return setError('Nama penerima wajib diisi.');
    if (!/^[0-9+\-\s]{9,16}$/.test(form.phone.trim()))
      return setError('Nomor telepon tidak valid (9â€“16 digit).');
    if (!form.district.trim()) return setError('Kecamatan wajib dipilih.');
    // 7B-1: kode pos opsional; string kosong = NULL (bukan valid).
    // Jika diisi harus 5 digit Indonesia.
    const postalTrimmed = (form.postalCode ?? '').trim();
    if (postalTrimmed !== '' && !/^[0-9]{5}$/.test(postalTrimmed))
      return setError('Kode pos harus 5 digit angka (cth. 16424).');
    if (form.fullAddress.trim().length < 8)
      return setError('Alamat lengkap minimal 8 karakter.');

    const values: AddressFormValues = {
      ...form,
      receiverName: form.receiverName.trim(),
      fullAddress: form.fullAddress.trim(),
      note: form.note?.trim() || undefined,
      postalCode: postalTrimmed === '' ? null : postalTrimmed,
      // 7B-1: tanpa map-picker/geocoding -> selalu NULL, jangan karang koordinat.
      latitude: null,
      longitude: null,
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
        <DialogTitle className="font-display text-xl font-semibold text-charcoal-900">
          {editing ? 'Ubah Alamat' : 'Tambah Alamat Baru'}
        </DialogTitle>
        <DialogDescription className="text-sm text-charcoal-500">
          Alamat aktif akan dipakai untuk pengantaran pesanan ini.
        </DialogDescription>
      </DialogHeader>

      { }
      <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
        { }
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-charcoal-500">
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
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'border border-sage-100 bg-white text-charcoal-500 hover:border-sage-500/60 hover:text-caramel',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-500">
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
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-500">
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
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-500">
            Kecamatan{' '}
            <span className="normal-case text-sage-500">
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
                !form.district && 'text-sage-500',
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
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-500" />
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
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-charcoal-500">
            Catatan untuk Kurir{' '}
            <span className="normal-case text-sage-500">(opsional)</span>
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
      <div className="mt-3 shrink-0 border-t border-sage-100 pt-3">
        {error && (
          <p role="alert" className="mb-2.5 text-xs font-medium text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-full border border-sage-100 px-5 py-3 text-sm font-semibold text-charcoal-500 transition-colors hover:bg-cream-100"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-caramel"
          >
            {editing ? 'Simpan Perubahan' : 'Simpan Alamat'}
          </button>
        </div>
      </div>
    </>
  );
}
