"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  Home,
  MapPin,
  Pencil,
  Phone,
  Plus,
  School,
  StickyNote,
} from "lucide-react";
import { RequireAuth } from "@/app/components/auth/require-auth";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { AddressFormView } from "@/app/components/buyer/checkout/address-form-view";
import { useAddresses } from "@/hooks/buyer/use-addresses";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/app/components/ui/dialog";
import type { AddressLabel, DeliveryAddress } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABEL_ICONS: Record<AddressLabel, typeof Home> = {
  Rumah: Home,
  Kos: Building2,
  Sekolah: School,
  Lainnya: MapPin,
};

function formatFullAddress(address: DeliveryAddress) {
  return [
    address.fullAddress,
    address.district,
    address.city,
    address.province,
    address.postalCode ?? null,
  ]
    .filter(Boolean)
    .join(", ");
}

function AlamatContent() {
  const { addresses, selectedAddressId, selectAddress, addAddress, updateAddress, loading } = useAddresses();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryAddress | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (address: DeliveryAddress) => {
    setEditing(address);
    setDialogOpen(true);
  };
  const handleFormDone = (saved?: boolean) => {
    setDialogOpen(false);
    if (saved) {
      setFeedback(editing ? "Alamat berhasil diperbarui." : "Alamat berhasil ditambahkan.");
    }
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12 lg:pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Skeleton className="h-7 w-56" />
            <Skeleton className="mt-2.5 h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-11 w-64 rounded-xl" />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:gap-5">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12 lg:pt-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-primary">
            Alamat Pengiriman
          </h1>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Kelola alamat yang dipakai untuk pesanan diantar. Jadikan alamat utama aktif, atau tambahkan yang baru.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm"
            aria-live="polite"
          >
            <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />
            {addresses.length} alamat tersimpan
          </span>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Tambah Alamat
          </button>
        </div>
      </header>

      <div className="mt-5 lg:mt-6">
        {feedback && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm font-medium text-primary"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            {feedback}
          </div>
        )}

        {addresses.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/[0.05] via-white to-white px-6 py-10 sm:px-8">
            <div className="flex max-w-xl flex-col items-start gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary shadow-sm ring-1 ring-primary/15">
                <MapPin className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Belum ada alamat tersimpan
                </h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Tambahkan alamat pengiriman agar pesanan bisa diantar. Alamat juga bisa dibuat otomatis saat checkout pertama.
                </p>
              </div>
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Tambah Alamat Pertama
              </button>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
            {addresses.map((address) => {
              const isSelected = address.id === selectedAddressId;
              const LabelIcon = LABEL_ICONS[address.label] ?? MapPin;
              return (
                <li key={address.id} className="h-full">
                  <article
                    className={cn(
                      "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200",
                      isSelected
                        ? "border-primary/50 shadow-[0_18px_40px_-28px_rgba(27,77,50,0.45)] ring-1 ring-primary/15"
                        : "border-border shadow-sm hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_40px_-30px_rgba(27,77,50,0.35)]",
                    )}
                  >
                    {isSelected && (
                      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-primary" />
                    )}
                    <div className="flex flex-1 flex-col gap-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                              isSelected
                                ? "bg-primary text-white"
                                : "bg-primary/10 text-primary",
                            )}
                          >
                            <LabelIcon className="h-5 w-5" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {address.receiverName}
                            </p>
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                              {address.label}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                            <Check className="h-3 w-3" aria-hidden />
                            Utama
                          </span>
                        )}
                      </div>

                      {address.phone ? (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" aria-hidden />
                          {address.phone}
                        </p>
                      ) : null}

                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {formatFullAddress(address)}
                      </p>

                      {address.note && (
                        <p className="flex items-start gap-1.5 rounded-lg bg-muted/60 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
                          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>{address.note}</span>
                        </p>
                      )}

                      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
                        {!isSelected && (
                          <button
                            type="button"
                            onClick={() => selectAddress(address.id)}
                            className="inline-flex min-h-[42px] items-center rounded-xl border border-primary/40 px-4 text-xs font-semibold text-primary transition-all duration-200 hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            Jadikan Utama
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(address)}
                          aria-label={`Ubah alamat ${address.label}`}
                          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-border px-4 text-xs font-semibold text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Ubah
                        </button>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent handle className="max-h-[92dvh] overflow-y-auto bg-white p-6 sm:p-7">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold text-primary">
              {editing ? "Ubah Alamat" : "Tambah Alamat Baru"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Alamat aktif dipakai untuk pengantaran pesanan.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <AddressFormView
              key={editing?.id ?? "baru"}
              editing={editing}
              onDone={handleFormDone}
              addAddress={addAddress}
              updateAddress={updateAddress}
              showHeader={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function AlamatPage() {
  return (
    <RequireAuth>
      <BuyerShell>
        <AlamatContent />
      </BuyerShell>
    </RequireAuth>
  );
}
