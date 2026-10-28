'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { DeliveryAddress } from '@/lib/types';
import { useCheckout } from './checkout-context';
import { AddressFormView } from './address-form-view';

const EASE = [0.22, 1, 0.36, 1] as const;

type PopupView = 'list' | 'form';

function formatFullAddress(address: DeliveryAddress) {
  return [
    address.fullAddress,
    address.district,
    address.city,
    address.province,
    // tampilkan kode pos jika ada; alamat lama tanpa postal tetap tampil.
    address.postalCode ?? null,
  ]
    .filter(Boolean)
    .join(', ');
}

export function DeliveryAddressSection() {
  const {
    fulfillment,
    addresses,
    selectedAddress,
    selectedAddressId,
    selectAddress,
  } = useCheckout();

  const [popupOpen, setPopupOpen] = useState(false);
  const [view, setView] = useState<PopupView>('list');
  const [editing, setEditing] = useState<DeliveryAddress | null>(null);
  const [returnToList, setReturnToList] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const openPopup = (
    nextView: PopupView,
    address: DeliveryAddress | null,
    fromList: boolean,
  ) => {
    window.clearTimeout(closeTimer.current);
    setEditing(address);
    setReturnToList(fromList);
    setView(nextView);
    setPopupOpen(true);
  };

  const closePopup = (open: boolean) => {
    if (open) return;
    window.clearTimeout(closeTimer.current);
    setPopupOpen(false);
  };

  const handleSelect = (id: string) => {
    if (id === selectedAddressId) {
      setPopupOpen(false);
      return;
    }
    selectAddress(id);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPopupOpen(false), 200);
  };

  const handleFormDone = () => {
    if (returnToList) {
      setEditing(null);
      setView('list');
    } else {
      setPopupOpen(false);
    }
  };

  return (
    <>
      <AnimatePresence initial={false}>
        {fulfillment === 'delivery' && (
          <motion.section
            key="delivery-address"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
            aria-label="Alamat pengiriman"
          >
            <div className="rounded-2xl border border-sage-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-medium text-charcoal-900">
                  Alamat Pengiriman
                </h3>
                {selectedAddress && (
                  <button
                    type="button"
                    onClick={() => openPopup('form', null, false)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-cream-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Alamat Baru
                  </button>
                )}
              </div>

              {selectedAddress ? (
                <div className="mt-4 rounded-2xl border-2 border-primary bg-primary/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                      {selectedAddress.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => openPopup('form', selectedAddress, false)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-caramel/10"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Ubah
                    </button>
                  </div>

                  <p className="mt-3 text-sm font-semibold text-charcoal-900">
                    {selectedAddress.receiverName}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-charcoal-500">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-sage-500" />
                    {selectedAddress.phone}
                  </p>
                  <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-relaxed text-charcoal-500">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sage-500" />
                    {formatFullAddress(selectedAddress)}
                  </p>
                  {selectedAddress.note && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs italic leading-relaxed text-sage-600">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      “{selectedAddress.note}”
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => openPopup('list', null, false)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-caramel hover:text-white"
                  >
                    Pilih Alamat Lain
                    {addresses.length > 1 && (
                      <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-bold tabular-nums">
                        {addresses.length}
                      </span>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openPopup('form', null, false)}
                  className="mt-4 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-sage-500/50 px-6 py-8 text-center transition-colors hover:border-caramel hover:bg-caramel/[0.03]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sage-100 text-primary">
                    <Plus className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-charcoal-900">
                    Tambah Alamat Baru
                  </span>
                  <span className="text-xs text-charcoal-500">
                    Isi alamat pengiriman agar pesanan bisa diantar
                  </span>
                </button>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      { }
      <Dialog open={popupOpen} onOpenChange={closePopup}>
        <DialogContent handle className="sm:max-w-md">
          {view === 'list' ? (
            <>
              <DialogHeader className="pr-10 text-left">
                <DialogTitle className="font-display text-xl font-semibold text-charcoal-900">
                  Pilih Alamat Pengiriman
                </DialogTitle>
                <DialogDescription className="text-sm text-charcoal-500">
                  Alamat yang dipilih akan dipakai untuk pesanan ini.
                </DialogDescription>
              </DialogHeader>

              { }
              <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
                {addresses.map((address) => {
                  const active = address.id === selectedAddressId;
                  return (
                    <div
                      key={address.id}
                      className={cn(
                        'flex items-start gap-3 rounded-2xl border-2 p-4 transition-all duration-200',
                        active
                          ? 'border-primary bg-primary/[0.05]'
                          : 'border-sage-100 bg-white',
                      )}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => handleSelect(address.id)}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
                            active ? 'border-primary' : 'border-sage-500/70',
                          )}
                        >
                          {active && (
                            <Check
                              className="h-3 w-3 text-primary"
                              strokeWidth={3}
                            />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-charcoal-500">
                              {address.label}
                            </span>
                            <span className="truncate text-sm font-semibold text-charcoal-900">
                              {address.receiverName}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-xs text-charcoal-500">
                            {formatFullAddress(address)}
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openPopup('form', address, true)}
                        aria-label={`Ubah alamat ${address.label}`}
                        className="shrink-0 rounded-full p-2 text-sage-500 transition-colors hover:bg-cream-100 hover:text-caramel"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => openPopup('form', null, true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sage-500/50 px-4 py-3.5 text-sm font-semibold text-primary transition-colors hover:border-caramel hover:bg-caramel/[0.03]"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Alamat Baru
                </button>
              </div>
            </>
          ) : (
            <AddressFormView
              key={editing?.id ?? 'baru'}
              editing={editing}
              onDone={handleFormDone}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
