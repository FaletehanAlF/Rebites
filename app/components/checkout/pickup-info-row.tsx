"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, MapPin, Navigation, Store } from "lucide-react";
import { PICKUP_READY_ESTIMATE } from "@/lib/useOrderCalculation";
import { fetchVendors } from "@/lib/catalog";
import type { Vendor } from "@/lib/types";
import { useCheckout } from "./checkout-context";
const EASE = [0.22, 1, 0.36, 1] as const;
export function PickupInfoCard() {
    const { draft, fulfillment } = useCheckout();
    const [vendors, setVendors] = useState<Vendor[]>([]);
    useEffect(() => {
        fetchVendors().then(setVendors);
    }, []);
    const vendor = vendors.find((item) => item.id === draft.vendorSlug);
    return (<AnimatePresence initial={false}>

      {fulfillment === "pickup" && (<motion.section key="pickup-info" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden" aria-label="Informasi pengambilan pesanan">

          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">

            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">

              Ambil pesanan di toko

            </p>



            <div className="mt-4 flex items-start gap-3">

              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">

                <Store className="h-5 w-5"/>

              </span>

              <div className="min-w-0">

                <h4 className="font-display text-lg font-semibold leading-snug text-foreground">

                  {vendor?.name ?? draft.vendorName}

                </h4>

                <p className="mt-0.5 flex items-start gap-1 text-sm leading-relaxed text-muted-foreground">

                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/>

                  {draft.pickupLocation}

                  

                  {typeof draft.distanceKm === 'number' && (<> · {draft.distanceKm} km</>)}

                </p>

                {vendor?.openHours && (<p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">

                    <Clock className="h-3.5 w-3.5 text-muted-foreground"/>

                    Jam operasional {vendor.openHours}

                  </p>)}

              </div>

            </div>



            <div className="mt-4 rounded-xl bg-primary/[0.05] px-4 py-3">

              <p className="text-xs font-medium text-muted-foreground">

                Pesanan siap diambil

              </p>

              <p className="mt-0.5 flex items-baseline gap-2 text-sm font-semibold text-foreground">

                {PICKUP_READY_ESTIMATE}

                <span className="text-xs font-normal text-muted-foreground">

                  ({draft.pickupTime.from} – {draft.pickupTime.to})

                </span>

              </p>

            </div>



            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">

              Kamu dapat mengambil pesanan langsung di toko pada waktu yang

              tertera di atas. Tunjukkan detail pembayaran kepada

              mitra untuk menerima pesananmu.

            </p>



            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(draft.pickupLocation)}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary-dark hover:text-white">

              <Navigation className="h-3.5 w-3.5"/>

              Lihat Lokasi

            </a>

          </div>

        </motion.section>)}

    </AnimatePresence>);
}
