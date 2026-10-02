"use client";

import {
  useEffect,
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
    setError("");

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

      if (isSignup) {
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: { full_name: fullName.trim() },
              emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`,
            },
          });
        if (signUpError) throw signUpError;

        if (!signUpData.session) {
          setConfirmEmailOpen(true);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }

      const params = new URLSearchParams(window.location.search);
      const planParam = params.get("plan");
      const billingParam = params.get("billing");
      const penjualRegisterTarget =
        planParam === "basic" || planParam === "standar" || planParam === "premium"
          ? `/auth/register/penjual?plan=${planParam}&billing=${
              billingParam === "yearly" ? "yearly" : "monthly"
            }`
          : null;
      window.location.href =
        params.get("redirect") || penjualRegisterTarget || redirectTo;
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
      } else if (
        message.includes("Email not confirmed") ||
        message.includes("email_not_confirmed")
      ) {
        setError(
          "Email belum diverifikasi. Buka email Anda dan klik tautan konfirmasi.",
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
              Registrasi berhasil! Kami mengirim tautan konfirmasi ke{" "}
              <span className="font-semibold text-primary">
                {email.trim()}
              </span>
              . Langkah selanjutnya: buka email tersebut, klik tautan
              konfirmasinya, dan kamu akan diarahkan kembali ke ReBites untuk
              masuk.
            </DialogDescription>
          </DialogHeader>
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
