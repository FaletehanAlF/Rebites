"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, Lock, Sparkles } from "lucide-react";
import { formatRupiah } from "@/lib/data";
import { cn } from "@/lib/utils";
import { DotPattern } from "@/app/components/shared/ornaments";
import { AnimatedNumber } from "./animated-number";
import { PromoCodeInput } from "./promo-code-input";
import { UseCoinsCard } from "./use-coins-card";
import { useCheckout } from "./checkout-context";

const STICKY_TOP = 112;

export function PaymentSummaryCard() {
  const {
    draft,
    quantity,
    summary,
    promo,
    canPay,
    missingRequirement,
    submitting,
    submitOrder,
    fulfillment,
    selectedShippingOption,
  } = useCheckout();
  const cardRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;
      setStuck(rect.top <= STICKY_TOP + 1);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative overflow-hidden rounded-3xl bg-cream-100 p-5 transition-shadow duration-300 sm:p-6",
        stuck ? "shadow-xl shadow-primary/10" : "shadow-md shadow-primary/5",
      )}
    >
      <DotPattern className="pointer-events-none absolute inset-0 h-full w-full text-primary/[0.05]" />

      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage-500">
          Ringkasan Pesanan
        </p>

        {}
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-charcoal-900">
              {draft.productName}
            </p>
            <p className="mt-0.5 text-xs text-charcoal-500">
              {draft.vendorName} · x{quantity}
            </p>
          </div>
          <p className="shrink-0 text-right text-sm font-medium tabular-nums text-charcoal-900">
            <AnimatedNumber value={summary.subtotal} format={formatRupiah} />
          </p>
        </div>

        {}
        <dl className="mt-5 space-y-3 border-t border-sage-500/20 pt-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-charcoal-500">
              Total sementara ({quantity} porsi)
            </dt>
            <dd className="font-medium tabular-nums text-charcoal-900">
              <AnimatedNumber value={summary.subtotal} format={formatRupiah} />
            </dd>
          </div>

          {promo && summary.discount > 0 && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-primary">Diskon ({promo.code})</dt>
              <dd className="font-semibold tabular-nums text-primary">
                <AnimatedNumber
                  value={summary.discount}
                  format={formatRupiah}
                />
              </dd>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <dt className="text-charcoal-500">Biaya admin</dt>
            <dd className="font-medium tabular-nums text-charcoal-900">
              <AnimatedNumber
                value={summary.serviceFee}
                format={formatRupiah}
              />
            </dd>
          </div>

          {/* delivery menampilkan harga opsi terpilih (tanpa fallback
              Rp8.000); belum memilih = placeholder. Pickup = behavior lama. */}
          {fulfillment === 'delivery'
            ? selectedShippingOption && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-charcoal-500">Biaya pengiriman</dt>
                  <dd className="font-medium tabular-nums text-charcoal-900">
                    <AnimatedNumber
                      value={summary.deliveryFee}
                      format={formatRupiah}
                    />
                  </dd>
                </div>
              )
            : summary.deliveryFee > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-charcoal-500">Biaya pengiriman</dt>
                  <dd className="font-medium tabular-nums text-charcoal-900">
                    <AnimatedNumber
                      value={summary.deliveryFee}
                      format={formatRupiah}
                    />
                  </dd>
                </div>
              )}
          {fulfillment === 'delivery' && !selectedShippingOption && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-charcoal-500">Biaya pengiriman</dt>
              <dd className="font-medium tabular-nums text-sage-500">
                Pilih pengiriman
              </dd>
            </div>
          )}

          {}
          <AnimatePresence initial={false}>
            {summary.coinUsed > 0 && (
              <motion.div
                key="coin-discount-row"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-primary">ReBites Coin</dt>
                  <dd className="font-semibold tabular-nums text-primary">
                    <AnimatedNumber
                      value={summary.coinDiscount}
                      format={formatRupiah}
                    />
                  </dd>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </dl>

        {}
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-caramel/30 bg-caramel/10 px-3.5 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-caramel text-white shadow-sm">
            <Coins className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-charcoal-900">
              Dapatkan +
              <AnimatedNumber
                value={summary.coinEarned}
                format={(v) => v.toLocaleString("id-ID")}
              />{" "}
              ReBites Coin
            </p>
            <p className="text-[11px] leading-snug text-charcoal-500">
              Coin masuk otomatis setelah pesanan selesai
            </p>
          </div>
        </div>

        <PromoCodeInput />

        <UseCoinsCard />

        <div className="mt-5 border-t border-sage-500/25 pt-4">
          <div className="flex items-center justify-between gap-4">
            <span className="font-display text-base font-medium text-charcoal-900">
              Total
            </span>
            <span className="font-display text-2xl font-semibold tabular-nums text-primary">
              <AnimatedNumber value={summary.total} format={formatRupiah} />
            </span>
          </div>
        </div>

        <motion.button
          type="button"
          disabled={!canPay}
          onClick={submitOrder}
          whileHover={canPay ? { scale: 1.02 } : undefined}
          whileTap={canPay ? { scale: 0.98 } : undefined}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "mx-auto mt-6 flex w-fit items-center whitespace-nowrap rounded-full px-8 py-3.5 text-sm font-semibold transition-colors duration-200",
            canPay
              ? "bg-primary text-white shadow-lg shadow-primary/25 hover:bg-caramel"
              : "cursor-not-allowed bg-sage-100 text-sage-500",
          )}
        >
          {submitting
            ? "Memproses pesanan"
            : `Pesan Sekarang · ${formatRupiah(summary.total)}`}
        </motion.button>

        {!canPay && !submitting && missingRequirement && (
          <p role="status" className="mt-2 text-center text-xs text-sage-500">
            {missingRequirement}
          </p>
        )}

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-charcoal-500">
          <Lock className="h-3.5 w-3.5 text-primary" />
          Transaksi terenkripsi · Dana ditahan sampai pesanan diterima
        </p>
      </div>
    </div>
  );
}
