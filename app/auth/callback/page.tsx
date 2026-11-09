"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { isSafeNextPath, mapCallbackError, } from "@/lib/auth-email";
import { isOAuthCallback, mapOAuthError, getOAuthIntent, isReturningOAuthUser, REGISTER_GOOGLE_EXISTS_MESSAGE } from "@/lib/auth-oauth";
import { isAccountBlockMessage } from "@/lib/account-block";
function safeNextPath(raw: string | null): string {
    return isSafeNextPath(raw) ? (raw as string) : "/home";
}
type CallbackState = "working" | "success" | "failed";
let oauthLoginRecordedFor: string | null = null;
function CallbackStatus({ state, detail, isOAuth = false, }: {
    state: CallbackState;
    detail: string;
    isOAuth?: boolean;
}) {
    return (<div className="flex min-h-screen items-center justify-center bg-secondary px-6">

      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">

        {state === "working" && (<span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"/>)}

        <p className="font-sans text-sm leading-relaxed text-muted-foreground">

          {detail}

        </p>

        {state === "failed" && (<div className="flex w-full flex-col gap-2">

            <Link href="/auth/login" className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-5 font-sans text-[13px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">

              Ke Halaman Masuk

            </Link>

            

            {isAccountBlockMessage(detail) && (<Link href="/banding" className="inline-flex h-11 w-full items-center justify-center rounded-md border border-primary/30 bg-white px-5 font-sans text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">

                Ajukan Banding ke Admin

              </Link>)}

            <p className="font-sans text-[12px] leading-relaxed text-muted-foreground">

              {isOAuth
                ? "Kamu tetap bisa masuk dengan email dan kata sandi yang sudah terdaftar."
                : "Belum menerima email? Masuk dengan email kamu — bila muncul \u201cEmail belum diverifikasi\u201d, gunakan tombol kirim ulang di sana."}

            </p>

          </div>)}

      </div>

    </div>);
}
function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [state, setState] = useState<CallbackState>("working");
    const [detail, setDetail] = useState("Memverifikasi email kamu…");
    const [isOAuth, setIsOAuth] = useState(false);
    const didRunRef = useRef(false);
    const isMountedRef = useRef(false);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    useEffect(() => {
        if (didRunRef.current)
            return;
        didRunRef.current = true;
        const oauthFlow = isOAuthCallback(searchParams.toString());
        const mapError = oauthFlow ? mapOAuthError : mapCallbackError;
        const registerIntent = oauthFlow && getOAuthIntent(searchParams.toString()) === "register";
        if (oauthFlow && isMountedRef.current) {
            setIsOAuth(true);
            setDetail("Menghubungkan akun Google kamu…");
        }
        const nextPath = safeNextPath(searchParams.get("next"));
        const code = searchParams.get("code");
        const tokenHash = searchParams.get("token_hash");
        const otpType = searchParams.get("type");
        const urlError = searchParams.get("error");
        const urlErrorDescription = searchParams.get("error_description") ??
            searchParams.get("error_code") ??
            "";
        function fail(message: string, redirectAfterMs = 0) {
            if (!isMountedRef.current)
                return;
            setDetail(message);
            setState("failed");
            if (redirectAfterMs > 0) {
                window.setTimeout(() => {
                    if (isMountedRef.current)
                        router.replace("/auth/login");
                }, redirectAfterMs);
            }
        }
        function succeed() {
            if (!isMountedRef.current)
                return;
            setDetail("Email terverifikasi. Mengalihkan…");
            setState("success");
            router.replace(nextPath);
        }
        async function succeedOAuth(authUserId: string | null) {
            if (!isMountedRef.current)
                return;
            const { completeAuthSession } = await import("@/lib/auth-post-login");
            const result = await completeAuthSession(authUserId, {
                redirectParam: searchParams.get("next"),
                allowMissingProfile: true,
                fallback: "/home",
                logLogin: !authUserId || authUserId !== oauthLoginRecordedFor,
            });
            if (!isMountedRef.current)
                return;
            if (!result.ok) {
                fail(result.message);
                return;
            }
            if (authUserId)
                oauthLoginRecordedFor = authUserId;
            setDetail("Masuk dengan Google berhasil. Mengalihkan…");
            setState("success");
            router.replace(result.destination);
        }
        (async () => {
            try {
                if (urlError || urlErrorDescription) {
                    fail(mapError(urlErrorDescription || urlError || "Link tidak valid."));
                    return;
                }
                const { supabase } = await import("@/lib/supabase");
                const rejectIfReturningOAuthUser = async (user: {
                    created_at?: string | null;
                    last_sign_in_at?: string | null;
                } | null): Promise<boolean> => {
                    if (!registerIntent)
                        return false;
                    if (!isReturningOAuthUser(user))
                        return false;
                    try {
                        await supabase.auth.signOut();
                    }
                    catch {
                    }
                    fail(REGISTER_GOOGLE_EXISTS_MESSAGE);
                    return true;
                };
                if (code) {
                    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);
                    if (!isMountedRef.current)
                        return;
                    if (error) {
                        fail(mapError(error.message));
                        return;
                    }
                    if (oauthFlow) {
                        const oauthUser = exchangeData.session?.user ?? null;
                        if (await rejectIfReturningOAuthUser(oauthUser))
                            return;
                        await succeedOAuth(oauthUser?.id ?? null);
                        return;
                    }
                    succeed();
                    return;
                }
                if (tokenHash) {
                    const { error } = await supabase.auth.verifyOtp({
                        type: ((otpType || "signup") as EmailOtpType),
                        token_hash: tokenHash,
                    });
                    if (!isMountedRef.current)
                        return;
                    if (error) {
                        fail(mapError(error.message));
                        return;
                    }
                    if (oauthFlow) {
                        const { data: { session: oauthSession }, } = await supabase.auth.getSession();
                        const oauthUser = oauthSession?.user ?? null;
                        if (await rejectIfReturningOAuthUser(oauthUser))
                            return;
                        await succeedOAuth(oauthUser?.id ?? null);
                        return;
                    }
                    succeed();
                    return;
                }
                let sessionUser: {
                    id: string;
                    created_at?: string | null;
                    last_sign_in_at?: string | null;
                } | null = null;
                for (let attempt = 0; attempt < 10 && !sessionUser; attempt += 1) {
                    if (!isMountedRef.current)
                        return;
                    const { data: { session: current }, } = await supabase.auth.getSession();
                    sessionUser = current?.user ?? null;
                    if (!sessionUser) {
                        await new Promise((resolve) => setTimeout(resolve, 300));
                    }
                }
                if (!isMountedRef.current)
                    return;
                if (sessionUser) {
                    if (oauthFlow) {
                        if (await rejectIfReturningOAuthUser(sessionUser))
                            return;
                        await succeedOAuth(sessionUser.id);
                        return;
                    }
                    succeed();
                }
                else {
                    fail(oauthFlow
                        ? mapOAuthError("")
                        : "Tautan tidak membawa kode verifikasi dan tidak ada sesi. Minta tautan baru atau masuk kembali.");
                }
            }
            catch (err) {
                if (isMountedRef.current) {
                    fail(mapError(err instanceof Error ? err.message : "Verifikasi gagal."));
                }
            }
        })();
// eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);
    return <CallbackStatus state={state} detail={detail} isOAuth={isOAuth}/>;
}
export default function AuthCallbackPage() {
    return (<Suspense fallback={<CallbackStatus state="working" detail=""/>}>

      <AuthCallbackContent />

    </Suspense>);
}
