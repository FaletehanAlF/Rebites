'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, Lock, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/app/components/dashboard-penjual/Card';
import { Reveal } from '@/app/components/shared/reveal';
import {
  PRODUCTS_UPDATED_EVENT,
  getSellerProductCount,
  saveSellerProduct,
  uploadProductImage,
} from '@/lib/product-storage';
import { useSellerPlan } from '@/lib/seller-plan';
import { PhotoPicker } from './PhotoPicker';
import { MenuPreviewCard } from './MenuPreviewCard';
import { NumberField } from './NumberField';
import { ShippingInfoSection } from './ShippingInfoSection';
import { DEFAULT_MENU_FORM, MENU_CATEGORIES, parseShippingNumber } from './types';
import type { MenuFormState } from './types';

const inputCls =
  'w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground';

async function uploadDataUrl(dataUrl: string): Promise<string | null> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return await uploadProductImage(blob, `menu-${Date.now()}.jpg`);
  } catch {
    return null;
  }
}

function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
        {number}
      </span>
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
    </div>
  );
}

function FieldError() {
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 py-1.5 text-[11px] font-medium text-foreground">
      <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
      Nama menu wajib diisi sebelum disimpan
    </p>
  );
}

export function AddMenuForm() {
  const [form, setForm] = useState<MenuFormState>(DEFAULT_MENU_FORM);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedName, setSavedName] = useState('');
  const [saveError, setSaveError] = useState('');
  const [limitReached, setLimitReached] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productCount, setProductCount] = useState(0);
  // input package opsional sebagai teks mentah ('' = kosong = NULL).
  const [weightRaw, setWeightRaw] = useState('');
  const [lengthRaw, setLengthRaw] = useState('');
  const [widthRaw, setWidthRaw] = useState('');
  const [heightRaw, setHeightRaw] = useState('');
  const { plan } = useSellerPlan();

  const refreshCount = useCallback(() => {
    getSellerProductCount().then(setProductCount);
  }, []);

  useEffect(() => {
    refreshCount();
    window.addEventListener(PRODUCTS_UPDATED_EVENT, refreshCount);
    return () => {
      window.removeEventListener(PRODUCTS_UPDATED_EVENT, refreshCount);
    };
  }, [refreshCount]);

  const isQuotaFull =
    plan.maxProducts !== null && productCount >= plan.maxProducts;

  const set = <K extends keyof MenuFormState>(key: K, value: MenuFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    setTouched(true);
    if (!form.name.trim() || savingProduct) return;
    // minimal satu metode pengambilan harus aktif.
    if (!form.isDelivery && !form.isPickup) {
      setSaveError('Pilih minimal satu metode pengambilan: Diantar atau Ambil Sendiri.');
      return;
    }
    // dimensi boleh kosong (NULL); jika diisi harus angka positif.
    const weightParsed = parseShippingNumber(weightRaw);
    const lengthParsed = parseShippingNumber(lengthRaw);
    const widthParsed = parseShippingNumber(widthRaw);
    const heightParsed = parseShippingNumber(heightRaw);
    if (!weightParsed.ok || !lengthParsed.ok || !widthParsed.ok || !heightParsed.ok) {
      setSaveError('Berat dan dimensi harus berupa angka positif. Kosongkan jika belum tahu.');
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return;
    }
    // Berat wajib bila Diantar aktif: tanpa weight_gram server menolak
    // /api/shipping/rates (product_no_weight) dan checkout, sehingga toggle
    // Diantar hanya menjadi janji yang tidak bisa dipenuhi.
    if (form.isDelivery && weightParsed.value === null) {
      setSaveError(
        'Isi berat makanan (gram) agar pembeli bisa memilih Diantar. Atau matikan toggle Diantar.'
      );
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return;
    }

    setSaveError('');

    if (plan.maxProducts !== null && productCount >= plan.maxProducts) {
      setLimitReached(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSavingProduct(true);

    (async () => {
      let imageUrl = form.photo || '/foods/ikansayur.jpg';

      if (typeof form.photo === 'string' && form.photo.startsWith('data:image')) {
        const uploaded = await uploadDataUrl(form.photo);
        if (uploaded) imageUrl = uploaded;
      }

      const created = await saveSellerProduct({
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim(),
        image: imageUrl,
        originalPrice: form.normalPrice,
        surplusPrice: form.surplusPrice,
        discountPercent:
          form.normalPrice > 0
            ? Math.max(0, Math.round((1 - form.surplusPrice / form.normalPrice) * 100))
            : 0,
        stock: form.stock,
        startTime: form.startTime,
        endTime: form.endTime,
        isSurplusToday: form.isSurplusToday,
        featured: false,
        // kapabilitas fulfillment pilihan seller.
        isDelivery: form.isDelivery,
        isPickup: form.isPickup,
        // package opsional (NULL jika kosong, tanpa angka palsu).
        weightGram: weightParsed.value,
        lengthCm: lengthParsed.value,
        widthCm: widthParsed.value,
        heightCm: heightParsed.value,
      });

      setSavingProduct(false);
      if (!created) {
        setSaveError(
          'Menu gagal disimpan. Pastikan toko kamu sudah terdaftar dan koneksi stabil, lalu coba lagi.'
        );
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        return;
      }

      setSavedName(form.name.trim());
      setSaved(true);
      refreshCount();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    })();
  };

  const handleReset = () => {
    setForm(DEFAULT_MENU_FORM);
    setWeightRaw('');
    setLengthRaw('');
    setWidthRaw('');
    setHeightRaw('');
    setTouched(false);
    setSaved(false);
    setSaveError('');
    setLimitReached(false);
  };

  if (limitReached) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mx-auto mt-10 max-w-md"
      >
        <Card className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="mt-5 font-display text-2xl font-medium tracking-tight text-primary">
            Kuota Produk Penuh
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Paket {plan.label} membatasi{' '}
            <span className="font-bold text-foreground">
              {productCount}/{plan.maxProducts} produk
            </span>
            . Hapus salah satu menu di Menu Saya, atau upgrade ke{' '}
            {plan.tier === 'basic' ? 'ReBites Standar (5 produk)' : 'ReBites Max (15 produk)'}{' '}
            untuk menambah menu lagi.
          </p>
          <div className="mt-6 grid gap-3">
            {plan.upgradeSlug && (
              <Link
                href={`/langganan/pembayaran?plan=${plan.upgradeSlug}&billing=monthly`}
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark"
              >
                Lihat Paket Upgrade
              </Link>
            )}
            <Link
              href="/dashboard/penjual/menu"
              className="inline-flex w-full items-center justify-center rounded-full border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Kelola Menu Saya
            </Link>
          </div>
        </Card>
      </motion.div>
    );
  }

  if (saved) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mx-auto mt-10 max-w-md"
      >
        <Card className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30"
          >
            <CheckCircle2 className="h-8 w-8" />
          </motion.div>
          <h2 className="mt-5 font-display text-2xl font-medium tracking-tight text-primary">
            Menu Berhasil Ditambahkan
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {savedName} telah masuk ke daftar menu tokomu dan sudah aktif di
            marketplace.
          </p>
          <div className="mt-6 grid gap-3">
            <Link
              href="/dashboard/penjual/menu"
              className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark"
            >
              Lihat Menu Saya
            </Link>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex w-full items-center justify-center rounded-full border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Tambah Menu Lagi
            </button>
            <Link
              href="/dashboard/penjual"
              className="text-center text-xs font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      <Reveal className="lg:col-span-8">
        <Card>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
            className="space-y-8"
            noValidate
          >
            <section>
              <SectionTitle number="1" title="Foto Menu" />
              <PhotoPicker
                value={form.photo}
                onChange={(photo) => set('photo', photo)}
              />
            </section>

            <section>
              <SectionTitle number="2" title="Detail Menu" />
              <div className="space-y-4">
                <div>
                  <label htmlFor="menu-name" className={labelCls}>
                    Nama Menu
                  </label>
                  <input
                    id="menu-name"
                    type="text"
                    value={form.name}
                    onChange={(event) => set('name', event.target.value)}
                    placeholder="Contoh: Nasi Uduk Komplit"
                    className={inputCls}
                    autoComplete="off"
                  />
                  <AnimatePresence>
                    {touched && !form.name.trim() && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <FieldError />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label htmlFor="menu-category" className={labelCls}>
                    Kategori
                  </label>
                  <div className="relative">
                    <select
                      id="menu-category"
                      value={form.category}
                      onChange={(event) => set('category', event.target.value)}
                      className={cn(inputCls, 'appearance-none pr-10')}
                    >
                      {MENU_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                      –¼
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="menu-description" className={labelCls}>
                    Deskripsi
                  </label>
                  <textarea
                    id="menu-description"
                    rows={3}
                    value={form.description}
                    onChange={(event) => set('description', event.target.value)}
                    placeholder="Contoh: Nasi uduk hangat dengan ayam suwir, telur balado, dan sambal khas"
                    className={cn(inputCls, 'resize-none')}
                  />
                </div>
              </div>
            </section>

            <section>
              <SectionTitle number="3" title="Harga & Stok" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumberField
                  id="menu-normal-price"
                  label="Harga Normal"
                  value={form.normalPrice}
                  onChange={(v) => set('normalPrice', v)}
                  step={1000}
                />
                <NumberField
                  id="menu-surplus-price"
                  label="Harga Surplus"
                  value={form.surplusPrice}
                  onChange={(v) => set('surplusPrice', v)}
                  step={1000}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Harga diskon untuk porsi surplus hari ini.
              </p>

              <NumberField
                id="menu-stock"
                label="Porsi Tersedia"
                value={form.stock}
                onChange={(v) => set('stock', v)}
                unitLabel="porsi"
              />
            </section>

            <section>
              <SectionTitle number="4" title="Ketersediaan" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="menu-start-time" className={labelCls}>
                    Jam Mulai
                  </label>
                  <input
                    id="menu-start-time"
                    type="time"
                    value={form.startTime}
                    onChange={(event) => set('startTime', event.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="menu-end-time" className={labelCls}>
                    Jam Selesai
                  </label>
                  <input
                    id="menu-end-time"
                    type="time"
                    value={form.endTime}
                    onChange={(event) => set('endTime', event.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-secondary px-4 py-3.5">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Tampilkan sebagai surplus hari ini
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Pembeli bisa langsung memesan menu ini hari ini
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isSurplusToday}
                  onClick={() => set('isSurplusToday', !form.isSurplusToday)}
                  className={cn(
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                    form.isSurplusToday ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <motion.span
                    animate={{ x: form.isSurplusToday ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>
            </section>

            <section>
              <SectionTitle number="5" title="Metode Pengambilan" />
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-cream-50 px-4 py-3.5">
                  <div>
                    <p className="text-xs font-semibold text-charcoal-900">
                      Diantar
                    </p>
                    <p className="mt-0.5 text-[11px] text-sage-500">
                      Pembeli bisa memilih pengiriman ke alamat
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.isDelivery}
                    aria-label="Aktifkan pengiriman diantar"
                    onClick={() => set('isDelivery', !form.isDelivery)}
                    className={cn(
                      'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                      form.isDelivery ? 'bg-primary' : 'bg-sage-100'
                    )}
                  >
                    <motion.span
                      animate={{ x: form.isDelivery ? 20 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl bg-cream-50 px-4 py-3.5">
                  <div>
                    <p className="text-xs font-semibold text-charcoal-900">
                      Ambil Sendiri
                    </p>
                    <p className="mt-0.5 text-[11px] text-sage-500">
                      Pembeli mengambil langsung di toko
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.isPickup}
                    aria-label="Aktifkan ambil sendiri"
                    onClick={() => set('isPickup', !form.isPickup)}
                    className={cn(
                      'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                      form.isPickup ? 'bg-primary' : 'bg-sage-100'
                    )}
                  >
                    <motion.span
                      animate={{ x: form.isPickup ? 20 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                    />
                  </button>
                </div>
                <p className="text-[11px] text-sage-500">
                  Minimal satu metode harus aktif.
                </p>
              </div>
            </section>

            <section>
              <SectionTitle number="6" title="Informasi Pengiriman" />
              <ShippingInfoSection
                idPrefix="menu"
                weightRaw={weightRaw}
                lengthRaw={lengthRaw}
                widthRaw={widthRaw}
                heightRaw={heightRaw}
                onWeightChange={setWeightRaw}
                onLengthChange={setLengthRaw}
                onWidthChange={setWidthRaw}
                onHeightChange={setHeightRaw}
                isDelivery={form.isDelivery}
                variant="add"
              />
            </section>

              {saveError && (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-[13px] font-medium text-destructive"
                >
                  {saveError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
              <Link
                href="/dashboard/penjual"
                className="inline-flex items-center justify-center rounded-full border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Batalkan
              </Link>
              <div className="flex flex-1 flex-col gap-2">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark"
                >
                  <Save className="h-4 w-4" />
                  Simpan Menu
                </button>
                <p className="text-center text-[11px] text-muted-foreground">
                  {plan.maxProducts !== null
                    ? `Kuota terpakai ${productCount}/${plan.maxProducts} produk · paket ${plan.label}`
                    : `Kuota produk tanpa batas · paket ${plan.label}`}
                </p>
              </div>
            </div>

            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Setelah disimpan, menu langsung tampil pada halaman menu tokomu dan berpotensi
              dipesan hari ini.
            </p>
          </form>
        </Card>
      </Reveal>

      <Reveal delay={0.1} className="lg:col-span-4">
        <MenuPreviewCard form={form} />
      </Reveal>
    </div>
  );
}
