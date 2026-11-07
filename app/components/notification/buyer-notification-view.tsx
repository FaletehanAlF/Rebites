"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, CheckCheck } from "lucide-react";
import { useCurrentUser } from "@/lib/current-user";
import { useNotifications } from "@/hooks/use-notifications";
import type { NotificationType } from "@/lib/notification-storage";
import { ensurePromoNotifications } from "@/lib/promo-notifications";
import { NotificationCard } from "./notification-card";
import { cn } from "@/lib/utils";
type NotificationFilter = "all" | "order" | "payment" | "promo";
const FILTER_TABS: {
    value: NotificationFilter;
    label: string;
}[] = [
    { value: "all", label: "Semua" },
    { value: "order", label: "Pesanan" },
    { value: "payment", label: "Pembayaran" },
    { value: "promo", label: "Promosi" },
];
const ORDER_TYPES: NotificationType[] = [
    "order_created",
    "order_delivering",
    "order_completed",
];
const PAYMENT_TYPES: NotificationType[] = ["payment_success"];
const PROMO_TYPES: NotificationType[] = ["promo"];
export function BuyerNotificationView() {
    const { userId } = useCurrentUser();
    const { notifications, unreadCount, markRead, markAllRead } = useNotifications(userId, "buyer");
    const [filter, setFilter] = useState<NotificationFilter>("all");
    useEffect(() => {
        if (!userId)
            return;
        ensurePromoNotifications(userId);
    }, [userId]);
    const filtered = useMemo(() => {
        if (filter === "all")
            return notifications;
        const types = filter === "order"
            ? ORDER_TYPES
            : filter === "payment"
                ? PAYMENT_TYPES
                : PROMO_TYPES;
        return notifications.filter((n) => types.includes(n.type));
    }, [notifications, filter]);
    return (<div className="w-full space-y-5">
      
      <div className="flex items-center justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-primary">
            Notifikasi
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantau aktivitas pesanan dan promosi
          </p>
        </div>

        {unreadCount > 0 && (<button type="button" onClick={markAllRead} className="inline-flex items-center gap-1.5 rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary-dark hover:text-white">
            <CheckCheck className="h-3.5 w-3.5"/>
            Tandai semua dibaca
          </button>)}
      </div>

      
      <div className="flex flex-wrap gap-2" role="tablist">
        {FILTER_TABS.map((tab) => (<button key={tab.value} type="button" role="tab" aria-selected={filter === tab.value} onClick={() => setFilter(tab.value)} className={cn("rounded-full px-4 py-2 text-xs font-semibold transition-colors", filter === tab.value
                ? "bg-primary text-white shadow-sm shadow-primary/25"
                : "border border-border bg-white text-muted-foreground hover:text-foreground")}>
            {tab.label}
          </button>))}
      </div>

      
      <div className="space-y-2.5">
        {filtered.length === 0 ? (<div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-secondary px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bell className="h-6 w-6"/>
            </span>
            <h3 className="mt-4 font-display text-lg font-medium text-foreground">
              Belum ada notifikasi
            </h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {filter === "all"
                ? "Notifikasi tentang pesanan dan promosi akan muncul di sini."
                : "Tidak ada notifikasi untuk filter ini."}
            </p>
          </div>) : (filtered.map((notification) => (<NotificationCard key={notification.id} notification={notification} onMarkRead={markRead}/>)))}
      </div>
    </div>);
}
