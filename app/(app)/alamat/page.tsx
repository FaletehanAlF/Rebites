"use client";
import { useEffect, useState } from "react";
import { MapPin, Pencil, Plus } from "lucide-react";
import { RequireAuth } from "@/app/components/auth/require-auth";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { AddressFormView } from "@/app/components/checkout/address-form-view";
import { useAddresses } from "@/hooks/use-addresses";
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
    const { addresses, selectedAddressId, selectAddress, addAddress, updateAddress, loading, error: loadError, reload } = useAddresses();
    const [editing, setEditing] = useState<DeliveryAddress | null | "baru">(null);
    useEffect(() => {
        if (editing === null)
            return;
        const id = window.setTimeout(() => {
            document.getElementById("form-alamat")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
        return () => window.clearTimeout(id);
    }, [editing]);
    if (loading) {
        return (<main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
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
    return (<main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.01em] text-foreground">
            Alamat Pengiriman
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola alamat yang dipakai untuk pesanan diantar.
          </p>
        </div>
        <button type="button" onClick={() => setEditing("baru")} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark">
          <Plus className="h-4 w-4" aria-hidden/>
          Tambah Alamat
        </button>
      </div>

      {loadError ? (<div role="alert" className="mt-6 flex w-full flex-col items-start rounded-2xl border border-destructive/30 bg-destructive/[0.06] px-6 py-10">
          <p className="text-sm font-semibold text-foreground">
            Gagal memuat alamat
          </p>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            {loadError}
          </p>
          <button type="button" onClick={reload} className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark">
            Coba lagi
          </button>
        </div>) : addresses.length === 0 ? (<div className="mt-6 flex w-full flex-col items-start rounded-2xl border-2 border-dashed border-primary/30 px-6 py-10">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-primary">
            <MapPin className="h-6 w-6" aria-hidden/>
          </span>
          <p className="mt-4 text-sm font-semibold text-foreground">
            Belum ada alamat tersimpan
          </p>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            Klik tombol &quot;Tambah Alamat&quot; untuk menambahkan alamat
            pengiriman agar pesanan bisa diantar. Alamat juga tersimpan
            otomatis saat checkout pengiriman pertama.
          </p>
        </div>) : (<div className="mt-6 space-y-3">
          {addresses.map((address) => {
                const isSelected = address.id === selectedAddressId;
                return (<div key={address.id} className={`rounded-2xl border p-5 transition-colors ${isSelected
                        ? "border-primary bg-primary/[0.04]"
                        : "border-border bg-white"}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                    {address.label}
                  </span>
                  <button type="button" onClick={() => setEditing(address)} aria-label={`Ubah alamat ${address.label}`} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary-dark/10">
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
                  {!isSelected ? (<button type="button" onClick={() => selectAddress(address.id)} className="inline-flex min-h-[36px] items-center rounded-full border border-primary/40 px-4 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white">
                      Jadikan Alamat Utama
                    </button>) : (<span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-white">
                      Alamat Utama
                    </span>)}
                </div>
              </div>);
            })}
        </div>)}

      {editing !== null && (<div id="form-alamat" className="mt-6 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6" role="region" aria-labelledby="judul-form-alamat">
          <AddressFormView key={editing === "baru" ? "baru" : editing.id} editing={editing === "baru" ? null : editing} addAddress={addAddress} updateAddress={updateAddress} onDone={() => setEditing(null)}/>
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
