import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Kontrol yang sering muncul di header tabel admin: kotak pencarian,
 * dropdown filter, chip status, bar filter, dan pagination.
 * Semuanya satu gaya supaya halaman berbeda tidak terlihat berbeda.
 *
 * Aturan lebar (penyebab bug yang pernah muncul, jangan diubah tanpa uji):
 * - Setiap filter punya label kecil DI ATAS kontrol, bukan `aria-label` saja,
 *   sehingga tujuan filter terbaca tanpa hover.
 * - Lebar dropdown dihitung dari opsi TERPANJANG (`ch`), bukan dipatok
 *   `w-48`. Sebelumnya lebar tetap membuat teks opsi seperti
 *   "Semua pengiriman kurier" terpotong di tengah kata.
 * - Kotak pencarian memakai basis 18rem pada layar >= sm dan TIDAK memakai
 *   `flex-1` polos (basis 0%). Sebelumnya `flex-1 min-w-0` membuatnya
 *   menyusut sampai tinggal ikon ketika banyak filter sebaris.
 */

const KONTROL =
  'h-10 w-full rounded-[var(--radius)] border border-border bg-white text-sm text-charcoal-900 transition-colors placeholder:text-sage-500 hover:border-sage-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

// Label kontrol: 12px bold dengan warna teks gelap agar terbaca jelas di
// atas kotak input (sebelumnya abu-abu `sage-500`).
const LABEL = 'text-xs font-bold uppercase tracking-[0.06em] text-charcoal-700';

/** Lebar dropdown berdasarkan teks terpanjang, dibatasi agar tidak melebar liar. */
function lebarKontrol(options: { label: string }[]): string {
  const terpanjang = options.reduce((maks, opsi) => Math.max(maks, opsi.label.length), 0);
  return `${Math.min(Math.max(terpanjang + 6, 11), 30)}ch`;
}

/** Inline style untuk lebar berbasis `ch` (dipakai lewat CSS variable di bawah). */
function widthVar(name: string, value: string): React.CSSProperties {
  return { [name]: value } as React.CSSProperties;
}

/**
 * PENTING: kelas lebar berbasis CSS variable harus ditulis sebagai string
 * literal lengkap di setiap komponen. Tailwind memindai source sebagai teks,
 * sehingga kelas yang dirangkai lewat interpolasi string TIDAK ikut
 * tergenerate dan filter akan melebar penuh satu baris sendiri.
 */

export function AdminSearchInput({
  value,
  onChange,
  placeholder = 'Cari…',
  label = 'Cari',
  className,
  labelVisible = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  /**
   * Tampilkan label di ATAS kontrol (pola yang sama dengan AdminSelect /
   * AdminDateInput). Default `false` agar halaman lain yang sudah memakai
   * pencarian tanpa label tidak berubah tata letaknya.
   */
  labelVisible?: boolean;
}) {
  // `flex-[1_1_18rem]` + `min-w-0`: pada toolbar flex pencarian punya basis
  // 18rem dan membungkus ke baris berikutnya saat filter penuh, sedangkan
  // `min-w-0` mencegah overflow ketika dipakai di dalam grid.
  const UKURAN = 'w-full min-w-0 sm:w-auto sm:flex-[1_1_18rem] sm:max-w-md';

  const field = (
    <div className="relative w-full min-w-0">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-500"
      />
      <input
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          KONTROL,
          'pl-9',
          value ? 'pr-9' : 'pr-3',
          '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden'
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={`Bersihkan ${label.toLowerCase()}`}
          // 36px: target sentuh lebih besar dari versi sebelumnya (28px).
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius)] text-sage-500 transition-colors hover:bg-sage-100/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  if (!labelVisible) {
    return <div className={cn(UKURAN, className)}>{field}</div>;
  }

  // <label> membungkus kontrol sehingga asosiasi label-input otomatis,
  // sama seperti AdminSelect dan AdminDateInput.
  return (
    <label className={cn('flex flex-col gap-1.5', UKURAN, className)}>
      <span className={LABEL}>{label}</span>
      {field}
    </label>
  );
}

