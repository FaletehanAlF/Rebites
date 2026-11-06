"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  isSafeNextPath,
  mapCallbackError,
} from "@/lib/auth-email";
import { isOAuthCallback, mapOAuthError } from "@/lib/auth-oauth";

function safeNextPath(raw: string | null): string {
  return isSafeNextPath(raw) ? (raw as string) : "/home";
}

type CallbackState = "working" | "success" | "failed";

/**
 * Penjaga modul untuk pencatatan login Google: satu halaman callback hanya
 * mencatat SATU login per user. Guard utama tetap `didRunRef` di komponen
 * (effect dijalankan sekali, termasuk pada StrictMode). Penjaga ini menutup
 * kemungkinan mount ulang komponen sebelum navigasi selesai.
 */
let oauthLoginRecordedFor: string | null = null;

function CallbackStatus({
  state,
  detail,
  isOAuth = false,
}: {
  state: CallbackState;
  detail: string;
  isOAuth?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        {state === "working" && (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
        <p className="font-sans text-sm leading-relaxed text-muted-foreground">
          {detail}
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
              {isOAuth
                ? "Kamu tetap bisa masuk dengan email dan kata sandi yang sudah terdaftar."
                : "Belum menerima email? Masuk dengan email kamu — bila muncul \u201cEmail belum diverifikasi\u201d, gunakan tombol kirim ulang di sana."}
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
  const [isOAuth, setIsOAuth] = useState(false);
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

    // Alur di bawah TIDAK berubah untuk verifikasi email/OTP. Hanya bila
    // penanda `?oauth=google` ada, callback memakai jalur pasca-login
    // berbasis role (sama dengan finishAuth di AuthForm).
    const oauthFlow = isOAuthCallback(searchParams.toString());
    const mapError = oauthFlow ? mapOAuthError : mapCallbackError;
    if (oauthFlow && isMountedRef.current) {
      setIsOAuth(true);
      setDetail("Menghubungkan akun Google kamu…");
    }

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
      setDetail("Email terverifikasi. Mengalihkan…");
      setState("success");
      router.replace(nextPath);
    }

    /**
     * Jalur OAuth: sesi sudah aktif, lalu baca role, catat activity log, dan
     * redirect sesuai role (buyer → /home, umkm → /dashboard/penjual,
     * admin → /dashboard/admin). `next` eksplisit tetap dihormati lewat
     * helper bersama, dan divalidasi safe-path di sana.
     */
    async function succeedOAuth(authUserId: string | null) {
      if (!isMountedRef.current) return;
      const { completeAuthSession } = await import("@/lib/auth-post-login");
      const result = await completeAuthSession(authUserId, {
        redirectParam: searchParams.get("next"),
        allowMissingProfile: true,
        fallback: "/home",
        // Cegah pencatatan login ganda bila callback di-mount ulang.
        logLogin: !authUserId || authUserId !== oauthLoginRecordedFor,
      });
      if (!isMountedRef.current) return;
      if (!result.ok) {
        fail(result.message);
        return;
      }
      if (authUserId) oauthLoginRecordedFor = authUserId;
      setDetail("Masuk dengan Google berhasil. Mengalihkan…");
      setState("success");
      router.replace(result.destination);
    }

    (async () => {
      try {
        // 1. Supabase mengembalikan ?error= saat link ditolak di server
        // (mis. expired/invalid pada email, atau pembatalan pada OAuth).
        // Jangan coba tukar code lagi.
        if (urlError || urlErrorDescription) {
          fail(mapError(urlErrorDescription || urlError || "Link tidak valid."));
          return;
        }

        const { supabase } = await import("@/lib/supabase");

        // 2. Alur PKCE (?code=): tukar sekali. Wajib di browser/perangkat
        // yang sama dengan saat link diminta (code verifier di storage).
        if (code) {
          const { data: exchangeData, error } =
            await supabase.auth.exchangeCodeForSession(code);
          if (!isMountedRef.current) return;
          if (error) {
            fail(mapError(error.message));
            return;
          }
          if (oauthFlow) {
            await succeedOAuth(exchangeData.session?.user?.id ?? null);
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
            fail(mapError(error.message));
            return;
          }
          if (oauthFlow) {
            const {
              data: { session: oauthSession },
            } = await supabase.auth.getSession();
            await succeedOAuth(oauthSession?.user?.id ?? null);
            return;
          }
          succeed();
          return;
        }

        // 4. Alur implisit (#access_token di hash): supabase-js dengan
        // detectSessionInUrl sudah mem-parse otomatis. Cukup poll sesi
        // sebentar, tanpa memanggil exchange/verify apa pun.
        let sessionUserId: string | null = null;
        for (let attempt = 0; attempt < 10 && !sessionUserId; attempt += 1) {
          if (!isMountedRef.current) return;
          const {
            data: { session: current },
          } = await supabase.auth.getSession();
          sessionUserId = current?.user?.id ?? null;
          if (!sessionUserId) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
        if (!isMountedRef.current) return;
        if (sessionUserId) {
          if (oauthFlow) {
            await succeedOAuth(sessionUserId);
            return;
          }
          succeed();
        } else {
          fail(
            oauthFlow
              ? mapOAuthError("")
              : "Tautan tidak membawa kode verifikasi dan tidak ada sesi. Minta tautan baru atau masuk kembali."
          );
        }
      } catch (err) {
        if (isMountedRef.current) {
          fail(
            mapError(
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

  return <CallbackStatus state={state} detail={detail} isOAuth={isOAuth} />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackStatus state="working" detail="" />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
