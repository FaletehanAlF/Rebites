'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Lock,
  Minus,
  Package,
  Pencil,
  Plus,
  Trash2,
  Utensils,
  XCircle,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah } from '@/lib/data';
import {
  patchSellerProduct,
  deleteSellerProduct,
} from '@/lib/product-storage';
import { isProductAvailable } from '@/lib/product-storage';
import { useSellerPlan, type SellerEntitlements } from '@/lib/seller-plan';
import { useStoreProducts } from '@/hooks/use-store-products';
import { useSellerStatus } from '@/hooks/use-seller-status';
import {
  countFlashSaleProducts,
  FLASH_SLOTS,
  getFlashQuota,
  removeFlashSale,
  resolveFlashSaleStatus,
  setFlashSale,
  slotFromStartIso,
  slotToWibIso,
  type FlashSaleStatus,
} from '@/lib/flash-sale';
import type { UrgentSlot } from '@/lib/types';
import type { SellerProduct } from '@/lib/product-storage';
import { SellerShell } from '@/app/components/dashboard-penjual/SellerShell';
import { Card } from '@/app/components/dashboard-penjual/Card';
import { Badge } from '@/app/components/ui/badge';
import { SmartImage } from '@/app/components/shared/SmartImage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { EditProductModal } from '@/app/components/tambahMenu/EditProductModal';

function ProductLimitMeter({ products }: { products: SellerProduct[] }) {
  const { plan } = useSellerPlan();
  const count = products.length;
  const max = plan.maxProducts;
  const isUnlimited = max === null;
  const percent = isUnlimited ? 0 : Math.min(100, (count / max) * 100);
  const isFull = !isUnlimited && count >= max;

  return (
    <div className="mt-5 rounded-2xl bg-cream-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-charcoal-900">
          Kuota produk{' '}
          <span className="text-sage-500">· paket {plan.label}</span>
        </p>
        <p
          className={cn(
            'text-xs font-bold',
            isFull ? 'text-caramel-dark' : 'text-primary'
          )}
        >
          {isUnlimited ? `${count} produk · tanpa batas` : `${count}/${max} produk`}
        </p>
      </div>
      {!isUnlimited && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isFull ? 'bg-caramel' : 'bg-primary'
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {plan.tier === 'basic' && (
        <p className="mt-2 text-[11px] leading-relaxed text-sage-500">
          Paket Basic menyimpan maksimal {max} produk dan riwayat penjualan 30 hari.
        </p>
      )}
    </div>
  );
}

function StockEditor({ product }: { product: SellerProduct }) {
  const [stock, setStock] = useState(product.stock);
  const [editing, setEditing] = useState(false);

  const handleSave = (newStock: number) => {
    const clamped = Math.max(0, newStock);
    setStock(clamped);
    patchSellerProduct(product.id, { stock: clamped });
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Package className="h-3.5 w-3.5 text-sage-500" />
      <span className="text-xs text-charcoal-500">Stok:</span>
      {editing ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleSave(Math.max(0, stock - 1))}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-sage-200 bg-white text-charcoal-700 transition-colors hover:bg-sage-50"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="number"
            value={stock}
            onChange={(e) => setStock(Math.max(0, Number(e.target.value)))}
            onBlur={() => handleSave(stock)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave(stock)}
            className="h-7 w-14 rounded-md border border-primary bg-white px-2 text-center text-xs font-bold text-charcoal-900 outline-none ring-2 ring-primary/20"
            min={0}
            autoFocus
          />
          <button
            type="button"
            onClick={() => handleSave(stock + 1)}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-sage-200 bg-white text-charcoal-700 transition-colors hover:bg-sage-50"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors',
            stock > 0
              ? 'bg-primary/10 text-primary hover:bg-caramel'
              : 'bg-red-100 text-red-600 hover:bg-red-200'
          )}
        >
          {stock > 0 ? `${stock} porsi` : 'Habis'}
        </button>
      )}
    </div>
  );
}