export function AdminDateInput({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <label
      className={cn('flex w-full min-w-0 flex-col gap-1.5 sm:w-[var(--admin-date-w)]', className)}
      // 13ch: cukup untuk "dd/mm/yyyy" + ikon kalender bawaan. Dengan 12ch
      // ikon menimpa dua digit terakhir tanggal.
      style={widthVar('--admin-date-w', '13ch')}
    >
      <span className={LABEL}>{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(KONTROL, 'cursor-pointer px-2.5')}
      />
    </label>
  );
}

/**
 * Rentang tanggal sebagai SATU unit.
 *
 * Dua `AdminDateInput` terpisah di dalam toolbar flex akan membungkus
 * sendiri-sendiri: pada halaman Aktivitas (5 kontrol) "Sampai tanggal"
 * jatuh sendirian di baris bawah, terpisah dari "Dari tanggal" — padahal
 * keduanya satu konsep. Wrapper ini membuat keduanya selalu satu item flex,
 * sehingga bila tidak muat, keduanya turun bersama.
 *
 * Di dalam grid, beri `sm:col-span-2` lewat `className` agar tetap muat.
 */
export function AdminDateRange({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = 'Dari tanggal',
  toLabel = 'Sampai tanggal',
  className,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex w-full min-w-0 items-end gap-2 sm:w-auto', className)}>
      <AdminDateInput
        value={from}
        onChange={onFromChange}
        label={fromLabel}
        className="min-w-0 flex-1 sm:flex-none sm:w-[var(--admin-date-w)]"
      />
      <AdminDateInput
        value={to}
        onChange={onToChange}
        label={toLabel}
        className="min-w-0 flex-1 sm:flex-none sm:w-[var(--admin-date-w)]"
      />
    </div>
  );
}

export function AdminSelect({
  value,
  onChange,
  label,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <label
      className={cn('flex w-full min-w-0 flex-col gap-1.5 sm:w-[var(--admin-select-w)]', className)}
      style={widthVar('--admin-select-w', lebarKontrol(options))}
    >
      <span className={LABEL}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(KONTROL, 'cursor-pointer px-3 pr-8 font-medium')}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Baris alat di atas tabel: pencarian + filter, membungkus otomatis di layar kecil. */
export function AdminToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // gap horizontal lebih lebar daripada vertikal: pada satu baris,
        // label filter (huruf kapital) berdempet ke kotak pencarian bila
        // jaraknya sama dengan jarak antar-baris.
        'mb-4 flex flex-col gap-y-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4',
        className
      )}
    >
      {children}
    </div>
  );
}

export function AdminFilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        active
          ? 'border-primary bg-primary text-primary-foreground-strong'
          : 'border-border bg-white text-charcoal-700 hover:border-sage-500 hover:bg-sage-100/40'
      )}
    >
      {children}
    </button>
  );
}

export function AdminFilterChipGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}

/**
 * Pagination sama untuk semua tabel: ringkasan "Menampilkan x–y dari z
 * {noun}" plus indikator halaman dan tombol Sebelumnya/Berikutnya.
 */
export function AdminPagination({
  total,
  page,
  pageSize,
  noun,
  onPageChange,
  busy = false,
  className,
}: {
  total: number;
  page: number;
  pageSize: number;
  noun: string;
  onPageChange: (page: number) => void;
  busy?: boolean;
  /** Jarak vertikal dapat disesuaikan per halaman (default tetap `mt-5`). */
  className?: string;
}) {
  const totalHalaman = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const halaman = Math.min(Math.max(1, page), totalHalaman);
  const dari = total === 0 ? 0 : (halaman - 1) * pageSize + 1;
  const sampai = Math.min(halaman * pageSize, total);
  const adaSebelumnya = halaman > 1;
  const adaBerikutnya = halaman < totalHalaman;

  return (
    <nav
      aria-label="Navigasi halaman tabel"
      className={cn('mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row', className)}
    >
      <p className="text-xs text-sage-500">
        {total === 0
          ? `Tidak ada ${noun}`
          : `Menampilkan ${dari}–${sampai} dari ${total} ${noun} · Halaman ${halaman} dari ${totalHalaman}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!adaSebelumnya || busy}
          onClick={() => onPageChange(halaman - 1)}
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
          Sebelumnya
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!adaBerikutnya || busy}
          onClick={() => onPageChange(halaman + 1)}
        >
          Berikutnya
          <ChevronRight aria-hidden className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
