"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { SellerShell } from "@/app/components/dashboard-penjual/SellerShell";
import { Card } from "@/app/components/dashboard-penjual/Card";
import { Skeleton } from "@/app/components/ui/skeleton";
import { RatingFilterChips } from "@/app/components/dashboard-penjual/RatingFilterChips";
import { RatingStars } from "@/app/components/dashboard-penjual/RatingStars";
import { StoreRatingCard } from "@/app/components/dashboard-penjual/StoreRatingCard";
import { getSellerUmkm } from "@/lib/product-storage";
import { getSellerReviews, REVIEWS_UPDATED_EVENT, type SellerReview, } from "@/lib/review-storage";
const POLL_INTERVAL_MS = 20000;
function formatReviewDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }
    catch {
        return iso;
    }
}
function ReviewItem({ review }: {
    review: SellerReview;
}) {
    return (<li className="flex gap-3 rounded-2xl border border-border bg-white p-4">

      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-bold text-muted-foreground">

        {review.authorAvatar ? (<img src={review.authorAvatar} alt={review.authorName} loading="lazy" decoding="async" className="h-full w-full object-cover"/>) : (review.authorName.slice(0, 2).toUpperCase())}

      </div>

      <div className="min-w-0 flex-1">

        <div className="flex flex-wrap items-center gap-2">

          <p className="text-sm font-semibold text-foreground">

            {review.authorName}

          </p>

          <RatingStars rating={review.rating}/>

          <span className="text-xs text-muted-foreground">

            · {formatReviewDate(review.createdAt)}

          </span>

        </div>

        <p className="mt-1 text-xs font-medium text-muted-foreground">

          {review.menuName || "Menu"} ·{" "}

          <span className="font-mono">#{review.orderCode}</span>

        </p>

        {review.comment ? (<p className="mt-2 break-words rounded-xl bg-secondary px-3 py-2 text-[13px] leading-relaxed text-foreground">

            {review.comment}

          </p>) : (<p className="mt-2 text-xs italic text-muted-foreground-400">Tanpa komentar</p>)}

      </div>

    </li>);
}
export default function UlasanPage() {
    const [storeName, setStoreName] = useState("");
    const [reviews, setReviews] = useState<SellerReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<number | "all">("all");
    const load = useCallback(async () => {
        setLoading(true);
        const data = await getSellerReviews();
        setReviews(data);
        setLoading(false);
    }, []);
    useEffect(() => {
        getSellerUmkm().then((umkm) => {
            if (umkm)
                setStoreName(umkm.businessName);
        });
        load();
        const onUpdate = () => load();
        window.addEventListener(REVIEWS_UPDATED_EVENT, onUpdate);
        const intervalId = setInterval(load, POLL_INTERVAL_MS);
        return () => {
            window.removeEventListener(REVIEWS_UPDATED_EVENT, onUpdate);
            clearInterval(intervalId);
        };
    }, [load]);
    const filtered = useMemo(() => {
        if (filter === "all")
            return reviews;
        return reviews.filter((r) => r.rating === filter);
    }, [reviews, filter]);
    const avg = useMemo(() => {
        if (reviews.length === 0)
            return 0;
        return (Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10);
    }, [reviews]);
    return (<SellerShell>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>

        

        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">

          <div className="min-w-0">

            <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.01em] text-primary">

              Ulasan Pelanggan

            </h1>

            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">

              Menampilkan {filtered.length} dari {reviews.length} ulasan untuk toko Anda.

            </p>

          </div>



          <div className="flex shrink-0 flex-wrap items-center gap-2">

            <RatingFilterChips value={filter} onChange={setFilter}/>

          </div>

        </header>



        <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-12">

          <div className="lg:col-span-4">

            <StoreRatingCard />

          </div>



          <div className="lg:col-span-8">

          {loading ? (<div role="status" aria-label="Memuat ulasan" className="space-y-3">

              {[0, 1, 2].map((i) => (<Skeleton key={i} className="h-24 rounded-2xl"/>))}

            </div>) : filtered.length === 0 ? (<Card className="flex flex-col items-center justify-center gap-4 py-14 text-center">

              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-primary">

                <MessageSquare className="h-6 w-6"/>

              </span>

              <div className="max-w-sm">

                <p className="text-sm font-bold text-foreground">

                  {reviews.length === 0
                ? "Belum ada ulasan"
                : "Tidak ada ulasan pada filter ini"}

                </p>

                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">

                  {reviews.length === 0
                ? "Ulasan pembeli akan muncul di sini setelah pesanan selesai dan pembeli memberi penilaian bintang & komentar."
                : "Coba pilih filter lain untuk melihat ulasan dengan rating berbeda."}

                </p>

              </div>

            </Card>) : (<ul className="space-y-3">

              {filtered.map((review) => (<ReviewItem key={review.id} review={review}/>))}

            </ul>)}

          </div>

        </div>

      </motion.div>

    </SellerShell>);
}
