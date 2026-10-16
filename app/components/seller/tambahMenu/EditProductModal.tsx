'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronDown, ChevronUp, ImagePlus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartImage } from '@/app/components/shared/SmartImage';
import {
  patchSellerProduct,
  uploadProductImage,
  type SellerProduct,
} from '@/lib/product-storage';
import { MENU_CATEGORIES } from './types';
import { NumberField } from './NumberField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';

const labelClass =
  'mb-1 block text-[10px] font-semibold uppercase tracking-wider text-foreground';
const inputClass =
  'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-muted'
        )}
      >
        <span
          className={cn(
            'absolute h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all',
            checked ? 'left-[1.25rem]' : 'left-0.5'
          )}
        />
      </button>
    </div>
  );
}

export function EditProductModal({
  product,
  open,
  onClose,
}: {
  product: SellerProduct | null;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [category, setCategory] = useState<string>('');
  const [surplusPrice, setSurplusPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [description, setDescription] = useState('');
  const [normalPrice, setNormalPrice] = useState(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [allDay, setAllDay] = useState(false);
  const [isSurplusToday, setIsSurplusToday] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !product) return;
    setName(product.name);
    setImage(product.image);
    setCategory(product.category);
    setSurplusPrice(product.surplusPrice);
    setStock(product.stock);
    setDescription(product.description ?? '');
    setNormalPrice(product.originalPrice);
    setStartTime(product.startTime || '09:00');
    setEndTime(product.endTime || '17:00');
    setAllDay(product.allDay ?? false);
    setIsSurplusToday(product.isSurplusToday);
    setShowAdvanced(false);
    setError('');
  }, [open, product]);

  if (!product) return null;

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran gambar maksimal 2MB.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSave = async () => {
    if (saving) return;
    setError('');
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nama menu tidak boleh kosong.');
      return;
    }
    if (!category) {
      setError('Kategori tidak boleh kosong.');
      return;
    }
    if (typeof surplusPrice !== 'number' || Number.isNaN(surplusPrice) || surplusPrice < 0) {
      setError('Harga jual harus berupa angka dan tidak boleh negatif.');
      return;
    }
    if (!Number.isFinite(normalPrice) || normalPrice < 0) {
      setError('Harga normal tidak boleh negatif.');
      return;
    }

    setSaving(true);
    try {
      
      let finalImage = image;
      if (image.startsWith('data:image')) {
        try {
          const res = await fetch(image);
          const blob = await res.blob();
          finalImage =
            (await uploadProductImage(blob, `menu-${Date.now()}.jpg`)) ?? image;
        } catch {
          setError('Upload foto gagal. Coba lagi atau pilih foto lain.');
          return;
        }
      }

      const nextStock = Math.max(0, Math.floor(stock) || 0);
      const discountPercent =
        normalPrice > 0
          ? Math.max(
              0,
              Math.round((1 - Math.max(0, surplusPrice) / normalPrice) * 100)
            )
          : 0;
      const updated = await patchSellerProduct(product.id, {
        name: trimmedName,
        image: finalImage || '/foods/ikansayur.jpg',
        category,
        surplusPrice: Math.max(0, surplusPrice),
        stock: nextStock,
        description,
        originalPrice: normalPrice,
        startTime,
        endTime,
        allDay,
        isSurplusToday,
        discountPercent,
      });

      if (!updated) {
        setError(
          'Perubahan gagal disimpan. Pastikan menu ini milik tokomu lalu coba lagi.'
        );
        return;
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        handle
        className="max-h-[88vh] max-w-md overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl sm:p-6"
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="font-display text-lg font-semibold tracking-tight text-primary">
            Edit Menu
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            Ubah informasi utama menu. Field lain tersedia di “Edit lebih lanjut”.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="edit-product-name" className={labelClass}>
              Nama Produk
            </label>
            <input
              id="edit-product-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Nama menu"
            />
          </div>

          <div>
            <span className={labelClass}>Foto Produk</span>
            <div className="flex items-center gap-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                {image ? (
                  <SmartImage src={image} alt={`Foto ${product.name}`} />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Camera className="h-5 w-5" />
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary-dark/20 hover:text-primary"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Ganti Foto
                </button>
                {image && (
                  <button
                    type="button"
                    onClick={() => setImage('')}
                    className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </button>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFile}
            />
          </div>

          <div>
            <label htmlFor="edit-product-category" className={labelClass}>
              Kategori
            </label>
            <select
              id="edit-product-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={cn(inputClass, 'appearance-none')}
            >
              {MENU_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              {/* Fallback untuk produk lama yang kategorinya belum termasuk 8 kategori baru */}
              {category && !(MENU_CATEGORIES as readonly string[]).includes(category) && (
                <option value={category}>{category} (lama)</option>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="edit-product-price"
              label="Harga Jual"
              value={surplusPrice}
              onChange={setSurplusPrice}
              step={1000}
            />
            <NumberField
              id="edit-product-stock"
              label="Stok"
              value={stock}
              onChange={setStock}
              unitLabel="porsi"
            />
          </div>

          <div className="rounded-xl bg-secondary p-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              aria-expanded={showAdvanced}
              className="flex w-fit items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:text-primary"
            >
              {showAdvanced ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {showAdvanced ? 'Sembunyikan detail lanjutan' : 'Edit lebih lanjut'}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4 rounded-xl border border-border bg-white p-3">
                <NumberField
                  id="edit-product-normalprice"
                  label="Harga Normal"
                  value={normalPrice}
                  onChange={setNormalPrice}
                  step={1000}
                />

                <div>
                  <label htmlFor="edit-product-description" className={labelClass}>
                    Deskripsi
                  </label>
                  <textarea
                    id="edit-product-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className={cn(inputClass, 'resize-none')}
                    placeholder="Deskripsi menu"
                  />
                </div>

                <ToggleSwitch
                  checked={allDay}
                  onChange={setAllDay}
                  label="Tersedia sepanjang hari"
                />

                {!allDay && (
                  <div>
                    <span className={labelClass}>Jam Jual</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="h-9 flex-1 rounded-xl border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="h-9 flex-1 rounded-xl border border-border bg-white px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                )}

                <ToggleSwitch
                  checked={isSurplusToday}
                  onChange={setIsSurplusToday}
                  label="Tandai sebagai surplus hari ini"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-destructive/10 px-2.5 py-1.5 text-[11px] font-medium text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center whitespace-nowrap rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center whitespace-nowrap rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
