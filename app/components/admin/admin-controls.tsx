import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
const KONTROL = 'h-10 w-full rounded-[var(--radius)] border border-border bg-white text-sm text-charcoal-900 transition-colors placeholder:text-sage-500 hover:border-sage-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';
const LABEL = 'sr-only';
function lebarKontrol(options: {
    label: string;
}[]): string {
    const terpanjang = options.reduce((maks, opsi) => Math.max(maks, opsi.label.length), 0);
    const lebar = Math.ceil(terpanjang * 0.95) + 6;
    return `${Math.min(Math.max(lebar, 14), 26)}ch`;
}
function widthVar(name: string, value: string): React.CSSProperties {
    return { [name]: value } as React.CSSProperties;
}
export function AdminSearchInput({ value, onChange, placeholder = 'Cari…', label = 'Cari', className, labelVisible = false, }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    className?: string;
    labelVisible?: boolean;
}) {
    const UKURAN = 'w-full min-w-0 flex-1 sm:min-w-[160px]';
    const field = (<div className="relative w-full min-w-0">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-500"/>
      <input type="search" value={value} aria-label={label} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={cn(KONTROL, 'pl-9', value ? 'pr-9' : 'pr-3', '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden')}/>
      {value && (<button type="button" onClick={() => onChange('')} aria-label={`Bersihkan ${label.toLowerCase()}`} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius)] text-sage-500 transition-colors hover:bg-sage-100/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <X aria-hidden className="h-3.5 w-3.5"/>
        </button>)}
    </div>);
    if (!labelVisible) {
        return <div className={cn(UKURAN, className)}>{field}</div>;
    }
    return (<label title={label} className={cn('flex min-w-0 items-end', UKURAN, className)}>
      <span className={LABEL}>{label}</span>
      <span className="flex min-w-0 flex-1">{field}</span>
    </label>);
}
export function AdminDateInput({ value, onChange, label, className, }: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    className?: string;
}) {
    return (<label title={label} className={cn('flex w-full min-w-0 items-end text-sm sm:min-w-[148px] sm:flex-1', className)} style={widthVar('--admin-date-w', '13ch')}>
      <span className={LABEL}>{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className={cn(KONTROL, 'cursor-pointer px-2.5', 'w-full min-w-0 flex-1')}/>
    </label>);
}
export function AdminDateRange({ from, to, onFromChange, onToChange, fromLabel = 'Dari tanggal', toLabel = 'Sampai tanggal', className, }: {
    from: string;
    to: string;
    onFromChange: (value: string) => void;
    onToChange: (value: string) => void;
    fromLabel?: string;
    toLabel?: string;
    className?: string;
}) {
    return (<div className={cn('flex w-full min-w-0 flex-1 items-end gap-2 sm:min-w-[280px]', className)}>
      <AdminDateInput value={from} onChange={onFromChange} label={fromLabel} className="min-w-0 flex-1"/>
      <AdminDateInput value={to} onChange={onToChange} label={toLabel} className="min-w-0 flex-1"/>
    </div>);
}
export function AdminSelect({ value, onChange, label, options, className, }: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    options: {
        value: string;
        label: string;
    }[];
    className?: string;
}) {
    return (<label title={label} className={cn('flex w-full min-w-0 items-end text-sm sm:min-w-[120px] sm:flex-1', className)} style={widthVar('--admin-select-w', lebarKontrol(options))}>
      <span className={LABEL}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={cn(KONTROL, 'w-full min-w-0 flex-1 cursor-pointer px-3 pr-8 font-medium')}>
        {options.map((option) => (<option key={option.value} value={option.value}>
            {option.label}
          </option>))}
      </select>
    </label>);
}
export function AdminToolbar({ children, className, }: {
    children: ReactNode;
    className?: string;
}) {
    return (<div className={cn('mb-4 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4', className)}>
      {children}
    </div>);
}
export function AdminFilterChip({ active, onClick, children, }: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (<button type="button" onClick={onClick} aria-pressed={active} className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', active
            ? 'border-primary bg-primary text-primary-foreground-strong'
            : 'border-border bg-white text-charcoal-700 hover:border-sage-500 hover:bg-sage-100/40')}>
      {children}
    </button>);
}
export function AdminFilterChipGroup({ children }: {
    children: ReactNode;
}) {
    return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}
export function AdminPagination({ total, page, pageSize, noun, onPageChange, busy = false, className, }: {
    total: number;
    page: number;
    pageSize: number;
    noun: string;
    onPageChange: (page: number) => void;
    busy?: boolean;
    className?: string;
}) {
    const totalHalaman = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
    const halaman = Math.min(Math.max(1, page), totalHalaman);
    const dari = total === 0 ? 0 : (halaman - 1) * pageSize + 1;
    const sampai = Math.min(halaman * pageSize, total);
    const adaSebelumnya = halaman > 1;
    const adaBerikutnya = halaman < totalHalaman;
    return (<nav aria-label="Navigasi halaman tabel" className={cn('mt-5 flex flex-col items-center justify-between gap-4 sm:flex-row', className)}>
      <p className="text-xs text-sage-500">
        {total === 0
            ? `Tidak ada ${noun}`
            : `Menampilkan ${dari}–${sampai} dari ${total} ${noun} · Halaman ${halaman} dari ${totalHalaman}`}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!adaSebelumnya || busy} onClick={() => onPageChange(halaman - 1)}>
          <ChevronLeft aria-hidden className="h-4 w-4"/>
          Sebelumnya
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!adaBerikutnya || busy} onClick={() => onPageChange(halaman + 1)}>
          Berikutnya
          <ChevronRight aria-hidden className="h-4 w-4"/>
        </Button>
      </div>
    </nav>);
}
