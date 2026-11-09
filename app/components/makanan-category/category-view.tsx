"use client";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, PackageOpen, } from "lucide-react";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { FoodCard } from "@/app/components/shared/FoodCard";
import { StoreClosedModal } from "@/app/components/shared/StoreClosedModal";
import { useStoreClosedModal } from "@/lib/store-closed-modal-store";
import { SmartImage } from "@/app/components/shared/SmartImage";
import { FoodCardSkeleton } from "@/app/components/shared/FoodCardSkeleton";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/lib/catalog";
import { getCategoryBySlug } from "@/lib/categories";
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const EASE: [
    number,
    number,
    number,
    number
] = [0.22, 1, 0.36, 1];
export default function CategoryView({ slug, name, }: {
    slug: string;
    name: string;
}) {
    const category = getCategoryBySlug(slug);
    const description = category?.description ??
        "Temukan makanan berlebih yang masih layak dinikmati di sekitarmu.";
    const categoryImage = category?.image;
    const [status, setStatus] = useState<"loading" | "ready">("loading");
    const router = useRouter();
    const storeClosedModal = useStoreClosedModal();
    const { foodItems, loading: catalogLoading, error: catalogError, refresh: refreshCatalog } = useCatalog();
    useEffect(() => {
        if (!catalogLoading)
            setStatus("ready");
    }, [catalogLoading]);
    const categoryItems = useMemo(() => foodItems.filter((item) => item.category === name), [name, foodItems]);
    const handleViewDetail = (id: string) => {
        router.push(`/detail/product?id=${encodeURIComponent(id)}`);
    };
    const handleBack = () => {
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
        }
        else {
            router.push("/home");
        }
    };
    const isLoading = status === "loading";
    const isCategoryEmpty = !isLoading && categoryItems.length === 0;
    return (<BuyerShell>

    <div className="flex min-h-screen flex-col bg-secondary">

      <main className="flex-1">

        

        <section className="relative overflow-hidden">

          

          {categoryImage && (<div className="absolute inset-0">

              <SmartImage src={categoryImage} alt={`Foto kategori ${name}`} sizes="100vw" className="object-cover" priority/>

              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-secondary"/>

            </div>)}



          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            

            <div className="pt-6">

              <button type="button" onClick={handleBack} className={cn("inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-md transition-all duration-200 hover:border-white/40 hover:bg-white/25 active:scale-[0.98]", FOCUS_RING)}>

                <ArrowLeft className="h-4 w-4" aria-hidden/>

                Kembali

              </button>

            </div>



            

            <header className="mt-6 max-w-2xl pb-12 sm:pb-16 lg:pb-20">

              <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>

                {name}

              </h1>

              <p className="mt-3 text-sm leading-relaxed text-white/90 sm:text-base" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.25)" }}>

                {description}

              </p>



              

              <div className="mt-5 flex flex-wrap items-center gap-3">

                <span aria-live="polite" className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">

                  <span className="h-1.5 w-1.5 rounded-full bg-primary"/>

                  {isLoading
            ? "Memuat…"
            : `${categoryItems.length} makanan tersedia`}

                </span>

              </div>

            </header>

          </div>

        </section>



        

        <section className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:px-8">

          {isLoading ? (<div role="status" aria-label="Memuat makanan" className="grid grid-cols-2 gap-4 md:grid-cols-3 sm:gap-5 xl:grid-cols-4">

              {Array.from({ length: 8 }).map((_, index) => (<FoodCardSkeleton key={index}/>))}

            </div>) : catalogError ? (<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} role="alert" className="flex flex-col items-center rounded-3xl border border-destructive/30 bg-destructive/[0.06] px-6 py-20 text-center">

              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <PackageOpen className="h-8 w-8 text-muted-foreground" aria-hidden/>
              </span>

              <h2 className="mt-5 font-display text-xl font-bold text-foreground">
                Gagal memuat makanan
              </h2>

              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {catalogError}
              </p>

              <button type="button" onClick={() => void refreshCatalog()} className={cn("mt-8 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-dark active:scale-[0.98]", FOCUS_RING)}>
                Coba lagi
              </button>

            </motion.div>) : isCategoryEmpty ? (<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-white px-6 py-20 text-center">

              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">

                <PackageOpen className="h-8 w-8 text-muted-foreground" aria-hidden/>

              </span>

              <h2 className="mt-5 font-display text-xl font-bold text-foreground">

                Belum ada makanan di kategori ini

              </h2>

              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">

                Coba pilih kategori lain atau cek kembali beberapa saat lagi.

              </p>

            </motion.div>) : (<motion.div key={slug} initial="hidden" animate="visible" variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.05 } },
            }} className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">

              {categoryItems.map((item) => (<motion.div key={item.id} variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.4, ease: EASE },
                    },
                }}>

                  <FoodCard item={item} onViewDetail={handleViewDetail}/>

                </motion.div>))}

            </motion.div>)}

        </section>

      </main>






      <StoreClosedModal isOpen={storeClosedModal.isOpen} onClose={storeClosedModal.close} availableFrom={storeClosedModal.availableFrom} availableTo={storeClosedModal.availableTo}/>

    </div>

    </BuyerShell>);
}
