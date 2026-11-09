"use client";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
export function NotificationSidebarShell({ children, }: {
    children: React.ReactNode;
}) {
    return (<BuyerShell>

      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12 lg:pt-8">

        <div className="mt-2 sm:mt-4">{children}</div>

      </main>

    </BuyerShell>);
}
