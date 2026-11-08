"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchAdminMe } from "@/lib/admin-me";
import { withTimeout } from "@/lib/async-timeout";
import { fetchCurrentUserRole, getHomePathForRole } from "@/lib/current-user";
export type AdminGuardStatus = "loading" | "admin" | "forbidden" | "unauthenticated" | "error";
export interface AdminGuardResult {
    status: AdminGuardStatus;
    loading: boolean;
    isAdmin: boolean;
    errorMessage: string | null;
    retry: () => void;
}
const ERROR_MESSAGE = "Tidak dapat memeriksa status admin. Periksa koneksi internet lalu coba lagi.";
const ADMIN_CHECK_TIMEOUT_MS = 15000;
function statusOf(error: unknown): number {
    const status = (error as {
        status?: unknown;
    } | null)?.status;
    return typeof status === "number" ? status : 0;
}
export function useRequireAdmin(): AdminGuardResult {
    const router = useRouter();
    const [status, setStatus] = useState<AdminGuardStatus>("loading");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const requestIdRef = useRef(0);
    const retry = useCallback(() => {
        setStatus("loading");
        setErrorMessage(null);
        setAttempt((value) => value + 1);
    }, []);
    useEffect(() => {
        let active = true;
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        const isCurrent = () => active && requestId === requestIdRef.current;
        (async () => {
            try {
                const { data: { session }, } = await withTimeout(supabase.auth.getSession(), ADMIN_CHECK_TIMEOUT_MS);
                if (!isCurrent())
                    return;
                if (!session) {
                    setStatus("unauthenticated");
                    router.replace("/auth/login");
                    return;
                }
                const me = await withTimeout(fetchAdminMe(), ADMIN_CHECK_TIMEOUT_MS);
                if (!isCurrent())
                    return;
                if (!me) {
                    setErrorMessage(ERROR_MESSAGE);
                    setStatus("error");
                    return;
                }
                setStatus("admin");
            }
            catch (err) {
                if (!isCurrent())
                    return;
                const httpStatus = statusOf(err);
                if (httpStatus === 401) {
                    setStatus("unauthenticated");
                    router.replace("/auth/login");
                    return;
                }
                if (httpStatus === 403) {
                    setStatus("forbidden");
                    let destination = "/home";
                    try {
                        const role = await withTimeout(fetchCurrentUserRole(), ADMIN_CHECK_TIMEOUT_MS);
                        if (role)
                            destination = getHomePathForRole(role);
                    }
                    catch {
                    }
                    if (!isCurrent())
                        return;
                    router.replace(destination);
                    return;
                }
                setErrorMessage(ERROR_MESSAGE);
                setStatus("error");
            }
        })();
        return () => {
            active = false;
        };
    }, [router, attempt]);
    return {
        status,
        loading: status === "loading",
        isAdmin: status === "admin",
        errorMessage,
        retry,
    };
}
