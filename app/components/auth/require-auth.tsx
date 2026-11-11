"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isSafeRedirectPath, useCurrentUser } from "@/lib/current-user";
import { Skeleton } from "@/app/components/ui/skeleton";
export function RequireAuth({ children }: {
    children: ReactNode;
}) {
    const router = useRouter();
    const { user, loading } = useCurrentUser();
    useEffect(() => {
        if (loading || user)
            return;
        const current = typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : "";
        const loginTarget = current && isSafeRedirectPath(current)
            ? `/auth/login?redirect=${encodeURIComponent(current)}`
            : "/auth/login";
        router.replace(loginTarget);
    }, [loading, user, router]);
    // Proteksi BFCache: bila halaman proteksi dipulihkan dari cache browser
    // (mis. tombol Back setelah logout), paksa muat ulang agar guard jalan lagi.
    useEffect(() => {
        const onPageShow = (event: PageTransitionEvent) => {
            if (event.persisted)
                window.location.reload();
        };
        window.addEventListener("pageshow", onPageShow);
        return () => window.removeEventListener("pageshow", onPageShow);
    }, []);
    if (loading || !user) {
        return (<div role="status" aria-label="Memeriksa sesi login" className="min-h-screen bg-secondary px-4 py-6 sm:px-6 lg:px-8">

        <div className="mx-auto max-w-7xl">

          <Skeleton className="h-8 w-56 rounded-full"/>

          <Skeleton className="mt-4 h-4 w-full max-w-md rounded-full"/>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {Array.from({ length: 3 }).map((_, index) => (<Skeleton key={index} className="h-40 rounded-2xl"/>))}

          </div>

        </div>

      </div>);
    }
    return <>{children}</>;
}