function TimeEditor({ product }: { product: SellerProduct }) {
  const [startTime, setStartTime] = useState(product.startTime || '09:00');
  const [endTime, setEndTime] = useState(product.endTime || '17:00');
  const [allDay, setAllDay] = useState(product.allDay ?? false);

  const handleAllDayToggle = () => {
    const next = !allDay;
    setAllDay(next);
    patchSellerProduct(product.id, { allDay: next });
  };

  const handleTimeChange = (field: 'startTime' | 'endTime', value: string) => {
    if (field === 'startTime') {
      setStartTime(value);
      patchSellerProduct(product.id, { startTime: value });
    } else {
      setEndTime(value);
      patchSellerProduct(product.id, { endTime: value });
    }
  };

  const available = isProductAvailable(product);

  return (
    <div className="space-y-2">
      { }
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-sage-500" />
          <span className="text-xs text-charcoal-500">Jam jual:</span>
        </div>
        <button
          type="button"
          onClick={handleAllDayToggle}
          className={cn(
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
            allDay ? 'bg-primary' : 'bg-sage-200'
          )}
        >
          <span
            className={cn(
              'absolute h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all',
              allDay ? 'left-4.5' : 'left-0.5'
            )}
          />
        </button>
      </div>

      { }
      {!allDay && (
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={startTime}
            onChange={(e) => handleTimeChange('startTime', e.target.value)}
            className="h-7 flex-1 rounded-md border border-sage-200 bg-white px-2 text-xs text-charcoal-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <span className="text-xs text-sage-500">–</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => handleTimeChange('endTime', e.target.value)}
            className="h-7 flex-1 rounded-md border border-sage-200 bg-white px-2 text-xs text-charcoal-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      { }
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
          available
            ? 'bg-primary/10 text-primary'
            : 'bg-red-100 text-red-600'
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            available ? 'bg-primary/100' : 'bg-red-500'
          )}
        />
        {available
          ? allDay
            ? 'Tersedia Sepanjang Hari'
            : 'Sedia Sekarang'
          : product.stock <= 0
          ? 'Stok Habis'
          : 'Di Luar Jam Jual'}
      </div>
    </div>
  );
}

