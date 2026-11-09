"use client";
import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode, } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail, MailCheck, User, } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/app/components/ui/dialog";
import { getExplicitNextPath, getOAuthCallbackUrl, mapOAuthError, } from "@/lib/auth-oauth";
import { EMAIL_COOLDOWN_SECONDS, EMAIL_DELIVERY_ERROR_MESSAGE, getAuthCallbackUrl, getDesiredNextPath, isEmailDeliveryError, isEmailRateLimitError, mapOtpVerifyError, mapResendError, parseCooldownSeconds, useEmailCooldown, } from "@/lib/auth-email";
import { isInvalidCredentialsMessage, loginErrorMessageFor, lookupEmailRegistered, } from "@/lib/auth-login-hint";
import { DUPLICATE_EMAIL_MESSAGE, isDuplicateEmailSignUp, } from "@/lib/auth-signup";
import { BLOCKED_ACCOUNT_MESSAGE, isAccountBlockMessage, isBannedAuthError } from "@/lib/account-block";
const EASE: [
    number,
    number,
    number,
    number
] = [0.22, 1, 0.36, 1];
const containerVariants: Variants = {
    hidden: {},
    show: {
        transition: { staggerChildren: 0.06, delayChildren: 0.04 },
    },
};
const itemVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { duration: 0.45, ease: EASE },
    },
};
const MIN_OTP_DIGITS = 6;
const MAX_OTP_DIGITS = 10;
function checkPasswordStrength(password: string) {
    const requirements = [
        { label: "Minimal 8 karakter", test: (p: string) => p.length >= 8 },
        { label: "Minimal 1 huruf kapital (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
        { label: "Minimal 1 huruf kecil (a-z)", test: (p: string) => /[a-z]/.test(p) },
        { label: "Minimal 1 angka (0-9)", test: (p: string) => /\d/.test(p) },
        { label: "Minimal 1 karakter spesial (!@#$%^&*)", test: (p: string) => /[!@#$%^&*]/.test(p) },
    ];
    const fulfilled = requirements.map((r) => r.test(password));
    const count = fulfilled.filter(Boolean).length;
    let strength: "low" | "medium" | "strong" | "very-strong" = "low";
    if (count >= 5)
        strength = "very-strong";
    else if (count === 4)
        strength = "strong";
    else if (count >= 3)
        strength = "medium";
    return { fulfilled, requirements, strength, count };
}
const PASSWORD_STRENGTH_META = {
    low: { label: "Rendah", text: "text-red-600", bar: "bg-red-500", width: "w-1/4" },
    medium: { label: "Sedang", text: "text-amber-600", bar: "bg-amber-500", width: "w-1/2" },
    strong: { label: "Kuat", text: "text-emerald-600", bar: "bg-emerald-500", width: "w-3/4" },
    "very-strong": {
        label: "Sangat Kuat",
        text: "text-emerald-700",
        bar: "bg-emerald-600",
        width: "w-full",
    },
} as const;
interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
    id: string;
    label: string;
    icon: LucideIcon;
    hint?: ReactNode;
}
function Field({ id, label, icon: Icon, hint, className, type = "text", ...inputProps }: FieldProps) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    return (<div>

      <div className="mb-1.5 flex items-baseline justify-between gap-4">

        <label htmlFor={id} className="block font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">

          {label}

        </label>

        {hint}

      </div>

      <div className="group flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2.5 transition-colors duration-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/15">

        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/55 transition-colors duration-200 group-focus-within:text-primary"/>

        <input id={id} type={isPassword && showPassword ? "text" : type} {...inputProps} className="w-full bg-transparent py-1 font-sans text-[14px] leading-none text-primary outline-none placeholder:text-muted-foreground"/>

        {isPassword && (<button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={showPassword} className="shrink-0 rounded-sm p-0.5 text-muted-foreground/55 transition-colors duration-200 hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">

            {showPassword ? (<EyeOff className="h-4 w-4"/>) : (<Eye className="h-4 w-4"/>)}

          </button>)}

      </div>

    </div>);
}
interface AuthFormProps {
    mode: "signin" | "signup";
    title: ReactNode;
    subtitle: string;
    submitLabel: string;
    redirectTo: string;
    bottomHint: {
        text: string;
        linkText: string;
        href: string;
    };
}
export default function AuthForm({ mode, title, subtitle, submitLabel, redirectTo, bottomHint, }: AuthFormProps) {
    const isSignup = mode === "signup";
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState(false);
    const [confirmEmailOpen, setConfirmEmailOpen] = useState(false);
    const [needsVerification, setNeedsVerification] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendMessage, setResendMessage] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpError, setOtpError] = useState("");
    const pendingOtpEmailRef = useRef<string | null>(null);
    const { remainingSec: resendRemainingSec, isCooling: isResendCooling, start: startResendCooldown, } = useEmailCooldown(EMAIL_COOLDOWN_SECONDS);
    async function handleResend() {
        const targetEmail = email.trim();
        if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
            setResendMessage("Masukkan email yang valid terlebih dahulu.");
            return;
        }
        if (isResendCooling) {
            setResendMessage(`Tunggu ${resendRemainingSec} detik sebelum kirim ulang.`);
            return;
        }
        if (resendLoading)
            return;
        setResendLoading(true);
        setResendMessage("");
        try {
            const { supabase } = await import("@/lib/supabase");
            const desiredNext = typeof window !== "undefined"
                ? getDesiredNextPath(window.location.search, redirectTo)
                : redirectTo;
            const { error: resendError } = await supabase.auth.resend({
                type: "signup",
                email: targetEmail,
                options: { emailRedirectTo: getAuthCallbackUrl(desiredNext) },
            });
            if (resendError) {
                const friendly = mapResendError(resendError.message);
                setResendMessage(friendly.message);
                if (friendly.isRateLimited) {
                    startResendCooldown(parseCooldownSeconds(resendError.message) ??
                        EMAIL_COOLDOWN_SECONDS);
                }
                return;
            }
            startResendCooldown(EMAIL_COOLDOWN_SECONDS);
            setOtpError("");
            setResendMessage("Email verifikasi dikirim ulang. Cek inbox, spam, dan folder promosi, lalu masukkan kode terbaru.");
        }
        catch (err) {
            setResendMessage(err instanceof Error && err.message
                ? err.message
                : "Gagal mengirim ulang. Silakan coba lagi.");
        }
        finally {
            setResendLoading(false);
        }
    }
    async function finishAuth(authUserId: string | null) {
        const params = new URLSearchParams(window.location.search);
        const lastUid = authUserId ??
            (window as Window & {
                __lastSignInUserId?: string;
            }).__lastSignInUserId ??
            null;
        const { completeAuthSession } = await import("@/lib/auth-post-login");
        const result = await completeAuthSession(lastUid, {
            redirectParam: params.get("redirect"),
            plan: params.get("plan"),
            billing: params.get("billing"),
            allowMissingProfile: isSignup,
            fallback: redirectTo,
        });
        if (!result.ok) {
            setError(result.message);
            return;
        }
        window.location.href = result.destination;
    }
    async function handleGoogleAuth() {
        if (oauthLoading || loading)
            return;
        setError("");
        setOauthLoading(true);
        try {
            const { supabase } = await import("@/lib/supabase");
            const nextPath = typeof window !== "undefined"
                ? getExplicitNextPath(window.location.search)
                : null;
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: getOAuthCallbackUrl(nextPath, isSignup ? "register" : "login"),
                    queryParams: { prompt: "select_account" },
                },
            });
            if (oauthError) {
                setError(mapOAuthError(oauthError.message));
                setOauthLoading(false);
            }
        }
        catch (err) {
            setError(mapOAuthError(err instanceof Error ? err.message : ""));
            setOauthLoading(false);
        }
    }
    async function handleVerifyOtp(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (otpLoading)
            return;
        const token = otpCode.trim();
        if (!/^\d+$/.test(token) ||
            token.length < MIN_OTP_DIGITS ||
            token.length > MAX_OTP_DIGITS) {
            setOtpError(`Masukkan kode verifikasi berupa angka (${MIN_OTP_DIGITS}–${MAX_OTP_DIGITS} digit).`);
            return;
        }
        if (!email.trim()) {
            setOtpError("Email tidak ditemukan. Muat ulang halaman lalu coba lagi.");
            return;
        }
        setOtpError("");
        setOtpLoading(true);
        try {
            const { supabase } = await import("@/lib/supabase");
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                email: email.trim(),
                token,
                type: "signup",
            });
            if (verifyError) {
                setOtpError(mapOtpVerifyError(verifyError.message));
                return;
            }
            pendingOtpEmailRef.current = null;
            setOtpCode("");
            setConfirmEmailOpen(false);
            await finishAuth(data?.user?.id ?? null);
        }
        catch {
            setOtpError("Gagal memverifikasi kode. Periksa koneksi lalu coba lagi.");
        }
        finally {
            setOtpLoading(false);
        }
    }
    useEffect(() => {
        const remembered = localStorage.getItem("rebites_remembered_email");
        if (remembered) {
            setEmail(remembered);
            setRememberMe(true);
        }
    }, []);
    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (confirmEmailOpen)
            return;
        if (isSignup &&
            pendingOtpEmailRef.current &&
            email.trim().toLowerCase() === pendingOtpEmailRef.current) {
            setOtpError("");
            setConfirmEmailOpen(true);
            return;
        }
        setError("");
        setNeedsVerification(false);
        setResendMessage("");
        if (isSignup && !fullName.trim()) {
            setError("Nama lengkap wajib diisi.");
            return;
        }
        if (!email.trim() || !password) {
            setError("Email dan kata sandi wajib diisi.");
            return;
        }
        if (isSignup && password.length < 8) {
            setError("Kata sandi minimal 8 karakter.");
            return;
        }
        if (isSignup && !/[A-Z]/.test(password)) {
            setError("Kata sandi harus memiliki minimal 1 huruf kapital.");
            return;
        }
        if (isSignup && !/[a-z]/.test(password)) {
            setError("Kata sandi harus memiliki minimal 1 huruf kecil.");
            return;
        }
        if (isSignup && !/\d/.test(password)) {
            setError("Kata sandi harus memiliki minimal 1 angka.");
            return;
        }
        if (isSignup && !/[!@#$%^&*]/.test(password)) {
            setError("Kata sandi harus memiliki minimal 1 karakter spesial (!@#$%^&*).");
            return;
        }
        setLoading(true);
        try {
            if (rememberMe) {
                localStorage.setItem("rebites_remembered_email", email.trim());
            }
            else {
                localStorage.removeItem("rebites_remembered_email");
            }
            const { supabase } = await import("@/lib/supabase");
            let signedInUserId: string | null = null;
            if (isSignup) {
                const desiredNext = getDesiredNextPath(window.location.search, redirectTo);
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: email.trim(),
                    password,
                    options: {
                        data: { full_name: fullName.trim() },
                        emailRedirectTo: getAuthCallbackUrl(desiredNext),
                    },
                });
                if (isDuplicateEmailSignUp({
                    error: signUpError,
                    identities: signUpData?.user?.identities,
                    hasSession: Boolean(signUpData?.session),
                })) {
                    if (signUpData?.session) {
                        try {
                            await supabase.auth.signOut();
                        }
                        catch {
                        }
                    }
                    setError(DUPLICATE_EMAIL_MESSAGE);
                    return;
                }
                if (signUpError)
                    throw signUpError;
                signedInUserId = signUpData?.user?.id ?? null;
                if (!signUpData?.session) {
                    pendingOtpEmailRef.current = email.trim().toLowerCase();
                    setOtpCode("");
                    setOtpError("");
                    setConfirmEmailOpen(true);
                    return;
                }
            }
            else {
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                });
                if (signInError)
                    throw signInError;
                signedInUserId = signInData?.user?.id ?? null;
                (window as Window & {
                    __lastSignInUserId?: string;
                }).__lastSignInUserId = signInData?.user?.id ?? undefined;
            }
            await finishAuth(signedInUserId);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "";
            if (isBannedAuthError(err)) {
                setError(BLOCKED_ACCOUNT_MESSAGE);
            }
            else if (message.includes("Supabase env")) {
                setError("Autentikasi belum aktif. Atur NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.");
            }
            else if (isInvalidCredentialsMessage(message)) {
                const registered = isSignup ? null : await lookupEmailRegistered(email.trim());
                setError(loginErrorMessageFor(message, registered));
            }
            else if (isDuplicateEmailSignUp({ error: err })) {
                setError(DUPLICATE_EMAIL_MESSAGE);
            }
            else if (isEmailRateLimitError(message)) {
                setError("Terlalu banyak permintaan email. Tunggu sekitar 1 menit, cek folder spam/promosi, lalu coba lagi.");
            }
            else if (isEmailDeliveryError(message)) {
                setError(EMAIL_DELIVERY_ERROR_MESSAGE);
            }
            else if (message.includes("Email not confirmed") ||
                message.includes("email_not_confirmed")) {
                setNeedsVerification(true);
                setError("Email belum diverifikasi. Buka email Anda dan klik tautan konfirmasi terbaru, atau kirim ulang di bawah.");
            }
            else {
                setError(message || "Terjadi kesalahan. Silakan coba lagi.");
            }
        }
        finally {
            setLoading(false);
        }
    }
    const strengthMeta = PASSWORD_STRENGTH_META[checkPasswordStrength(password).strength];
    return (<motion.div variants={containerVariants} initial="hidden" animate="show" className="flex min-h-0 flex-col">

      <motion.div variants={itemVariants} className="mb-4 flex-shrink-0">

        <Link href="/" className="group inline-flex items-center gap-1.5 rounded-full py-1 pr-2 font-sans text-[13px] font-medium text-muted-foreground transition-colors duration-200 hover:text-primary">

          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5"/>

          Kembali

        </Link>

      </motion.div>



      <motion.div variants={itemVariants} className="mb-6 flex items-center justify-center gap-2 lg:hidden flex-shrink-0">

        <Image src="/logo.avif" alt="ReBites" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5"/>

        <span className="font-display text-lg font-semibold tracking-tight text-primary">

          ReBites

        </span>

      </motion.div>



      <motion.h1 variants={itemVariants} className="font-display text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-primary flex-shrink-0">

        {title}

      </motion.h1>

      <motion.p variants={itemVariants} className="mt-2 font-sans text-[13px] leading-relaxed text-muted-foreground flex-shrink-0">

        {subtitle}

      </motion.p>



      <motion.div variants={itemVariants} className="mt-5 flex flex-col gap-4 flex-shrink-0">

        <button type="button" onClick={handleGoogleAuth} disabled={oauthLoading || loading} aria-busy={oauthLoading} className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-white px-5 py-3 font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-primary shadow-sm transition-colors duration-200 hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-70">

          {oauthLoading ? (<span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"/>) : (<svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" className="h-[18px] w-[18px] shrink-0">

              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>

              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>

              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>

              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>

            </svg>)}

          Lanjutkan dengan Google

        </button>



        <div className="flex items-center gap-3" aria-hidden="true">

          <span className="h-px flex-1 bg-border"/>

          <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">

            atau

          </span>

          <span className="h-px flex-1 bg-border"/>

        </div>

      </motion.div>



      <motion.form variants={itemVariants} className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>

        <div className="grid gap-4">

        {isSignup && (<Field id="fullName" label="Nama Lengkap" icon={User} name="fullName" type="text" autoComplete="name" placeholder="Nama Lengkap" value={fullName} onChange={(e) => setFullName(e.target.value)}/>)}



        <Field id="email" label="Alamat Email" icon={Mail} name="email" type="email" autoComplete="email" placeholder="editorial@example.com" value={email} onChange={(e) => setEmail(e.target.value)}/>



        <Field id="password" label="Kata Sandi" icon={Lock} name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} placeholder="............" value={password} onChange={(e) => setPassword(e.target.value)}/>



        <AnimatePresence initial={false}>

          {isSignup && password.length > 0 && (<motion.div key="password-strength" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: EASE }} className="overflow-hidden">

              <div className="flex items-center justify-between pb-1.5">

                <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">

                  Kekuatan Kata Sandi

                </span>

                <span className={`font-sans text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors duration-300 ${strengthMeta.text}`}>

                  {strengthMeta.label}

                </span>

              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/70">

                <div className={`h-full rounded-full transition-all duration-500 ease-out ${strengthMeta.bar} ${strengthMeta.width}`}/>

              </div>

            </motion.div>)}

        </AnimatePresence>



        {!isSignup && (<>

            <div className="flex items-center justify-between -mt-1">

              <label className="inline-flex items-center gap-2 cursor-pointer select-none">

                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-3.5 w-3.5 rounded border-border text-primary accent-primary focus:ring-primary/30"/>

                <span className="font-sans text-[11px] text-muted-foreground">Ingat saya</span>

              </label>

              <Link href="/auth/forgotPassword" className="font-sans text-[11px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary">

                Lupa password?

              </Link>

            </div>

          </>)}



        {error && (<div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-2.5 py-1.5 font-sans text-[12px] leading-relaxed text-destructive">

            <p>{error}</p>

            

            {isAccountBlockMessage(error) && (<p className="mt-1.5">

                <Link href="/banding" className="font-semibold text-destructive underline underline-offset-2 transition-opacity hover:opacity-80">

                  Ajukan banding ke admin

                </Link>

              </p>)}

          </div>)}



        {needsVerification && !isSignup && (<div className="rounded-lg border border-border bg-secondary px-3 py-2.5">

            <p className="font-sans text-[12px] leading-relaxed text-muted-foreground">

              Tidak menemukan email? Cek spam/promosi, lalu kirim ulang ke{" "}

              <span className="font-semibold text-primary">

                {email.trim() || "email kamu"}

              </span>

              .

            </p>

            <button type="button" onClick={handleResend} disabled={resendLoading || isResendCooling || !email.trim()} className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-md border border-primary/30 bg-white px-4 font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60">

              {resendLoading
                ? "Mengirim…"
                : isResendCooling
                    ? `Kirim ulang dalam ${resendRemainingSec} detik`
                    : "Kirim Ulang Email Konfirmasi"}

            </button>

            {resendMessage && (<p role="status" className="mt-2 font-sans text-[12px] leading-relaxed text-muted-foreground">

                {resendMessage}

              </p>)}

          </div>)}

        </div>



        <button type="submit" disabled={loading || confirmEmailOpen} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition-colors duration-200 hover:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-70 flex-shrink-0">

          {loading ? (isSignup ? "Mendaftar" : "Masuk") : submitLabel}

          <ArrowRight className="h-4 w-4"/>

        </button>

      </motion.form>



      <motion.p variants={itemVariants} className="mt-6 text-center font-sans text-[13px] text-muted-foreground flex-shrink-0">

        {bottomHint.text}{" "}

        <Link href={bottomHint.href} className="font-semibold text-primary underline underline-offset-4 transition-colors hover:text-primary">

          {bottomHint.linkText}

        </Link>

      </motion.p>



      <Dialog open={confirmEmailOpen} onOpenChange={setConfirmEmailOpen}>

        <DialogContent className="max-w-sm rounded-2xl border-border bg-white p-6">

          <DialogHeader>

            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">

              <MailCheck className="h-6 w-6"/>

            </span>

            <DialogTitle className="text-center font-display text-lg font-medium tracking-tight text-primary">

              Cek Email Kamu

            </DialogTitle>

            <DialogDescription className="text-center font-sans text-sm leading-relaxed text-muted-foreground">

              Registrasi berhasil! Kami mengirim email verifikasi ke{" "}

              <span className="font-semibold text-primary">

                {email.trim()}

              </span>

              . Masukkan kode verifikasi dari email itu di kolom bawah untuk

              mengaktifkan akunmu.

            </DialogDescription>

            <p className="text-center font-sans text-[12px] leading-relaxed text-muted-foreground">

              Email bisa memuat kode, tautan, atau keduanya: kodenya diisi di

              kolom bawah, dan tautannya juga langsung mengaktifkan akunmu

              begitu diklik.

            </p>

          </DialogHeader>

          <form className="mt-4 flex flex-col gap-2" onSubmit={handleVerifyOtp} noValidate>

            <Field id="otpCode" label="Kode Verifikasi" icon={KeyRound} name="otpCode" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="Kode dari email" maxLength={MAX_OTP_DIGITS} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, MAX_OTP_DIGITS))} disabled={otpLoading}/>

            {otpError && (<p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-[12px] leading-relaxed text-red-700">

                {otpError}

              </p>)}

            <button type="submit" disabled={otpLoading || otpCode.length < MIN_OTP_DIGITS} className="mt-1 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-5 font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60">

              {otpLoading ? "Memverifikasi…" : "Verifikasi Kode"}

            </button>

          </form>

          <button type="button" onClick={handleResend} disabled={resendLoading || isResendCooling || otpLoading} className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md border border-primary/30 bg-white px-5 font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60">

            {resendLoading
            ? "Mengirim…"
            : isResendCooling
                ? `Kirim ulang dalam ${resendRemainingSec} detik`
                : "Kirim Ulang Kode"}

          </button>

          {resendMessage && (<p role="status" className="mt-2 text-center font-sans text-[12px] leading-relaxed text-muted-foreground">

              {resendMessage}

            </p>)}

          <Link href="/auth/login" className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-5 font-sans text-[13px] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-colors duration-200 hover:bg-primary">

            Ke Halaman Masuk

          </Link>

        </DialogContent>

      </Dialog>

    </motion.div>);
}
