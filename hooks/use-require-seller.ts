"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSellerUmkmResult, type SellerUmkm } from "@/lib/product-storage";
export type SellerGuardStatus = "loading" | "seller" | "error";
export function useRequireSeller(): {
    loading: boolean;
    umkm: SellerUmkm | null;
    status: SellerGuardStatus;
    errorMessage: string | null;
    retry: () => void;
} {
    const router = useRouter();
    const [status, setStatus] = useState<SellerGuardStatus>("loading");
    const [umkm, setUmkm] = useState<SellerUmkm | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => {
        setStatus("loading");
        setErrorMessage(null);
        setAttempt((value) => value + 1);
    }, []);
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const result = await getSellerUmkmResult();
                if (!mounted)
                    return;
                if (result.kind === "error") {
                    setErrorMessage(result.message);
                    setStatus("error");
                    return;
                }
                const { supabase } = await import("@/lib/supabase");
                const { data: { session }, } = await supabase.auth.getSession();
                if (!mounted)
                    return;
                if (!session) {
                    setStatus("seller");
                    router.replace("/auth/login");
                    return;
                }
                if (result.kind === "none") {
                    setStatus("seller");
                    router.replace("/auth/register/penjual");
                    return;
                }
                const profile = result.umkm;
                const { getActiveSubscription } = await import("@/lib/subscription-storage");
                const activeSub = await getActiveSubscription();
                if (!mounted)
                    return;
                if (!activeSub) {
                    setStatus("seller");
                    router.replace("/auth/register/penjual?step=3");
                    return;
                }
                setUmkm(profile);
                setStatus("seller");
            }
            catch {
                if (!mounted)
                    return;
                setErrorMessage("Tidak dapat memeriksa akses penjual. Periksa koneksi lalu coba lagi.");
                setStatus("error");
            }
        })();
        return () => {
            mounted = false;
        };
    }, [router, attempt]);
    return {
        loading: status === "loading",
        umkm,
        status,
        errorMessage,
        retry,
    };
}
