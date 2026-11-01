"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  isSafeNextPath,
  mapCallbackError,
} from "@/lib/auth-email";

function safeNextPath(raw: string | null): string {
  return isSafeNextPath(raw) ? (raw as string) : "/home";
}

type CallbackState = "working" | "success" | "failed";

function CallbackStatus({
  state,
  detail,
}: {
  state: CallbackState;
  detail: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        {state === "working" && (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
        <p className="font-sans text-sm leading-relaxed text-muted-foreground">
          {state === "working"
            ? "Memverifikasi email kamu…"
            : state === "success"
              ? "Email terverifikasi. Mengalihkan…"
              : detail}
        </p>
        {state === "failed" && (
          <div className="flex w-full flex-col gap-2">
            <Link
              href="/auth/login"
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-5 font-sans text-[13px] font-semibold uppercase tracking-[0.14em] text-primary-foreground"
            >
              Ke Halaman Masuk
            </Link>
            <p className="font-sans text-[12px] leading-relaxed text-muted-foreground">
              Belum menerima email? Masuk dengan email kamu — bila muncul
              &ldquo;Email belum diverifikasi&rdquo;, gunakan tombol kirim ulang
              di sana.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>("working");
  const [detail, setDetail] = useState("Memverifikasi email kamu…");
  // Guard anti-double: StrictMode dev me-mount effect 2x, dan
  // penukaran code / verifikasi OTP hanya boleh jalan sekali
  // (code hanya valid 5 menit & sekali pakai).
  const didRunRef = useRef(false);
  // Status mount yang sesungguhnya — bukan simulasi unmount StrictMode.
  // StrictMode menjalankan setup → cleanup → setup secara sinkron, jadi
  // cleanup simulasi sempat men-set false tetapi langsung kembali true
  // sebelum langkah await mana pun selesai. Hanya unmount asli yang
  // membiarkannya false; setelah itu update state/redirect diblokir.
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    const nextPath = safeNextPath(searchParams.get("next"));
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const otpType = searchParams.get("type");
    const urlError = searchParams.get("error");
    const urlErrorDescription =
      searchParams.get("error_description") ??
      searchParams.get("error_code") ??
      "";

    function fail(message: string, redirectAfterMs = 0) {
      if (!isMountedRef.current) return;
      setDetail(message);
      setState("failed");
      if (redirectAfterMs > 0) {
        window.setTimeout(() => {
          if (isMountedRef.current) router.replace("/auth/login");
        }, redirectAfterMs);
      }
    }

    function succeed() {
      if (!isMountedRef.current) return;
      setState("success");
      router.replace(nextPath);
    }

    (async () => {
      try {
        // 1. Supabase mengembalikan ?error= saat link ditolak di server
        // (mis. expired/invalid). Jangan coba tukar code lagi.
        if (urlError || urlErrorDescription) {
          fail(
            mapCallbackError(
              urlErrorDescription || urlError || "Link tidak valid."
            )
          );
          return;
        }

        const { supabase } = await import("@/lib/supabase");

        // 2. Alur PKCE (?code=): tukar sekali. Wajib di browser/perangkat
        // yang sama dengan saat link diminta (code verifier di storage).
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!isMountedRef.current) return;
          if (error) {
            fail(mapCallbackError(error.message));
            return;
          }
          succeed();
          return;
        }

        // 3. Alur token-hash (?token_hash=&type=): untuk template email
        // yang memakai TokenHash. Tipe default 'signup' bila tak ada.
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            type: ((otpType || "signup") as EmailOtpType),
            token_hash: tokenHash,
          });
          if (!isMountedRef.current) return;
          if (error) {
            fail(mapCallbackError(error.message));
            return;
          }
          succeed();
          return;
        }

        // 4. Alur implisit (#access_token di hash): supabase-js dengan
        // detectSessionInUrl sudah mem-parse otomatis. Cukup poll sesi
        // sebentar, tanpa memanggil exchange/verify apa pun.
        let session: { user: unknown } | null = null;
        for (let attempt = 0; attempt < 10 && !session; attempt += 1) {
          if (!isMountedRef.current) return;
          const {
            data: { session: current },
          } = await supabase.auth.getSession();
          session = current;
          if (!session) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
        if (!isMountedRef.current) return;
        if (session) {
          succeed();
        } else {
          fail(
            "Tautan tidak membawa kode verifikasi dan tidak ada sesi. Minta tautan baru atau masuk kembali."
          );
        }
      } catch (err) {
        if (isMountedRef.current) {
          fail(
            mapCallbackError(
              err instanceof Error ? err.message : "Verifikasi gagal."
            )
          );
        }
      }
    })();
    // Jalur kerja ini sengaja tanpa cleanup pembatal per-run: kalau cleanup
    // ikut mematikan eksekusi, rangkaian setup → cleanup → setup milik
    // StrictMode akan membunuh satu-satunya eksekusi yang diizinkan dan
    // spinner macet. Pembatalan setelah komponen benar-benar dilepas
    // ditangani oleh isMountedRef di atas.
    // searchParams stabil per navigasi; didRunRef mencegah eksekusi ganda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return <CallbackStatus state={state} detail={detail} />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackStatus state="working" detail="" />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
