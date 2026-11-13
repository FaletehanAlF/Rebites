'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BadgeCheck, CalendarDays, CheckCircle2, Clock, Crown, Lock, Minus, Package, Pencil, Plus, Trash2, TriangleAlert, Utensils, XCircle, Zap, } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah } from '@/lib/data';
import { patchSellerProduct, deleteSellerProduct, } from '@/lib/product-storage';
import { isProductAvailable } from '@/lib/product-storage';
import { formatScheduleDate, resolveMenuScheduleStatus, toScheduleDateInput, todayScheduleDateInput, } from '@/lib/menu-schedule';
import { useSellerPlan, type SellerEntitlements } from '@/lib/seller-plan';
import { useStoreProducts } from '@/hooks/seller/use-store-products';
import { useSellerStatus } from '@/hooks/seller/use-seller-status';
import { addWibDays, countFlashSaleProducts, FLASH_SLOTS, flashSlotRange, formatFlashScheduleLabel, getFlashQuota, isFlashSlotPast, removeFlashSale, resolveFlashSaleStatus, setFlashSale, slotFromStartIso, todayWibDate, validateFlashSaleSchedule, type FlashSaleStatus, } from '@/lib/flash-sale';
import type { UrgentSlot } from '@/lib/types';
import type { SellerProduct } from '@/lib/product-storage';
import { SellerShell } from '@/app/components/seller/dashboard-penjual/SellerShell';
import { Card } from '@/app/components/seller/dashboard-penjual/Card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Badge } from '@/app/components/ui/badge';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from '@/app/components/ui/dialog';
import { useStoreRouteId } from '@/hooks/use-store-route-id';
import { sellerStorePath } from '@/lib/seller-store-path';
function ProductLimitMeter({ products }: {
    products: SellerProduct[];
}) {
    const { plan } = useSellerPlan();
    const count = products.length;
    const max = plan.maxProducts;
    const isUnlimited = max === null;
    const percent = isUnlimited ? 100 : Math.min(100, (count / max) * 100);
    return (<div>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-semibold text-charcoal-500">
          Kuota paket {plan.label}
        </span>
        <span className="tabular-nums font-bold text-charcoal-900">
          {isUnlimited ? `${count} produk · tanpa batas` : `${count}/${max} produk`}
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${percent}%` }}/>
      </div>
      {plan.tier === 'basic' && (<p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Paket Basic menyimpan maksimal {max} produk dan riwayat penjualan 30 hari.
        </p>)}
    </div>);
}
function StockEditor({ product }: {
    product: SellerProduct;
}) {
    const [stock, setStock] = useState(product.stock);
    const [editing, setEditing] = useState(false);
    useEffect(() => {
        setStock(product.stock);
    }, [product.stock]);
    const handleSave = (newStock: number) => {
        const clamped = Number.isFinite(newStock) ? Math.max(0, Math.round(newStock)) : 0;
        setStock(clamped);
        patchSellerProduct(product.id, { stock: clamped });
        setEditing(false);
    };
    if (editing) {
        return (<div className="flex items-center gap-1.5">
          <button type="button" aria-label="Kurangi stok" onClick={() => handleSave(Math.max(0, stock - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            <Minus aria-hidden className="h-3.5 w-3.5"/>
          </button>
          <input type="number" aria-label="Jumlah stok" value={stock} onChange={(e) => {
            const parsed = Number(e.target.value);
            setStock(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
        }} onBlur={() => handleSave(stock)} onKeyDown={(e) => e.key === 'Enter' && handleSave(stock)} className="h-8 w-16 rounded-lg border border-primary bg-white px-2 text-center text-xs font-bold text-foreground outline-none ring-2 ring-primary/20" min={0} autoFocus/>
          <button type="button" aria-label="Tambah stok" onClick={() => handleSave(stock + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            <Plus aria-hidden className="h-3.5 w-3.5"/>
          </button>
        </div>);
    }
    return (<button type="button" onClick={() => setEditing(true)} aria-label={`Ubah stok ${product.name}`} className={cn('inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30', stock > 0
            ? 'bg-primary/10 text-primary hover:bg-primary/15'
            : 'bg-destructive/10 text-destructive hover:bg-destructive/15')}>
      {stock > 0 ? `${stock} porsi` : 'Habis'}
      <Pencil aria-hidden className="h-3 w-3 opacity-60"/>
    </button>);
}
function TimeEditor({ product }: {
    product: SellerProduct;
}) {
    const [startTime, setStartTime] = useState(product.startTime || '09:00');
    const [endTime, setEndTime] = useState(product.endTime || '17:00');
    const [allDay, setAllDay] = useState(product.allDay ?? false);
    useEffect(() => {
        setStartTime(product.startTime || '09:00');
    }, [product.startTime]);
    useEffect(() => {
        setEndTime(product.endTime || '17:00');
    }, [product.endTime]);
    useEffect(() => {
        setAllDay(product.allDay ?? false);
    }, [product.allDay]);
    const handleAllDayToggle = () => {
        const next = !allDay;
        setAllDay(next);
        patchSellerProduct(product.id, { allDay: next });
    };
    const handleTimeChange = (field: 'startTime' | 'endTime', value: string) => {
        if (field === 'startTime') {
            setStartTime(value);
            patchSellerProduct(product.id, { startTime: value });
        }
        else {
            setEndTime(value);
            patchSellerProduct(product.id, { endTime: value });
        }
    };
    return (<div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[11px] font-semibold text-charcoal-700">
          <Clock aria-hidden className="h-3.5 w-3.5 text-muted-foreground"/>
          Jam jual
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">Sepanjang hari</span>
          <button type="button" role="switch" aria-checked={allDay} aria-label="Jual sepanjang hari" onClick={handleAllDayToggle} className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1', allDay ? 'bg-primary' : 'bg-muted')}>
            <span className={cn('absolute h-4 w-4 rounded-full bg-white shadow-sm transition-all', allDay ? 'left-[22px]' : 'left-1')}/>
          </button>
        </div>
      </div>

      {!allDay && (<div className="flex items-center gap-2">
          <input type="time" aria-label="Jam mulai jual" value={startTime} onChange={(e) => handleTimeChange('startTime', e.target.value)} className="h-9 flex-1 rounded-lg border border-border bg-white px-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"/>
          <span className="text-xs text-muted-foreground">–</span>
          <input type="time" aria-label="Jam selesai jual" value={endTime} onChange={(e) => handleTimeChange('endTime', e.target.value)} className="h-9 flex-1 rounded-lg border border-border bg-white px-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"/>
        </div>)}
    </div>);
}
function formatPeriodLabel(iso: string): string {
    const date = new Date(iso);
    const timeParts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const pick = (type: Intl.DateTimeFormatPartTypes) => timeParts.find((part) => part.type === type)?.value ?? '00';
    return `${date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
    })} · ${pick('hour')}:${pick('minute')} WIB`;
}
function toInputParts(value: Date) {
    return {
        date: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
        time: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`,
    };
}
const FLASH_STATUS_META: Record<Exclude<FlashSaleStatus, 'inactive'>, {
    label: string;
    className: string;
}> = {
    scheduled: { label: 'Terjadwal', className: 'bg-primary/15 text-foreground' },
    active: { label: 'Sedang berlangsung', className: 'bg-primary/10 text-primary' },
    ended: {
        label: 'Berakhir',
        className: 'border border-border bg-secondary text-muted-foreground',
    },
};
function FlashStatusBadge({ status }: {
    status: FlashSaleStatus;
}) {
    if (status === 'inactive') {
        return (<span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Tidak aktif
      </span>);
    }
    const meta = FLASH_STATUS_META[status];
    return (<span className={cn('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', meta.className)}>
      {status === 'active' && (<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/100"/>)}
      {meta.label}
    </span>);
}
interface FlashSalePanelProps {
    product: SellerProduct;
    quota: number;
    used: number;
    onUpgradeClick: () => void;
    onQuotaBlocked: () => void;
}
function FlashSalePanel({ product, quota, used, onUpgradeClick, onQuotaBlocked, }: FlashSalePanelProps) {
    const cfg = product.flashSale ?? null;
    const status = resolveFlashSaleStatus(product);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState('');
    const [price, setPrice] = useState('');
    const [selectedSlot, setSelectedSlot] = useState<UrgentSlot>('09-12');
    const [saleDate, setSaleDate] = useState(() => todayWibDate());
    const [saving, setSaving] = useState(false);
    const isBasic = quota === 0;
    const occupiesSlot = cfg != null;
    const canEnable = !isBasic && (occupiesSlot || used < quota);
    const firstAvailableSlot = (date: string): UrgentSlot | null => FLASH_SLOTS.find((slot) => !isFlashSlotPast(date, slot.key))?.key ?? null;
    const handleDateChange = (value: string) => {
        if (!value)
            return;
        setSaleDate(value);
        setError('');
        if (isFlashSlotPast(value, selectedSlot)) {
            const next = firstAvailableSlot(value);
            if (next)
                setSelectedSlot(next);
        }
    };
    const startEditing = () => {
        setPrice(cfg ? String(cfg.price) : String(Math.max(1000, Math.round(product.surplusPrice * 0.8))));
        const date = (cfg ? toScheduleDateInput(cfg.startIso) : '') || todayWibDate();
        setSaleDate(date);
        const preferred = cfg ? slotFromStartIso(cfg.startIso) : '09-12';
        setSelectedSlot(isFlashSlotPast(date, preferred) ? firstAvailableSlot(date) ?? preferred : preferred);
        setError('');
        setEditing(true);
    };
    const handleToggle = () => {
        if (isBasic) {
            onUpgradeClick();
            return;
        }
        if (!canEnable) {
            onQuotaBlocked();
            return;
        }
        startEditing();
    };
    const handleSave = () => {
        setError('');
        const priceNum = Number(price);
        if (!Number.isFinite(priceNum) || priceNum <= 0) {
            setError('Harga Flash Sale tidak valid.');
            return;
        }
        if (priceNum >= product.surplusPrice) {
            setError('Harga Flash Sale harus lebih rendah dari harga normal.');
            return;
        }
        const range = flashSlotRange(saleDate, selectedSlot);
        if (!range) {
            setError('Tanggal atau slot Flash Sale tidak valid.');
            return;
        }
        const scheduleError = validateFlashSaleSchedule({
            startIso: range.startIso,
            endIso: range.endIso,
            scheduledStart: product.scheduledStart,
            scheduledEnd: product.scheduledEnd,
        });
        if (scheduleError) {
            setError(scheduleError);
            return;
        }
        setSaving(true);
        setFlashSale(product.id, {
            price: priceNum,
            startIso: range.startIso,
            endIso: range.endIso,
        })
            .then((result) => {
            if (!result.ok) {
                setError(result.error ?? 'Gagal menyimpan Flash Sale.');
                return;
            }
            setEditing(false);
        })
            .finally(() => setSaving(false));
    };
    const draftDiscount = cfg && product.surplusPrice > 0
        ? Math.max(0, Math.round((1 - cfg.price / product.surplusPrice) * 100))
        : 0;
    const previewPrice = Number(price);
    const previewDiscount = Number.isFinite(previewPrice) &&
        previewPrice > 0 &&
        previewPrice < product.surplusPrice &&
        product.surplusPrice > 0
        ? Math.round((1 - previewPrice / product.surplusPrice) * 100)
        : null;
    const todayDate = todayWibDate();
    const tomorrowDate = addWibDays(todayDate, 1);
    const todayHasSlot = firstAvailableSlot(todayDate) != null;
    const previewRange = flashSlotRange(saleDate, selectedSlot);
    const previewScheduleError = previewRange
        ? validateFlashSaleSchedule({
            startIso: previewRange.startIso,
            endIso: previewRange.endIso,
            scheduledStart: product.scheduledStart,
            scheduledEnd: product.scheduledEnd,
        })
        : 'Tanggal atau slot Flash Sale tidak valid.';
    return (<div className="mt-3 border-t border-border/70 pt-3">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', occupiesSlot || editing ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
          <Zap aria-hidden className="h-3.5 w-3.5"/>
        </span>
        <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-foreground">
          Flash Sale
        </span>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <FlashStatusBadge status={status}/>
          <button type="button" onClick={handleToggle} aria-label={`Atur Flash Sale ${product.name}`} title="Atur Flash Sale" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-charcoal-500 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            <Pencil aria-hidden className="h-3.5 w-3.5"/>
          </button>
        </div>
      </div>

      {isBasic ? (<p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Tidak tersedia di paket Basic. Upgrade ke Standar untuk mengikuti Flash Sale.
        </p>) : cfg ? (<div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <span className="flex items-baseline gap-1.5">
            <span className="text-xs font-bold text-charcoal-900">
              {formatRupiah(cfg.price)}
            </span>
            {draftDiscount > 0 && (<span className="text-[10px] font-bold text-primary">−{draftDiscount}%</span>)}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sage-500">
            <CalendarDays className="h-3 w-3 shrink-0" aria-hidden/>
            {formatFlashScheduleLabel(cfg.startIso)}
          </span>
        </div>) : !canEnable ? (<p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Kuota Flash Sale paket Standar sudah digunakan.
        </p>) : null}

      {editing && (<Dialog open onOpenChange={(open) => !open && setEditing(false)}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border-sage-100 bg-white p-5">
            <DialogHeader>
              <DialogTitle className="font-display text-base font-semibold text-charcoal-900">
                Atur Flash Sale
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed text-sage-500">
                {product.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2.5">
          <div className="rounded-xl bg-white p-2.5">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-foreground">
              Harga Flash Sale
            </label>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">
                  Rp
                </span>
                <input type="number" min={0} value={price} onChange={(event) => {
                setPrice(event.target.value);
                setError('');
            }} className="h-8 w-full rounded-lg border border-border bg-white pl-7 pr-2 text-xs font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"/>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-medium text-muted-foreground line-through">
                  {formatRupiah(product.surplusPrice)}
                </p>
                {previewDiscount !== null && (<p className="text-[10px] font-bold text-primary">
                    Diskon {previewDiscount}%
                  </p>)}
              </div>
            </div>
          </div>

          
          <div className="rounded-xl border border-sage-100 bg-secondary/40 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`flash-date-${product.id}`} className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                Tanggal Flash Sale
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sage-500">
                <CalendarDays className="h-3 w-3" aria-hidden/>
                WIB
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button type="button" disabled={!todayHasSlot} onClick={() => handleDateChange(todayDate)} className={cn('h-8 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors', saleDate === todayDate
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-white text-foreground hover:border-primary', !todayHasSlot && 'cursor-not-allowed opacity-50')}>
                Hari ini
              </button>
              <button type="button" onClick={() => handleDateChange(tomorrowDate)} className={cn('h-8 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors', saleDate === tomorrowDate
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-white text-foreground hover:border-primary')}>
                Besok
              </button>
              <input id={`flash-date-${product.id}`} type="date" min={todayDate} value={saleDate} onChange={(event) => handleDateChange(event.target.value)} className="h-8 min-w-[9.5rem] flex-1 rounded-lg border border-border bg-white px-2 text-[11px] font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"/>
            </div>
            {!todayHasSlot && (<p className="mt-1.5 text-[10px] leading-relaxed text-caramel-dark">
                Semua slot hari ini sudah lewat. Pilih tanggal berikutnya.
              </p>)}
          </div>

          
          <div className="rounded-xl border border-sage-100 bg-white p-2.5">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-foreground">
              Slot Waktu
            </label>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Pilih jam tayang promo di beranda. Slot sudah lewat pada tanggal ini dinonaktifkan.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FLASH_SLOTS.map((slot) => {
                const active = selectedSlot === slot.key;
                const past = isFlashSlotPast(saleDate, slot.key);
                return (<button key={slot.key} type="button" disabled={past} aria-pressed={active} onClick={() => {
                        setSelectedSlot(slot.key);
                        setError('');
                    }} className={cn('rounded-xl border px-3 py-2.5 text-left transition-colors', active
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : past
                            ? 'cursor-not-allowed border-border bg-secondary text-muted-foreground opacity-70'
                            : 'border-border bg-white text-foreground hover:border-primary hover:bg-primary-dark/20')}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">{slot.label}</span>
                      {past && (<span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Lewat
                        </span>)}
                    </span>
                    <span className={cn('mt-0.5 block text-[11px]', active ? 'text-white/80' : 'text-muted-foreground')}>
                      {slot.range}
                    </span>
                  </button>);
            })}
            </div>
          </div>

          <div className="rounded-xl border border-primary/10 bg-primary/[0.03] p-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-primary">
              <Clock className="h-3 w-3" aria-hidden/>
              Jadwal promo
            </p>
            {previewRange ? (<dl className="mt-1.5 space-y-0.5 text-[11px]">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">Mulai</dt>
                  <dd className="text-right font-semibold text-foreground">
                    {formatPeriodLabel(previewRange.startIso)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">Berakhir</dt>
                  <dd className="text-right font-semibold text-foreground">
                    {formatPeriodLabel(previewRange.endIso)}
                  </dd>
                </div>
              </dl>) : (<p className="mt-1.5 text-[11px] text-muted-foreground">
                Pilih tanggal dan slot yang valid.
              </p>)}
            {previewScheduleError && (<p className="mt-1.5 flex items-start gap-1.5 text-[10px] font-medium leading-relaxed text-caramel-dark">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden/>
                {previewScheduleError}
              </p>)}
          </div>

          {error && (<p className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-[11px] font-medium text-destructive">
              <XCircle className="h-3.5 w-3.5 shrink-0"/>
              {error}
            </p>)}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleSave} disabled={saving || previewScheduleError != null} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">
              <CheckCircle2 className="h-3.5 w-3.5"/>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            {cfg && (<button type="button" onClick={() => {
                    removeFlashSale(product.id);
                    setEditing(false);
                }} className="inline-flex items-center gap-1.5 rounded-full border border-destructive/25 px-4 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5"/>
                Keluar dari Flash Sale
              </button>)}
            <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary">
              Batal
            </button>
          </div>
            </div>
          </DialogContent>
        </Dialog>)}
    </div>);
}
function MenuCard({ product, flashQuota, flashUsed, onUpgradeClick, onQuotaBlocked, editHref, }: {
    product: SellerProduct;
    flashQuota: number;
    flashUsed: number;
    onUpgradeClick: () => void;
    onQuotaBlocked: () => void;
    editHref: string;
}) {
    const { plan } = useSellerPlan();
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const handleToggleFeatured = () => {
        patchSellerProduct(product.id, { featured: !product.featured });
    };
    const handleToggleStock = () => {
        patchSellerProduct(product.id, {
            stock: product.stock > 0 ? 0 : 5,
        });
    };
    const handleDelete = () => {
        if (!confirmingDelete) {
            setConfirmingDelete(true);
            return;
        }
        deleteSellerProduct(product.id);
    };
    const available = isProductAvailable(product);
    const scheduleStatus = resolveMenuScheduleStatus(product);
    const verificationStatus = product.verificationStatus ?? 'approved';
    const availability = scheduleStatus === 'scheduled'
        ? { label: 'Dijadwalkan', className: 'bg-caramel/20 text-caramel-dark' }
        : scheduleStatus === 'ended'
            ? { label: 'Jadwal berakhir', className: 'bg-muted text-muted-foreground' }
            : available
                ? { label: 'Tayang', className: 'bg-primary/10 text-primary' }
                : product.stock <= 0
                    ? { label: 'Stok habis', className: 'bg-destructive/10 text-destructive' }
                    : { label: 'Di luar jam', className: 'bg-muted text-muted-foreground' };
    return (<Card className="flex h-full flex-col p-4 sm:p-5">
      
      <div className="flex items-start gap-3.5">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-sage-100">
          <SmartImage src={product.image} alt={`Foto ${product.name}`} sizes="96px"/>
          {product.featured && (<span className="absolute left-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-caramel text-white shadow-sm" title="Unggulan">
              <Crown className="h-3 w-3" aria-hidden/>
            </span>)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-charcoal-900" title={product.name}>
                {product.name}
              </h3>
              <p className="mt-0.5 truncate text-xs text-sage-500">{product.category}</p>
            </div>
            <Link href={editHref} aria-label={`Ubah ${product.name}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-[11px] font-semibold text-charcoal-600 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
              <Pencil aria-hidden className="h-3.5 w-3.5"/>
              Edit
            </Link>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {verificationStatus === 'approved' ? null : verificationStatus === 'rejected' ? (<Badge variant="destructive">Ditunda Admin</Badge>) : (<Badge variant="warning">Menunggu Verifikasi</Badge>)}
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]', availability.className)}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current"/>
              {availability.label}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className="text-base font-bold text-primary">
              {formatRupiah(product.surplusPrice)}
            </span>
            <span className="text-[11px] text-muted-foreground line-through">
              {formatRupiah(product.originalPrice)}
            </span>
          </div>
        </div>
      </div>

      {scheduleStatus !== 'none' && (<p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <CalendarDays aria-hidden className="mt-0.5 h-3 w-3 shrink-0"/>
          <span>
            {scheduleStatus === 'scheduled'
                ? `Tayang mulai ${formatScheduleDate(product.scheduledStart)}`
                : scheduleStatus === 'ended'
                    ? `Jadwal berakhir ${formatScheduleDate(product.scheduledEnd)}`
                    : product.scheduledStart
                        ? `Tayang ${formatScheduleDate(product.scheduledStart)}${product.scheduledEnd
                            ? ` – ${formatScheduleDate(product.scheduledEnd)}`
                            : ''}`
                        : `Tayang sampai ${formatScheduleDate(product.scheduledEnd)}`}
          </span>
        </p>)}

      
      {verificationStatus === 'rejected' &&
            product.rejectionReason?.trim() ? (<p className="mt-2.5 line-clamp-3 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-red-700">
          <span className="font-bold">Alasan penundaan: </span>
          {product.rejectionReason.trim()}
        </p>) : null}
      {product.isDelivery && product.weightGram == null ? (<div className="mt-2.5 flex items-start gap-2 rounded-lg bg-caramel/15 px-2.5 py-2">
          <TriangleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-caramel-dark"/>
          <p className="text-[11px] leading-relaxed text-charcoal-700">
            <span className="font-bold text-charcoal-900">Berat belum diisi.</span>{" "}
            <Link href={`${editHref}?fokus=berat`} className="font-semibold text-caramel-dark underline-offset-2 hover:underline">
              Isi berat
            </Link>{" "}
            agar ongkir lebih akurat.
          </p>
        </div>) : null}

      
      <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[11px] font-semibold text-charcoal-700">
            <Package aria-hidden className="h-3.5 w-3.5 text-muted-foreground"/>
            Stok
          </span>
          <StockEditor product={product}/>
        </div>
        <TimeEditor product={product}/>
      </div>

      <FlashSalePanel product={product} quota={flashQuota} used={flashUsed} onUpgradeClick={onUpgradeClick} onQuotaBlocked={onQuotaBlocked}/>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <button type="button" onClick={handleToggleStock} className="inline-flex min-h-[34px] items-center rounded-lg border border-border bg-white px-3 text-[11px] font-semibold text-foreground transition-colors hover:bg-secondary">
          {product.stock > 0 ? 'Set Habis' : 'Set Tersedia'}
        </button>

        {plan.featuredPromo && (<button type="button" onClick={handleToggleFeatured} className={cn('inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-colors', product.featured
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'border border-primary/50 text-primary hover:bg-primary/5')}>
            <Crown aria-hidden className="h-3 w-3"/>
            {product.featured ? 'Lepas Unggulan' : 'Jadikan Unggulan'}
          </button>)}

        <button type="button" onClick={handleDelete} onBlur={() => setConfirmingDelete(false)} aria-label={confirmingDelete ? `Klik lagi untuk menghapus ${product.name}` : `Hapus ${product.name}`} className={cn('ml-auto inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition-colors', confirmingDelete
            ? 'bg-destructive text-white'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}>
          <Trash2 aria-hidden className="h-3 w-3"/>
          {confirmingDelete ? 'Yakin?' : 'Hapus'}
        </button>
      </div>
    </Card>);
}
function FlashSaleSummaryRow({ plan, quota, used, }: {
    plan: SellerEntitlements;
    quota: number;
    used: number;
}) {
    const isBasic = quota === 0;
    const storeId = useStoreRouteId();
    const value = isBasic
        ? 'Tidak tersedia'
        : quota === Infinity
            ? `${used} produk`
            : `${used}/${quota}`;
    return (<div className="flex flex-col rounded-xl border border-border/60 bg-secondary/40 p-3.5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <Zap aria-hidden className="h-3.5 w-3.5 text-primary"/>
        Flash Sale
        {isBasic && <Lock aria-hidden className="h-3 w-3"/>}
      </p>
      <p className={cn('mt-1 font-bold tabular-nums', isBasic ? 'text-sm text-charcoal-500' : 'text-xl text-charcoal-900')}>
        {value}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <p className="text-[11px] text-muted-foreground">paket {plan.label}</p>
        {isBasic && (<Link href={sellerStorePath(storeId, 'langganan')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary underline-offset-2 hover:underline">
            <Crown aria-hidden className="h-3 w-3"/>
            Lihat paket
          </Link>)}
      </div>
    </div>);
}
export default function MenuSayaPage() {
    const { plan } = useSellerPlan();
    const { storeId, storeSlug } = useSellerStatus();
    const storeKey = storeSlug ?? storeId ?? '';
    const { products, loading: productsLoading, error: productsError, refresh: refreshProducts, } = useStoreProducts(storeKey);
    const routeStoreId = useStoreRouteId();
    const flashQuota = getFlashQuota(plan);
    const flashUsed = countFlashSaleProducts(products);
    const [upgradeOpen, setUpgradeOpen] = useState(false);
    const [quotaBlocked, setQuotaBlocked] = useState(false);
    const [, setStatusTick] = useState(0);
    useEffect(() => {
        const id = window.setInterval(() => setStatusTick((tick) => tick + 1), 30000);
        return () => window.clearInterval(id);
    }, []);
    useEffect(() => {
        if (!quotaBlocked)
            return;
        const timeout = window.setTimeout(() => setQuotaBlocked(false), 4000);
        return () => window.clearTimeout(timeout);
    }, [quotaBlocked]);
    const isLimitReached = plan.maxProducts !== null && products.length >= plan.maxProducts;
    const availableCount = products.filter(isProductAvailable).length;
    return (<SellerShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-2xl">
            <h1 className="mt-1 font-display text-2xl font-semibold leading-tight tracking-tight text-primary">
              Menu Saya
            </h1>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
              Kelola stok, jam tayang, dan Flash Sale setiap menu. Menu yang tayang langsung muncul di halaman Detail Toko.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <span aria-live="polite" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
              <Utensils aria-hidden className="h-3.5 w-3.5 text-primary"/>
              {productsLoading ? "Memuat menu…" : `${products.length} menu`}
            </span>
            {isLimitReached ? (plan.upgradeSlug && (<Link href={`/langganan/pembayaran?plan=${plan.upgradeSlug}&billing=monthly`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary-dark">
                <Lock className="h-4 w-4" aria-hidden/>
                Naikkan kuota
              </Link>)) : (<Link href={sellerStorePath(routeStoreId, 'tambahMenu')} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary-dark">
              <Plus className="h-4 w-4" aria-hidden/>
              Tambah Menu
            </Link>)}
          </div>
        </header>
      </motion.div>

      <Card className="mt-5 p-4 sm:p-5">
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="flex flex-col rounded-xl border border-border/60 bg-secondary/40 p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <Utensils aria-hidden className="h-3.5 w-3.5 text-primary"/>
              Total menu
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-charcoal-900">{products.length}</p>
            <p className="text-[11px] text-muted-foreground">
              {plan.maxProducts === null ? "Tanpa batas paket" : `Maksimal ${plan.maxProducts} produk`}
            </p>
          </div>
          <div className="flex flex-col rounded-xl border border-border/60 bg-secondary/40 p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5 text-primary"/>
              Tayang sekarang
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-charcoal-900">{availableCount}</p>
            <p className="text-[11px] text-muted-foreground">siap dipesan pembeli</p>
          </div>
          <FlashSaleSummaryRow plan={plan} quota={flashQuota} used={flashUsed}/>
        </div>

        <div className="mt-4 border-t border-border/70 pt-4">
          <ProductLimitMeter products={products}/>
        </div>

        {isLimitReached && (<p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-charcoal-900">
            <BadgeCheck aria-hidden className="h-3.5 w-3.5 shrink-0 text-primary"/>
            Batas produk tercapai. Hapus salah satu menu atau upgrade paket.
          </p>)}
      </Card>

      {quotaBlocked && (<p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-2 text-[11px] font-medium text-foreground">
          <XCircle className="h-3.5 w-3.5 shrink-0"/>
          {flashQuota === 0
                ? 'Fitur Flash Sale tersedia mulai dari paket Standar. Upgrade paket untuk menambahkan produk ke Flash Sale.'
                : 'Paket Standar hanya dapat memasukkan 1 produk ke Flash Sale.'}
        </p>)}

      {productsLoading ? (<div role="status" aria-label="Memuat daftar menu" className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (<Skeleton key={i} className="h-80 rounded-2xl"/>))}
        </div>) : productsError ? (<div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-white p-5 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <XCircle aria-hidden className="h-4 w-4"/>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              Daftar menu gagal dimuat
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {productsError} Coba lagi untuk memuat menu tokomu.
            </p>
          </div>
          <button type="button" onClick={refreshProducts} className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark">
            Coba Lagi
          </button>
        </div>) : products.length === 0 ? (<div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border-2 border-dashed border-border bg-white p-6 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary shadow-sm">
            <Utensils aria-hidden className="h-5 w-5"/>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">Belum ada menu</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Menu yang kamu tambahkan akan tampil di sini dan langsung muncul
              di halaman Detail Toko.
            </p>
          </div>
          {!isLimitReached && (<Link href={sellerStorePath(routeStoreId, 'tambahMenu')} className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark">
              <Plus aria-hidden className="h-3.5 w-3.5"/>
              Tambah Menu
            </Link>)}
        </div>) : (<div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {products.map((product) => (<MenuCard key={product.id} product={product} flashQuota={flashQuota} flashUsed={flashUsed} onUpgradeClick={() => setUpgradeOpen(true)} onQuotaBlocked={() => setQuotaBlocked(true)} editHref={`${sellerStorePath(routeStoreId, 'menu')}/${encodeURIComponent(product.id)}/edit`}/>))}
        </div>)}

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-border bg-white p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-medium tracking-tight text-primary">
              Flash Sale belum tersedia
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
              Fitur Flash Sale tersedia mulai dari paket Standar. Upgrade paket untuk
              menampilkan produkmu di Flash Sale.
            </DialogDescription>
          </DialogHeader>
          <Link href={sellerStorePath(routeStoreId, 'langganan')} onClick={() => setUpgradeOpen(false)} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark">
            <Crown className="h-3.5 w-3.5"/>
            Lihat Paket
          </Link>
        </DialogContent>
      </Dialog>
    </SellerShell>);
}