function formatPeriodLabel(iso: string): string {
  const date = new Date(iso);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })} · ${hh}:${mm}`;
}

function toInputParts(value: Date) {
  return {
    date: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
      value.getDate()
    ).padStart(2, '0')}`,
    time: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`,
  };
}

const FLASH_STATUS_META: Record<
  Exclude<FlashSaleStatus, 'inactive'>,
  { label: string; className: string }
> = {
  scheduled: { label: 'Terjadwal', className: 'bg-caramel/15 text-charcoal-900' },
  active: { label: 'Sedang berlangsung', className: 'bg-primary/10 text-primary' },
  ended: {
    label: 'Berakhir',
    className: 'border border-sage-100 bg-cream-50 text-charcoal-500',
  },
};

function FlashStatusBadge({ status }: { status: FlashSaleStatus }) {
  if (status === 'inactive') return null;
  const meta = FLASH_STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        meta.className
      )}
    >
      {status === 'active' && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/100" />
      )}
      {meta.label}
    </span>
  );
}

interface FlashSalePanelProps {
  product: SellerProduct;

  quota: number;
  used: number;
  onUpgradeClick: () => void;
  onQuotaBlocked: () => void;
}

function FlashSalePanel({
  product,
  quota,
  used,
  onUpgradeClick,
  onQuotaBlocked,
}: FlashSalePanelProps) {
  const cfg = product.flashSale ?? null;
  const status = resolveFlashSaleStatus(product);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [price, setPrice] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<UrgentSlot>('09-12');

  const isBasic = quota === 0;
  const occupiesSlot = cfg != null;
  const canEnable = !isBasic && (occupiesSlot || used < quota);
  const switchDisabled = isBasic || (!canEnable && !occupiesSlot);

  const startEditing = () => {
    setPrice(cfg ? String(cfg.price) : String(Math.max(1000, Math.round(product.surplusPrice * 0.8))));
    if (cfg) {
      try {
        const hour = Number(
          new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).formatToParts(
            new Date(cfg.startIso)
          ).find((p) => p.type === 'hour')?.value ?? '9'
        );
        if (hour >= 18) setSelectedSlot('18-21');
        else if (hour >= 15) setSelectedSlot('15-18');
        else if (hour >= 12) setSelectedSlot('12-15');
        else setSelectedSlot('09-12');
      } catch {
        setSelectedSlot('09-12');
      }
    } else {
      setSelectedSlot('09-12');
    }
    setError('');
    setEditing(true);
  };

  const handleToggle = () => {
    if (isBasic) {
      onUpgradeClick();
      return;
    }
    if (cfg) {
      removeFlashSale(product.id);
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
    // Hitung start/end dari slot yang dipilih (hari ini/besok WIB). Tidak perlu input tanggal manual.
    let startIso: string;
    let endIso: string;
    try {
      const iso = slotToWibIso(selectedSlot);
      startIso = iso.startIso;
      endIso = iso.endIso;
    } catch {
      setError('Slot Flash Sale tidak valid.');
      return;
    }
    setFlashSale(product.id, {
      price: priceNum,
      startIso,
      endIso,
    }).then((result) => {
      if (!result.ok) {
        setError(result.error ?? 'Gagal menyimpan Flash Sale.');
        return;
      }
      setEditing(false);
    });
  };

  const draftDiscount =
    cfg && product.surplusPrice > 0
      ? Math.max(0, Math.round((1 - cfg.price / product.surplusPrice) * 100))
      : 0;
  const previewPrice = Number(price);
  const previewDiscount =
    Number.isFinite(previewPrice) &&
    previewPrice > 0 &&
    previewPrice < product.surplusPrice &&
    product.surplusPrice > 0
      ? Math.round((1 - previewPrice / product.surplusPrice) * 100)
      : null;

  return (
    <div className="mt-3 rounded-2xl bg-cream-50 p-3">
      <div className="flex items-center gap-2">
        <Zap
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            occupiesSlot || editing ? 'text-caramel' : 'text-sage-500'
          )}
        />
        <span className="text-xs font-semibold text-charcoal-900">Flash Sale</span>
        <div className="ml-auto flex items-center gap-2">
          <FlashStatusBadge status={status} />
          <button
            type="button"
            role="switch"
            aria-checked={occupiesSlot}
            aria-label={`Flash Sale ${product.name}`}
            disabled={switchDisabled}
            onClick={handleToggle}
            title={
              isBasic
                ? 'Tersedia mulai paket Standar'
                : switchDisabled
                  ? 'Kuota Flash Sale paket Standar sudah digunakan.'
                  : undefined
            }
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
              occupiesSlot ? 'bg-caramel' : 'bg-stone',
              switchDisabled && 'cursor-not-allowed opacity-40'
            )}
          >
            <span
              className={cn(
                'absolute h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all',
                occupiesSlot ? 'left-[18px]' : 'left-0.5'
              )}
            />
          </button>
        </div>
      </div>

      {isBasic ? (
        <p className="mt-2 text-[11px] leading-relaxed text-sage-500">
          Tidak tersedia di paket Basic. Upgrade ke Standar untuk mengikuti Flash Sale.
        </p>
      ) : editing ? (
        <div className="mt-3 space-y-2.5">
          { }
          <div className="rounded-xl bg-white p-2.5">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-charcoal-900">
              Harga Flash Sale
            </label>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-sage-500">
                  Rp
                </span>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(event) => {
                    setPrice(event.target.value);
                    setError('');
                  }}
                  className="h-8 w-full rounded-lg border border-sage-200 bg-white pl-7 pr-2 text-xs font-bold text-charcoal-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-medium text-sage-500 line-through">
                  {formatRupiah(product.surplusPrice)}
                </p>
                {previewDiscount !== null && (
                  <p className="text-[10px] font-bold text-primary">
                    Diskon {previewDiscount}%
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Pilih Waktu Flash Sale: Pagi/Siang/Sore/Malam - produk akan tampil di slot ini di home */}
          <div className="rounded-xl bg-white p-2.5">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-charcoal-900">
              Waktu Flash Sale
            </label>
            <p className="mt-1 text-[11px] leading-relaxed text-sage-500">
              Pilih jam tampil di section Flash Sale home. Produk akan tampil di slot yang dipilih.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FLASH_SLOTS.map((slot) => {
                const active = selectedSlot === slot.key;
                return (
                  <button
                    key={slot.key}
                    type="button"
                    onClick={() => {
                      setSelectedSlot(slot.key);
                      setError('');
                    }}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-sage-200 bg-white text-charcoal-900 hover:border-caramel hover:bg-caramel/20'
                    )}
                  >
                    <span className="text-xs font-bold">{slot.label}</span>
                    <span className={cn('block text-[11px]', active ? 'text-white/80' : 'text-sage-500')}>
                      {slot.range}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {(() => {
            try {
              const iso = slotToWibIso(selectedSlot);
              return (
                <p className="text-[11px] leading-relaxed text-sage-500">
                  Mulai: {formatPeriodLabel(iso.startIso)}
                  <br />
                  Berakhir: {formatPeriodLabel(iso.endIso)}
                  <br />
                  <span className="text-[10px]">Jika slot hari ini sudah lewat, otomatis jadwal besok.</span>
                </p>
              );
            } catch {
              return null;
            }
          })()}

          {error && (
            <p className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-caramel"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Simpan
            </button>
            {cfg && (
              <button
                type="button"
                onClick={() => {
                  removeFlashSale(product.id);
                  setEditing(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Keluar dari Flash Sale
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-sage-200 bg-white px-4 py-2 text-xs font-semibold text-charcoal-900 transition-colors hover:bg-sage-50"
            >
              Batal
            </button>
          </div>
        </div>
      ) : cfg ? (
        <div className="mt-2 space-y-1.5 rounded-xl bg-white p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-sage-500">Harga normal</span>
            <span className="text-[11px] font-medium text-charcoal-500 line-through">
              {formatRupiah(product.surplusPrice)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium text-charcoal-900">Harga Flash Sale</span>
            <span className="flex items-center gap-1.5">
              {draftDiscount > 0 && (
                <span className="text-[10px] font-bold text-primary">Diskon {draftDiscount}%</span>
              )}
              <span className="text-xs font-bold text-charcoal-900">{formatRupiah(cfg.price)}</span>
            </span>
          </div>
          <div className="flex items-start justify-between gap-2 text-[11px] text-sage-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              Slot
            </span>
            <span className="text-right font-medium text-charcoal-900">
              {(() => {
                try {
                  const slotKey = slotFromStartIso(cfg.startIso);
                  const slotDef = FLASH_SLOTS.find((s) => s.key === slotKey);
                  return slotDef ? `${slotDef.label} (${slotDef.range})` : slotKey;
                } catch {
                  return '-';
                }
              })()}{' '}
              • {status === 'active' ? 'Tampil di Home' : status === 'scheduled' ? 'Akan tampil' : 'Berakhir'}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2 text-[11px] text-sage-500">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3 shrink-0" />
              Mulai
            </span>
            <span className="text-right font-medium text-charcoal-900">
              {formatPeriodLabel(cfg.startIso)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2 text-[11px] text-sage-500">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3 shrink-0" />
              Berakhir
            </span>
            <span className="text-right font-medium text-charcoal-900">
              {formatPeriodLabel(cfg.endIso)}
            </span>
          </div>
          <button
            type="button"
            onClick={startEditing}
            className="mt-0.5 inline-flex items-center gap-1.5 rounded-full border border-sage-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-charcoal-900 transition-colors hover:bg-sage-50"
          >
            <Pencil className="h-3 w-3" />
            Ubah pengaturan
          </button>
        </div>
      ) : (
        <p className="mt-1.5 text-[11px] text-sage-500">
          {!canEnable
            ? 'Kuota Flash Sale paket Standar sudah digunakan.'
            : 'Tidak mengikuti Flash Sale.'}
        </p>
      )}
    </div>
  );
}

function MenuCard({
  product,
  flashQuota,
  flashUsed,
  onUpgradeClick,
  onQuotaBlocked,
  onEdit,
}: {
  product: SellerProduct;
  flashQuota: number;
  flashUsed: number;
  onUpgradeClick: () => void;
  onQuotaBlocked: () => void;
  onEdit: () => void;
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

  return (
    <Card className="flex flex-col p-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-sage-100">
        <SmartImage src={product.image} alt={`Foto ${product.name}`} />
        {product.featured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-caramel px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white shadow-md">
            <Crown className="h-3 w-3" />
            Unggulan
          </span>
        )}
        <span
          className={cn(
            'absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]',
            available
              ? 'bg-white/95 text-primary'
              : 'bg-white/95 text-charcoal-500'
          )}
        >
          {available ? `Stok ${product.stock}` : product.stock <= 0 ? 'Habis' : 'Tutup'}
        </span>
      </div>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-charcoal-900">
            {product.name}
          </h3>
          <p className="mt-0.5 text-xs text-sage-500">{product.category}</p>
          <div className="mt-1.5">
            {(product.verificationStatus ?? 'pending') === 'approved' ? (
              <Badge variant="success">Disetujui</Badge>
            ) : (product.verificationStatus ?? 'pending') === 'rejected' ? (
              <Badge variant="destructive">Ditolak</Badge>
            ) : (
              <Badge variant="warning">Menunggu Verifikasi</Badge>
            )}
          </div>
          {(product.verificationStatus ?? 'pending') === 'rejected' &&
          product.rejectionReason?.trim() ? (
            <p className="mt-1.5 rounded-xl bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-700">
              <span className="font-bold">Alasan penolakan: </span>
              {product.rejectionReason.trim()}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${product.name}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sage-200 text-charcoal-500 transition-colors hover:border-caramel hover:bg-caramel/20 hover:text-caramel"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-sm font-bold text-primary">
          {formatRupiah(product.surplusPrice)}
        </span>
        <span className="text-xs text-charcoal-500 line-through">
          {formatRupiah(product.originalPrice)}
        </span>
      </div>

      { }
      <div className="mt-3">
        <StockEditor product={product} />
      </div>

      { }
      <div className="mt-3">
        <TimeEditor product={product} />
      </div>

      { }
      <FlashSalePanel
        product={product}
        quota={flashQuota}
        used={flashUsed}
        onUpgradeClick={onUpgradeClick}
        onQuotaBlocked={onQuotaBlocked}
      />

      { }
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <button
          type="button"
          onClick={handleToggleStock}
          className="rounded-full border border-sage-100 px-3 py-1.5 text-[11px] font-semibold text-charcoal-900 transition-colors hover:bg-cream-50"
        >
          {product.stock > 0 ? 'Set Habis' : 'Set Tersedia'}
        </button>

        {plan.featuredPromo && (
          <button
            type="button"
            onClick={handleToggleFeatured}
            className={cn(
              'rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
              product.featured
                ? 'bg-caramel text-white hover:bg-caramel-600'
                : 'border border-caramel-500 text-caramel-dark hover:bg-caramel/15'
            )}
          >
            {product.featured ? 'Lepas Unggulan' : 'Jadikan Unggulan'}
          </button>
        )}

        <button
          type="button"
          onClick={handleDelete}
          onBlur={() => setConfirmingDelete(false)}
          aria-label={confirmingDelete ? `Klik lagi untuk menghapus ${product.name}` : `Hapus ${product.name}`}
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
            confirmingDelete
              ? 'bg-red-600 text-white'
              : 'border border-sage-100 text-charcoal-500 hover:bg-cream-50 hover:text-charcoal-900'
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {confirmingDelete ? 'Yakin?' : 'Hapus'}
        </button>
      </div>
    </Card>
  );
}

function FlashSaleSectionHeader({
  plan,
  quota,
  used,
}: {
  plan: SellerEntitlements;
  quota: number;
  used: number;
}) {
  const isBasic = quota === 0;

  const pillText = isBasic
    ? 'Paket Basic · Flash Sale tidak tersedia'
    : quota === Infinity
      ? used > 0
        ? `Paket Max · Tanpa batas produk · Flash Sale aktif untuk ${used} produk`
        : 'Paket Max · Tanpa batas produk'
      : `Paket Standar · ${used}/${quota} produk digunakan`;

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-charcoal-900">
            <Zap className="h-4 w-4 text-caramel" />
            Flash Sale
          </h2>
          <p className="mt-1 text-xs text-sage-500">
            Pilih menu yang ingin kamu tampilkan dalam Flash Sale.
          </p>
        </div>

        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold',
            isBasic ? 'bg-caramel/15 text-charcoal-900' : 'bg-sage-100 text-charcoal-900'
          )}
        >
          {isBasic && <Lock className="h-3 w-3" />}
          {pillText}
        </span>
      </div>

      {isBasic && (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-sage-100 bg-cream-50 p-4 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-100 text-charcoal-500">
            <Lock className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center rounded-full bg-caramel/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal-900">
              Fitur Premium
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-sage-500">
              Upgrade paket untuk menambahkan produk ke Flash Sale.
            </p>
          </div>
          <Link
            href="/dashboard/penjual/langganan"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-caramel"
          >
            <Crown className="h-3.5 w-3.5" />
            Lihat Paket
          </Link>
        </div>
      )}
    </Card>
  );
}

export default function MenuSayaPage() {
  const { plan } = useSellerPlan();
  const { storeId, storeSlug } = useSellerStatus();
  const storeKey = storeSlug ?? storeId ?? '';
  const {
    products,
    loading: productsLoading,
    error: productsError,
    refresh: refreshProducts,
  } = useStoreProducts(storeKey);
  const flashQuota = getFlashQuota(plan);
  const flashUsed = countFlashSaleProducts(products);

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SellerProduct | null>(
    null,
  );

  const [, setStatusTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setStatusTick((tick) => tick + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!quotaBlocked) return;
    const timeout = window.setTimeout(() => setQuotaBlocked(false), 4_000);
    return () => window.clearTimeout(timeout);
  }, [quotaBlocked]);

  const isLimitReached =
    plan.maxProducts !== null && products.length >= plan.maxProducts;

  return (
    <SellerShell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <h1 className="mt-1 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-medium leading-tight tracking-[-0.02em] text-primary">
          Menu Saya
        </h1>
      </motion.div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-charcoal-900">
            Daftar menu toko ({products.length})
          </p>
          {isLimitReached ? (
            plan.upgradeSlug && (
              <Link
                href={`/langganan/pembayaran?plan=${plan.upgradeSlug}&billing=monthly`}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-caramel"
              >
                <Lock className="h-3.5 w-3.5" />
                Naikkan kuota via upgrade
              </Link>
            )
          ) : (
            <Link
              href="/dashboard/penjual/tambahMenu"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-caramel"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Menu
            </Link>
          )}
        </div>

        <ProductLimitMeter products={products} />

        {isLimitReached && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-caramel/15 px-3 py-2 text-[11px] font-medium text-charcoal-900">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-caramel-dark" />
            Batas produk tercapai ({products.length}/{plan.maxProducts}). Hapus salah satu
            menu atau upgrade paket untuk menambah lagi.
          </p>
        )}
      </Card>

      <FlashSaleSectionHeader plan={plan} quota={flashQuota} used={flashUsed} />

      {quotaBlocked && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-caramel/15 px-3 py-2 text-[11px] font-medium text-charcoal-900">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          {flashQuota === 0
            ? 'Fitur Flash Sale tersedia mulai dari paket Standar. Upgrade paket untuk menambahkan produk ke Flash Sale.'
            : 'Paket Standar hanya dapat memasukkan 1 produk ke Flash Sale.'}
        </p>
      )}

      { }
      {productsLoading ? (
        <div className="mt-6 grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              aria-hidden
              className="h-72 animate-pulse rounded-2xl bg-white shadow-sm shadow-primary/5"
            />
          ))}
        </div>
      ) : productsError ? (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-sage-100 bg-white p-5 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-100 text-charcoal-500">
            <XCircle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-charcoal-900">
              Daftar menu gagal dimuat
            </p>
            <p className="mt-1 text-xs leading-relaxed text-sage-500">
              {productsError} Coba lagi untuk memuat menu tokomu.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshProducts}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-caramel"
          >
            Coba Lagi
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-sage-100 bg-white p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cream-50 text-primary shadow-sm">
            <Utensils className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-bold text-charcoal-900">Belum ada menu</p>
            <p className="mt-1 text-xs leading-relaxed text-sage-500">
              Menu yang kamu tambahkan akan tampil di sini dan langsung muncul
              di halaman Detail Toko.
            </p>
          </div>
          {!isLimitReached && (
            <Link
              href="/dashboard/penjual/tambahMenu"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-caramel"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Menu
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <MenuCard
              key={product.id}
              product={product}
              flashQuota={flashQuota}
              flashUsed={flashUsed}
              onUpgradeClick={() => setUpgradeOpen(true)}
              onQuotaBlocked={() => setQuotaBlocked(true)}
              onEdit={() => setEditingProduct(product)}
            />
          ))}
        </div>
      )}

      <EditProductModal
        product={editingProduct}
        open={editingProduct !== null}
        onClose={() => setEditingProduct(null)}
      />

      { }
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-sage-100 bg-white p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-medium tracking-tight text-primary">
              Flash Sale belum tersedia
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-sage-500">
              Fitur Flash Sale tersedia mulai dari paket Standar. Upgrade paket untuk
              menampilkan produkmu di Flash Sale.
            </DialogDescription>
          </DialogHeader>
          <Link
            href="/dashboard/penjual/langganan"
            onClick={() => setUpgradeOpen(false)}
            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-caramel"
          >
            <Crown className="h-3.5 w-3.5" />
            Lihat Paket
          </Link>
        </DialogContent>
      </Dialog>
    </SellerShell>
  );
}
