'use client';

import { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { Card } from './Card';
import { SalesEmptyState, CardLinesSkeleton } from './SalesEmptyState';
import { getSellerUmkm } from '@/lib/product-storage';
import { supabase } from '@/lib/supabase';
import { useSellerOrders } from '@/hooks/use-seller-orders';
import { REVIEWS_UPDATED_EVENT } from '@/lib/review-storage';

const POLL_INTERVAL_MS = 20_000; // 20 detik

export function StoreRatingCard() {
  const { hydrated } = useSellerOrders();
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [ratings, setRatings] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const umkm = await getSellerUmkm();
      if (!umkm) {
        if (!cancelled) {
          setRatings([]);
          setReviewsLoaded(true);
        }
        return;
      }
      const { data } = await supabase
        .from('reviews')
        .select('rating')
        .eq('umkm_id', umkm.id);
      if (!cancelled) {
        setRatings((data ?? []).map((row) => Number(row.rating ?? 0)));
        setReviewsLoaded(true);
      }
    };
    load();
    const onReview = () => load();
    window.addEventListener(REVIEWS_UPDATED_EVENT, onReview);
    // Polling ulasan dari pembeli lain juga terlihat tanpa reload
    const intervalId = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.removeEventListener(REVIEWS_UPDATED_EVENT, onReview);
      clearInterval(intervalId);
    };
  }, []);

  const reviews = useMemo(
    () => ratings.filter((rating) => rating >= 1 && rating <= 5),
    [ratings]
  );

  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((sum, review) => sum + review, 0);
    return Math.round((total / reviews.length) * 10) / 10;
  }, [reviews]);

  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const rating of reviews) {
      counts[rating - 1] = (counts[rating - 1] ?? 0) + 1;
    }
    return counts;
  }, [reviews]);

  const loading = !hydrated || !reviewsLoaded;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">Rating Toko</h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Penilaian pembeli
        </span>
      </div>

      <div className="mt-4">
        {loading ? (
          <CardLinesSkeleton />
        ) : reviews.length === 0 ? (
          <SalesEmptyState
            title="Belum ada rating"
            description="Rating dan ulasan pembeli akan muncul setelah ada pesanan yang diselesaikan di tokomu."
          />
        ) : (
          <>
      <div className="flex items-center gap-4">
        <p className="font-display text-[38px] font-medium leading-none tracking-tight text-primary">
          <span>{average.toFixed(1)}</span>
          <span className="ml-1 align-middle text-xs font-medium text-muted-foreground">/ 5.0</span>
        </p>
        <div>
          <div className="flex items-center gap-0.5" aria-hidden>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={
                  star <= Math.round(average)
                    ? 'h-3.5 w-3.5 fill-primary text-primary'
                    : 'h-3.5 w-3.5 text-primary-foreground fill-border-100'
                }
              />
            ))}
          </div>
          <p className="mt-1 whitespace-nowrap text-[11px] font-semibold text-foreground">
            Total rating: {reviews.length} orang
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = distribution[star - 1];
          const percent = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
          return (
            <li key={star} className="flex items-center gap-2 text-[11px]">
              <span className="flex w-7 shrink-0 items-center gap-0.5 font-medium text-foreground">
                {star}
                <Star className="h-3 w-3 fill-primary text-primary" aria-hidden />
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
                {count} orang
              </span>
            </li>
          );
        })}
      </ul>
          </>
        )}
      </div>
    </Card>
  );
}
