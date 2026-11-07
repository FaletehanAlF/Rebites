'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
interface ShippingInfoSectionProps {
    idPrefix: 'menu' | 'edit-product';
    weightRaw: string;
    lengthRaw: string;
    widthRaw: string;
    heightRaw: string;
    onWeightChange: (next: string) => void;
    onLengthChange: (next: string) => void;
    onWidthChange: (next: string) => void;
    onHeightChange: (next: string) => void;
    isDelivery: boolean;
    variant?: 'add' | 'edit';
}
export function ShippingInfoSection({ idPrefix, weightRaw, lengthRaw, widthRaw, heightRaw, onWeightChange, onLengthChange, onWidthChange, onHeightChange, isDelivery, variant = 'add', }: ShippingInfoSectionProps) {
    const [showDimensions, setShowDimensions] = useState(false);
    const isEdit = variant === 'edit';
    const inputCls = isEdit
        ? 'w-full rounded-lg border border-sage-200 bg-white px-3 py-2 text-sm text-charcoal-900 outline-none placeholder:text-sage-500 focus:border-primary focus:ring-2 focus:ring-primary/20'
        : 'w-full rounded-xl border border-sage-100 bg-white px-4 py-3 pr-16 text-sm text-charcoal-900 placeholder:text-sage-500 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';
    const dimInputCls = isEdit
        ? 'w-full rounded-lg border border-sage-200 bg-white px-3 py-2 text-sm text-charcoal-900 outline-none placeholder:text-sage-500 focus:border-primary focus:ring-2 focus:ring-primary/20'
        : 'w-full rounded-xl border border-sage-100 bg-white px-4 py-3 pr-14 text-sm text-charcoal-900 placeholder:text-sage-500 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';
    const labelCls = isEdit
        ? 'mb-1 block text-[10px] font-semibold uppercase tracking-wider text-charcoal-900'
        : 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-900';
    return (<div>
      <div className="flex items-start gap-2.5">
        <span aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-xl bg-sage-100 text-primary', isEdit ? 'h-8 w-8' : 'h-9 w-9')}>
          <Truck className={isEdit ? 'h-4 w-4' : 'h-[18px] w-[18px]'}/>
        </span>
        <div className="min-w-0">
          <h3 className={cn('font-semibold text-charcoal-900', isEdit ? 'text-sm' : 'text-sm')}>
            Informasi Pengiriman
          </h3>
          <p className={cn('mt-0.5 leading-relaxed text-sage-500', isEdit ? 'text-[11px]' : 'text-xs')}>
            Isi berat agar ongkir lebih akurat. Bila dikosongkan, kami memakai
            perkiraan berat dari kategori menu.
          </p>
        </div>
      </div>

      <div className={isEdit ? 'mt-3' : 'mt-4'}>
        <label htmlFor={`${idPrefix}-weight`} className={labelCls}>
          Berat makanan
        </label>
        <div className="relative">
          <input id={`${idPrefix}-weight`} type="text" inputMode="numeric" value={weightRaw} onChange={(event) => onWeightChange(event.target.value)} placeholder="Contoh: 500" className={inputCls} autoComplete="off"/>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-sage-500">
            gram
          </span>
        </div>
        <p className={cn('text-sage-500', isEdit ? 'mt-1 text-[11px]' : 'mt-1.5 text-[11px]')}>
          {isDelivery
            ? 'Opsional. Tanpa berat, pembeli melihat ongkir perkiraan dan bisa memilih Diantar.'
            : 'Ambil sendiri aktif — berat belum dibutuhkan. Isi jika ingin mengaktifkan Diantar.'}
        </p>
      </div>

      <div className={isEdit ? 'mt-2' : 'mt-3'}>
        <button type="button" onClick={() => setShowDimensions((prev) => !prev)} aria-expanded={showDimensions} aria-controls={`${idPrefix}-dimensions`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:text-caramel">
          {showDimensions ? (<ChevronUp className="h-3.5 w-3.5"/>) : (<ChevronDown className="h-3.5 w-3.5"/>)}
          Dimensi paket (opsional)
        </button>
        <p className={cn('mt-1 text-sage-500', isEdit ? 'text-[11px]' : 'text-[11px]')}>
          Hanya isi jika tahu ukuran paket. Tidak wajib.
        </p>

        {showDimensions && (<div id={`${idPrefix}-dimensions`} className={cn('grid grid-cols-1 gap-4', isEdit ? 'mt-2 sm:grid-cols-3' : 'mt-3 sm:grid-cols-3')}>
            <div>
              <label htmlFor={`${idPrefix}-length`} className={labelCls}>
                Panjang
              </label>
              <div className="relative">
                <input id={`${idPrefix}-length`} type="text" inputMode="decimal" value={lengthRaw} onChange={(event) => onLengthChange(event.target.value)} placeholder="Contoh: 20" className={dimInputCls} autoComplete="off"/>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-sage-500">
                  cm
                </span>
              </div>
            </div>
            <div>
              <label htmlFor={`${idPrefix}-width`} className={labelCls}>
                Lebar
              </label>
              <div className="relative">
                <input id={`${idPrefix}-width`} type="text" inputMode="decimal" value={widthRaw} onChange={(event) => onWidthChange(event.target.value)} placeholder="Contoh: 15" className={dimInputCls} autoComplete="off"/>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-sage-500">
                  cm
                </span>
              </div>
            </div>
            <div>
              <label htmlFor={`${idPrefix}-height`} className={labelCls}>
                Tinggi
              </label>
              <div className="relative">
                <input id={`${idPrefix}-height`} type="text" inputMode="decimal" value={heightRaw} onChange={(event) => onHeightChange(event.target.value)} placeholder="Contoh: 10" className={dimInputCls} autoComplete="off"/>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-sage-500">
                  cm
                </span>
              </div>
            </div>
          </div>)}
      </div>
    </div>);
}
