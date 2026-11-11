"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, MapPin, Pencil, Plus, ArrowLeft } from "lucide-react";
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
import type { DeliveryAddress } from "@/lib/types";

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

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (address: DeliveryAddress) => {
    setEditing(address);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
        <div className="mt-6 space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header: rata kiri; tombol di kanan */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 font-secondary text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Beranda
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.01em] text-foreground sm:text-3xl">
            Alamat Pengiriman
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola alamat yang dipakai untuk pesanan diantar.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-xl hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Tambah Alamat
        </button>
      </div>

      {/* Daftar alamat */}
      <div className="mt-6">
        {addresses.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-primary/30 px-6 py-8 text-left transition-colors hover:border-primary">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPin className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Belum ada alamat tersimpan
              </p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Tambahkan alamat pengiriman agar pesanan bisa diantar. Alamat
                juga bisa ditambahkan otomatis saat checkout pertama.
              </p>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Tambah Alamat Pertama
            </button>
          </div>
        ) : (
          <ul className="grid gap-3">
            {addresses.map((address) => {
              const isSelected = address.id === selectedAddressId;
              return (
                <li key={address.id}>
                  <div
                    className={`flex flex-col gap-3 rounded-2xl border-2 p-4 transition-all duration-200 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-5 ${
                      isSelected
                        ? "border-primary bg-primary/[0.04] shadow-[0_10px_30px_-18px_rgba(27,77,50,0.5)]"
                        : "border-border bg-white hover:border-primary/40 hover:shadow-md"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          {address.label}
                        </span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[10px] font-semibold text-white">
                            <Check className="h-3 w-3" aria-hidden />
                            Utama
                          </span>
                        )}
                      </div>
                      <p className="mt-2.5 text-sm font-semibold text-foreground">
                        {address.receiverName}
                        {address.phone ? (
                          <span className="ml-2 font-normal text-muted-foreground">
                            · {address.phone}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {formatFullAddress(address)}
                      </p>
                      {address.note && (
                        <p className="mt-1.5 text-xs italic leading-relaxed text-muted-foreground">
                          Catatan: {address.note}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      {!isSelected ? (
                        <button
                          type="button"
                          onClick={() => selectAddress(address.id)}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-primary/40 px-4 text-xs font-semibold text-primary transition-all duration-200 hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          Jadikan Utama
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openEdit(address)}
                        aria-label={`Ubah alamat ${address.label}`}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-4 text-xs font-semibold text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Ubah
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Popup form tambah/ubah alamat (bottom-sheet di mobile, modal di desktop) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto bg-white p-6 sm:p-7">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold text-primary">
              {editing ? "Ubah Alamat" : "Tambah Alamat Baru"}
            </DialogTitle>
            <DialogDescription className="font-secondary text-sm text-muted-foreground">
              Alamat aktif dipakai untuk pengantaran pesanan.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <AddressFormView
              key={editing?.id ?? "baru"}
              editing={editing}
              onDone={() => setDialogOpen(false)}
              addAddress={addAddress}
              updateAddress={updateAddress}
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
