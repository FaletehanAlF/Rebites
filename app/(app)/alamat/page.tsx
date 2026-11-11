"use client";
import { useState } from "react";
import Link from "next/link";
import { MapPin, Pencil, Plus } from "lucide-react";
import { RequireAuth } from "@/app/components/auth/require-auth";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { AddressFormView } from "@/app/components/buyer/checkout/address-form-view";
import { useAddresses } from "@/hooks/buyer/use-addresses";
import { Skeleton } from "@/app/components/ui/skeleton";
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
    const [editing, setEditing] = useState<DeliveryAddress | null | "baru">(null);
    if (loading) {
        return (<main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48"/>
          <Skeleton className="h-10 w-36 rounded-full"/>
        </div>
        <div className="mt-6 space-y-4">
          <Skeleton className="h-28 rounded-2xl"/>
          <Skeleton className="h-28 rounded-2xl"/>
        </div>
      </main>);
    }
    return (<main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-secondary text-xs text-muted-foreground">
            <Link href="/home" className="hover:text-primary">
              Beranda
            </Link>{" "}
            / Alamat
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em] text-foreground">
            Alamat Pengiriman
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola alamat yang dipakai untuk pesanan diantar.
          </p>
        </div>
        <button type="button" onClick={() => setEditing("baru")} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark">
          <Plus className="h-4 w-4" aria-hidden/>
          Tambah Alamat
        </button>
      </div>

      {addresses.length === 0 ? (<button type="button" onClick={() => setEditing("baru")} className="mt-6 flex w-full flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-primary/30 px-6 py-10 text-left transition-colors hover:border-primary hover:bg-primary-dark/[0.03]">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-primary">
            <MapPin className="h-6 w-6" aria-hidden/>
          </span>
          <span className="text-sm font-semibold text-foreground">
            Belum ada alamat tersimpan
          </span>
          <span className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            Tambahkan alamat pengiriman agar pesanan bisa diantar. Alamat
            ditambahkan secara otomatis saat checkout pengiriman pertama.
          </span>
          <span className="mt-1 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" aria-hidden/>
            Tambah Alamat Pertama
          </span>
        </button>) : (<div className="mt-6 space-y-3">
          {addresses.map((address) => {
                const isSelected = address.id === selectedAddressId;
                return (<div key={address.id} className={`rounded-2xl border p-5 transition-colors ${isSelected
                        ? "border-primary bg-primary/[0.04]"
                        : "border-border bg-white"}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center rounded-xl bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                    {address.label}
                  </span>
                  <button type="button" onClick={() => setEditing(address)} aria-label={`Ubah alamat ${address.label}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary-dark/10">
                    <Pencil className="h-3.5 w-3.5" aria-hidden/>
                    Ubah
                  </button>
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {address.receiverName}
                  <span className="ml-2 font-normal text-muted-foreground">
                    · {address.phone}
                  </span>
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {formatFullAddress(address)}
                </p>
                {address.note && (<p className="mt-2 text-xs italic leading-relaxed text-muted-foreground">
                    “{address.note}”
                  </p>)}
                <div className="mt-4 flex items-center gap-3">
                  {!isSelected ? (<button type="button" onClick={() => selectAddress(address.id)} className="inline-flex min-h-9 items-center rounded-xl border border-primary/40 px-4 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white">
                      Jadikan Alamat Utama
                    </button>) : (<span className="inline-flex items-center rounded-xl bg-primary px-3 py-1 text-[11px] font-semibold text-white">
                      Alamat Utama
                    </span>)}
                </div>
              </div>);
            })}
        </div>)}

      {editing !== null && (<div className="mt-6 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6" role="region" aria-label={editing === "baru" ? "Form alamat baru" : "Form ubah alamat"}>
          <AddressFormView key={editing === "baru" ? "baru" : editing.id} editing={editing === "baru" ? null : editing} onDone={() => setEditing(null)}/>
        </div>)}
    </main>);
}
export default function AlamatPage() {
    return (<RequireAuth>
      <BuyerShell>
        <AlamatContent />
      </BuyerShell>
    </RequireAuth>);
}
