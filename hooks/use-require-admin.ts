"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Guard client-side untuk halaman admin. Memastikan ada sesi dan
 * profiles.role === 'admin', selain itu redirect.
 *
 * Catatan: ini hanya UX gate. Otorisasi sebenarnya tetap di server
 * (API /api/admin/* memakai getAdminUser()).
 */
export function useRequireAdmin(): {
  loading: boolean;
  isAdmin: boolean;
} {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!session) {
          router.replace("/auth/login");
          return;
        }
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        if (!mounted) return;
        if ((data as { role?: string } | null)?.role !== "admin") {
          router.replace("/");
          return;
        }
        setIsAdmin(true);
        setLoading(false);
      } catch {
        if (mounted) router.replace("/auth/login");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  return { loading, isAdmin };
}
