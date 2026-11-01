'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const inputCls =
  'w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

interface NumberFieldProps {
  /** Nilai dari parent (number) - sinkronisasi dua arah. */
  value: number | undefined;
  /** Dipanggil saat nilai angka berubah (untuk submit / stepper). */
  onChange: (value: number) => void;
  /** Placeholder / label aksesibilitas. */
  label?: string;
  /** Minimum (default 0). */
  min?: number;
  /** Step untuk tombol −/+ (default 1). */
  step?: number;
  /** Label satuan di sebelah kanan (mis. "porsi"). */
  unitLabel?: string;
  /** ID untuk asosiasi label. */
  id?: string;
}

export function NumberField({
  value,
  onChange,
  label,
  min = 0,
  step = 1,
  unitLabel,
  id,
}: NumberFieldProps) {
  // Internal state menyimpan string mentah agar user bisa menghapus sampai kosong
  const [raw, setRaw] = useState(() =>
    value !== undefined && value !== null ? String(value) : ''
  );

  // Sinkronkan raw dengan props.value saat berubah dari luar (mis. stepper stok)
  useEffect(() => {
    if (value !== undefined && value !== null) {
      setRaw(String(value));
    } else {
      setRaw('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextRaw = e.target.value;
    // Hanya izinkan digit (dan satu titik desimal jika step < 1)
    const cleaned = nextRaw.replace(/[^0-9.]/g, '');
    // Batasi titik desimal ke 1
    const parts = cleaned.split('.');
    const sanitized =
      parts.length <= 2
        ? cleaned
        : parts[0] + '.' + parts.slice(1).join('');
    setRaw(sanitized);

    const parsed = sanitized === '' ? null : Number(sanitized);
    if (parsed !== null && !Number.isNaN(parsed) && parsed >= min) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    // Saat blur, jika kosong → set ke min (atau 0)
    if (raw === '') {
      onChange(min);
      setRaw(String(min));
    }
  };

  const decrement = () => {
    const current = Number(raw) || min;
    const next = Math.max(min, current - step);
    setRaw(String(next));
    onChange(next);
  };

  const increment = () => {
    const current = Number(raw) || min;
    const next = current + step;
    setRaw(String(next));
    onChange(next);
  };

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Kurangi ${label ?? 'nilai'}`}
          onClick={decrement}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-foreground transition-colors hover:bg-muted"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1={5} y1={12} x2={19} y2={12} />
          </svg>
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={raw}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn(inputCls, 'flex-1 text-center')}
          placeholder={label}
        />
        <button
          type="button"
          aria-label={`Tambah ${label ?? 'nilai'}`}
          onClick={increment}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-foreground transition-colors hover:bg-muted"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1={12} y1={5} x2={12} y2={19} />
            <line x1={5} y1={12} x2={19} y2={12} />
          </svg>
        </button>
        {unitLabel && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">{unitLabel}</span>
        )}
      </div>
    </div>
  );
}