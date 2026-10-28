"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  MailCheck,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  CurrentUserRoleError,
  fetchCurrentUserRole,
  getHomePathForRole,
  isSafeRedirectPath,
  type UserRole,
} from "@/lib/current-user";
import {
  EMAIL_COOLDOWN_SECONDS,
  EMAIL_DELIVERY_ERROR_MESSAGE,
  getAuthCallbackUrl,
  getDesiredNextPath,
  isEmailDeliveryError,
  isEmailRateLimitError,
  mapOtpVerifyError,
  mapResendError,
  parseCooldownSeconds,
  useEmailCooldown,
} from "@/lib/auth-email";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

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

/**
 * Supabase membatasi panjang OTP email ke rentang 6–10 digit. Nilai persis
 * yang dikonfigurasi di dashboard Auth tidak tersedia lewat API client,
 * sehingga input menerima seluruh rentang numerik tersebut dan validasi
 * akhir tetap dilakukan server saat `verifyOtp`.
 */
const MIN_OTP_DIGITS = 6;
const MAX_OTP_DIGITS = 10;

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: LucideIcon;
  hint?: ReactNode;
}

function Field({
  id,
  label,
  icon: Icon,
  hint,
  className,
  type = "text",
  ...inputProps
}: FieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-4">
        <label
          htmlFor={id}
          className="block font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
        >
          {label}
        </label>
        {hint}
      </div>
      <div className="group flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 transition-colors duration-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/15">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/55 transition-colors duration-200 group-focus-within:text-primary" />
        <input
          id={id}
          type={isPassword && showPassword ? "text" : type}
          {...inputProps}
          className="w-full bg-transparent py-1 font-sans text-[14px] leading-none text-primary outline-none placeholder:text-muted-foreground"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={
              showPassword ? "Sembunyikan password" : "Tampilkan password"
            }
            aria-pressed={showPassword}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground/55 transition-colors duration-200 hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
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

export default function AuthForm({
  mode,
  title,
  subtitle,
  submitLabel,
  redirectTo,
  bottomHint,
}: AuthFormProps) {
  const isSignup = mode === "signup";

  const [fullName, setFullName] = useState("");
  // Server and client first render must match: the remembered email is read
  // after hydration instead of in the initializer (which caused a hydration
  // mismatch on /auth/login).
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmEmailOpen, setConfirmEmailOpen] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  // Email yang sedang menunggu verifikasi OTP. Dipakai agar pengguna bisa
  // membuka kembali dialog bila menutupnya lalu menekan "Buat Akun" dengan
  // email yang sama (signUp kedua tidak mengirim email baru dari Supabase).
  const pendingOtpEmailRef = useRef<string | null>(null);
  const {
    remainingSec: resendRemainingSec,
    isCooling: isResendCooling,
    start: startResendCooldown,
  } = useEmailCooldown(EMAIL_COOLDOWN_SECONDS);

  async function handleResend() {
    const targetEmail = email.trim();
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setResendMessage("Masukkan email yang valid terlebih dahulu.");
      return;
    }
    if (isResendCooling) {
      setResendMessage(
        `Tunggu ${resendRemainingSec} detik sebelum kirim ulang.`
      );
      return;
    }
    // Cegah request berulang selama request sebelumnya masih berjalan.
    if (resendLoading) return;
    setResendLoading(true);
    setResendMessage("");
    try {
      const { supabase } = await import("@/lib/supabase");
      const desiredNext =
        typeof window !== "undefined"
          ? getDesiredNextPath(window.location.search, redirectTo)
          : redirectTo;
      // type "signup" mengirim ulang template "Confirm sign up". Selama
      // template memuat Token OTP, email baru berisi kode yang dapat
      // diverifikasi lewat verifyOtp.
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo: getAuthCallbackUrl(desiredNext) },
      });
      if (resendError) {
        const friendly = mapResendError(resendError.message);
        setResendMessage(friendly.message);
        if (friendly.isRateLimited) {
          // Pakai durasi Supabase bila pesannya menyediakannya.
          startResendCooldown(
            parseCooldownSeconds(resendError.message) ??
              EMAIL_COOLDOWN_SECONDS
          );
        }
        return;
      }
      startResendCooldown(EMAIL_COOLDOWN_SECONDS);
      setOtpError("");
      setResendMessage(
        "Email verifikasi dikirim ulang. Cek inbox, spam, dan folder promosi, lalu masukkan kode terbaru."
      );
    } catch (err) {
      setResendMessage(
        err instanceof Error && err.message
          ? err.message
          : "Gagal mengirim ulang. Silakan coba lagi."
      );
    } finally {
      setResendLoading(false);
    }
  }

  /**
   * Lanjutan autentikasi setelah sesi aktif (login, signup tanpa konfirmasi,
   * atau verifikasi OTP berhasil): baca role, catat activity log, lalu
   * redirect sesuai aturan yang sudah ada (redirect eksplisit → onboarding
   * penjual via ?plan= → home per role). Satu jalur untuk semua agar
   * pemeriksaan role tidak terduplikasi dan tidak terlewat.
   */
  async function finishAuth(authUserId: string | null) {
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get("plan");
    const billingParam = params.get("billing");
    const penjualRegisterTarget =
      planParam === "basic" || planParam === "standar" || planParam === "premium"
        ? `/auth/register/penjual?plan=${planParam}&billing=${
            billingParam === "yearly" ? "yearly" : "monthly"
          }`
        : null;
    const rawRedirect = params.get("redirect");
    const safeRedirect = isSafeRedirectPath(rawRedirect)
      ? rawRedirect
      : null;
    // Jangan fallback ke pembeli bila role gagal dibaca. Jika query/sesi
    // gagal, fetchCurrentUserRole melempar CurrentUserRoleError; tangani
    // secara eksplisit dan hentikan redirect.
    let role: UserRole | null = null;
    try {
      role = await fetchCurrentUserRole(authUserId);
    } catch (roleErr) {
      if (roleErr instanceof CurrentUserRoleError) {
        setError(roleErr.message);
      } else {
        setError("Gagal membaca peran akun. Silakan coba lagi.");
      }
      return;
    }

    // Akun yang benar-benar ter-autentikasi tetapi tanpa role profil:
    // pada signin jangan dianggap pembeli. Pada signup (akun baru) belum
    // dijamin ada baris profil, gunakan target default.
    if (!isSignup && role === null) {
      setError(
        "Peran akun tidak ditemukan. Hubungi administrator ReBites."
      );
      return;
    }

    try {
      const { supabase } = await import("@/lib/supabase");
      const lastUid =
        authUserId ??
        (window as Window & { __lastSignInUserId?: string }).__lastSignInUserId;
      if (lastUid) {
        await supabase.from("activity_logs").insert({
          user_id: lastUid,
          activity_type: "login",
          description: "Masuk ke ReBites.",
          metadata: { role: role ?? null },
        });
      }
    } catch {
      // Logging aktivitas bersifat non-blokir agar login tetap berjalan.
    }
    const roleHome =
      role ? getHomePathForRole(role) : redirectTo;
    window.location.href =
      safeRedirect || penjualRegisterTarget || roleHome || redirectTo;
  }

  /**
   * Verifikasi kode OTP yang dikirim ke email pendaftaran. Bila berhasil,
   * sesi aktif di client dan alur lanjut lewat `finishAuth` — jalur yang sama
   * dengan login biasa (baca role, activity log, redirect).
   */
  async function handleVerifyOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (otpLoading) return;

    const token = otpCode.trim();
    if (
      !/^\d+$/.test(token) ||
      token.length < MIN_OTP_DIGITS ||
      token.length > MAX_OTP_DIGITS
    ) {
      setOtpError(
        `Masukkan kode verifikasi berupa angka (${MIN_OTP_DIGITS}–${MAX_OTP_DIGITS} digit).`
      );
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
      // Sukses: sesi kini aktif. Jangan lewati pemeriksaan role — lanjutkan
      // lewat finishAuth yang sama dengan login/signup biasa.
      pendingOtpEmailRef.current = null;
      setOtpCode("");
      setConfirmEmailOpen(false);
      await finishAuth(data?.user?.id ?? null);
    } catch {
      setOtpError(
        "Gagal memverifikasi kode. Periksa koneksi lalu coba lagi."
      );
    } finally {
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
    if (confirmEmailOpen) return;
    // Pengguna menutup dialog OTP lalu menekan tombol daftar lagi dengan
    // email yang sama: buka kembali dialog alih-alih memanggil signUp
    // (signUp ulang tidak mengirim email baru dari Supabase).
    if (
      isSignup &&
      pendingOtpEmailRef.current &&
      email.trim().toLowerCase() === pendingOtpEmailRef.current
    ) {
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
    if (isSignup && password.length < 6) {
      setError("Kata sandi minimal 6 karakter.");
      return;
    }      setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem("rebites_remembered_email", email.trim());
      } else {
        localStorage.removeItem("rebites_remembered_email");
      }

      const { supabase } = await import("@/lib/supabase");

      // Simpan user id hasil autentikasi agar pengambilan role memakai uid
      // yang pasti, bukan bergantung pada getSession() yang bisa gagal async.
      let signedInUserId: string | null = null;

      if (isSignup) {
        // Hitung tujuan akhir SEBELUM signup agar link email bisa
        // mengembalikan user ke halaman yang benar (mis. onboarding
        // penjual bila daftar via ?plan=). Memakai origin browser saat itu
        // agar tidak tergantung nilai build-time NEXT_PUBLIC_SITE_URL.
        const desiredNext = getDesiredNextPath(
          window.location.search,
          redirectTo
        );
         const { data: signUpData, error: signUpError } =
           await supabase.auth.signUp({
             email: email.trim(),
             password,
             options: {
               data: { full_name: fullName.trim() },
               emailRedirectTo: getAuthCallbackUrl(desiredNext),
             },
           });
         if (signUpError) throw signUpError;
         signedInUserId = signUpData?.user?.id ?? null;

         if (!signUpData.session) {
          // Supabase "anti-enumeration": untuk email yang SUDAH terdaftar,
          // signUp mengembalikan user tanpa identities dan TIDAK mengirim
          // email apa pun. Jangan biarkan pengguna menunggu kode yang tidak
          // akan pernah datang.
          const signUpIdentities = signUpData.user?.identities;
          if (
            Array.isArray(signUpIdentities) &&
            signUpIdentities.length === 0
          ) {
            setError(
              "Email ini sudah terdaftar. Silakan masuk — bila email belum diverifikasi, gunakan tombol kirim ulang di halaman masuk."
            );
            return;
          }
          // Simpan email yang menunggu OTP agar dialog bisa dibuka kembali
          // bila tertutup tanpa sengaja (lihat guard di handleSubmit).
          pendingOtpEmailRef.current = email.trim().toLowerCase();
          setOtpCode("");
          setOtpError("");
          setConfirmEmailOpen(true);
          return;
        }
      } else {
         const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
           email: email.trim(),
           password,
         });
         if (signInError) throw signInError;
         signedInUserId = signInData?.user?.id ?? null;
         (window as Window & { __lastSignInUserId?: string }).__lastSignInUserId = signInData?.user?.id ?? undefined;
      }

      // Lanjutkan lewat jalur autentikasi yang sama dengan login: baca role,
      // catat activity log, lalu redirect (termasuk onboarding penjual ?plan=).
      await finishAuth(signedInUserId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Supabase env")) {
        setError(
          "Autentikasi belum aktif. Atur NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        );
      } else if (message.includes("Invalid login credentials")) {
        setError("Email atau kata sandi salah.");
      } else if (message.includes("User already registered")) {
        setError("Email sudah terdaftar. Silakan masuk.");
      } else if (isEmailRateLimitError(message)) {
        // Batas kirim email Supabase (mis. setelah beberapa kali daftar/ulang).
        setError(
          "Terlalu banyak permintaan email. Tunggu sekitar 1 menit, cek folder spam/promosi, lalu coba lagi.",
        );
      } else if (isEmailDeliveryError(message)) {
        // Kegagalan pengiriman (SMTP/penyedia email). Jangan tampilkan pesan
        // mentah berbahasa Inggris atau detail konfigurasi ke pengguna.
        setError(EMAIL_DELIVERY_ERROR_MESSAGE);
      } else if (
        message.includes("Email not confirmed") ||
        message.includes("email_not_confirmed")
      ) {
        setNeedsVerification(true);
        setError(
          "Email belum diverifikasi. Buka email Anda dan klik tautan konfirmasi terbaru, atau kirim ulang di bawah.",
        );
      } else {
        setError(message || "Terjadi kesalahan. Silakan coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex h-full min-h-0 flex-col overflow-hidden">
      <motion.div variants={itemVariants} className="mb-3 flex-shrink-0">
        <Link
          href="/"
          className="group inline-flex items-center gap-1.5 rounded-full py-1 pr-2 font-sans text-[13px] font-medium text-muted-foreground transition-colors duration-200 hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Kembali
        </Link>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="mb-5 flex items-center justify-center gap-2 lg:hidden flex-shrink-0"
      >
        <Image
          src="/logo.png"
          alt="ReBites"
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5"
        />
        <span className="font-display text-lg font-semibold tracking-tight text-primary">
          ReBites
        </span>
      </motion.div>

      <motion.h1
        variants={itemVariants}
        className="font-display text-[22px] font-bold leading-[1.1] tracking-[-0.02em] text-primary flex-shrink-0"
      >
        {title}
      </motion.h1>
      <motion.p
        variants={itemVariants}
        className="mt-1.5 font-sans text-[13px] leading-relaxed text-muted-foreground flex-shrink-0"
      >
        {subtitle}
      </motion.p>

      <motion.form
        variants={itemVariants}
        className="mt-4 flex flex-1 flex-col gap-4 overflow-hidden min-h-0"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="grid gap-4 overflow-y-auto overscroll-contain pr-1.5 -mr-1.5 pb-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent min-h-0">
        {isSignup && (
          <Field
            id="fullName"
            label="Nama Lengkap"
            icon={User}
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Nama Lengkap"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        )}

        <Field
          id="email"
          label="Alamat Email"
          icon={Mail}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="editorial@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Field
          id="password"
          label="Kata Sandi"
          icon={Lock}
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder="............"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {!isSignup && (
          <>
            <div className="flex items-center justify-between -mt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border text-primary accent-primary focus:ring-primary/30"
                />
                <span className="font-sans text-[11px] text-muted-foreground">Ingat saya</span>
              </label>
              <Link
                href="/auth/forgotPassword"
                className="font-sans text-[11px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
              >
                Lupa password?
              </Link>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 font-sans text-[12px] leading-relaxed text-destructive">
            {error}
          </p>
        )}

        {needsVerification && !isSignup && (
          <div className="rounded-lg border border-border bg-secondary px-3 py-2.5">
            <p className="font-sans text-[12px] leading-relaxed text-muted-foreground">
              Tidak menemukan email? Cek spam/promosi, lalu kirim ulang ke{" "}
              <span className="font-semibold text-primary">
                {email.trim() || "email kamu"}
              </span>
              .
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading || isResendCooling || !email.trim()}
              className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-md border border-primary/30 bg-white px-4 font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendLoading
                ? "Mengirim…"
                : isResendCooling
                  ? `Kirim ulang dalam ${resendRemainingSec} detik`
                  : "Kirim Ulang Email Konfirmasi"}
            </button>
            {resendMessage && (
              <p
                role="status"
                className="mt-2 font-sans text-[12px] leading-relaxed text-muted-foreground"
              >
                {resendMessage}
              </p>
            )}
          </div>
        )}
        </div>

        <button
          type="submit"
          disabled={loading || confirmEmailOpen}
          className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition-colors duration-200 hover:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-70 flex-shrink-0"
        >
          {loading ? (isSignup ? "Mendaftar" : "Masuk") : submitLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
      </motion.form>

      <motion.p
        variants={itemVariants}
        className="mt-5 text-center font-sans text-[13px] text-muted-foreground flex-shrink-0"
      >
        {bottomHint.text}{" "}
        <Link
          href={bottomHint.href}
          className="font-semibold text-primary underline underline-offset-4 transition-colors hover:text-primary"
        >
          {bottomHint.linkText}
        </Link>
      </motion.p>

      <Dialog open={confirmEmailOpen} onOpenChange={setConfirmEmailOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-border bg-white p-6">
          <DialogHeader>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailCheck className="h-6 w-6" />
            </span>
            <DialogTitle className="text-center font-display text-lg font-medium tracking-tight text-primary">
              Cek Email Kamu
            </DialogTitle>
            <DialogDescription className="text-center font-sans text-sm leading-relaxed text-muted-foreground">
              Registrasi berhasil! Kami mengirim kode verifikasi ke{" "}
              <span className="font-semibold text-primary">
                {email.trim()}
              </span>
              . Masukkan kode tersebut di bawah ini untuk mengaktifkan akunmu.
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-4 flex flex-col gap-2"
            onSubmit={handleVerifyOtp}
            noValidate
          >
            <Field
              id="otpCode"
              label="Kode Verifikasi"
              icon={KeyRound}
              name="otpCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Kode dari email"
              maxLength={MAX_OTP_DIGITS}
              value={otpCode}
              onChange={(e) =>
                setOtpCode(
                  e.target.value.replace(/\D/g, "").slice(0, MAX_OTP_DIGITS)
                )
              }
              disabled={otpLoading}
            />
            {otpError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-[12px] leading-relaxed text-red-700"
              >
                {otpError}
              </p>
            )}
            <button
              type="submit"
              disabled={otpLoading || otpCode.length < MIN_OTP_DIGITS}
              className="mt-1 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-5 font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {otpLoading ? "Memverifikasi…" : "Verifikasi Kode"}
            </button>
          </form>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || isResendCooling || otpLoading}
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md border border-primary/30 bg-white px-5 font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resendLoading
              ? "Mengirim…"
              : isResendCooling
                ? `Kirim ulang dalam ${resendRemainingSec} detik`
                : "Kirim Ulang Kode"}
          </button>
          {resendMessage && (
            <p
              role="status"
              className="mt-2 text-center font-sans text-[12px] leading-relaxed text-muted-foreground"
            >
              {resendMessage}
            </p>
          )}
          <Link
            href="/auth/login"
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-5 font-sans text-[13px] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-colors duration-200 hover:bg-primary"
          >
            Ke Halaman Masuk
          </Link>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
