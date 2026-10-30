"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";

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

function FieldBox({
  id,
  label,
  icon: Icon,
  children,
  trailing,
}: {
  id: string;
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {label}
      </label>
      <div className="group flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 transition-colors duration-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-[hsl(var(--primary))]/15">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/55 transition-colors duration-200 group-focus-within:text-[hsl(var(--primary))]" />
        {children}
        {trailing}
      </div>
    </div>
  );
}

export default function BuatSandiBaruForm() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { supabase } = await import("@/lib/supabase");
      let session = false;
      for (let attempt = 0; attempt < 10 && !session; attempt += 1) {
        const {
          data: { session: current },
        } = await supabase.auth.getSession();
        session = Boolean(current);
        if (!session) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
      if (cancelled) return;
      if (!session) router.replace("/auth/login");
      else setCheckingSession(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Kata sandi minimal 6 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Terjadi kesalahan. Silakan coba lagi.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="font-sans text-[13px] text-muted-foreground">
          Memverifikasi tautan reset…
        </p>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex h-full min-h-0 flex-col overflow-hidden">
      <motion.div variants={itemVariants} className="mb-3 flex-shrink-0">
        <Link
          href="/auth/login"
          className="group inline-flex items-center gap-1.5 rounded-full py-1 pr-2 font-sans text-[13px] font-medium text-muted-foreground transition-colors duration-200 hover:text-[hsl(var(--primary))]"
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
          src="/logo.avif"
          alt="ReBites"
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5"
        />
        <span className="font-display text-lg font-semibold tracking-tight text-[hsl(var(--primary))]">
          ReBites
        </span>
      </motion.div>

      {success ? (
        <motion.div
          variants={itemVariants}
          className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-secondary px-6 py-8 text-center"
        >
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white"
          >
            <CheckCircle2 className="h-6 w-6" />
          </motion.span>
          <h1 className="mt-4 font-display text-[22px] font-bold tracking-[-0.02em] text-foreground">
            Kata Sandi Diperbarui
          </h1>
          <p className="mt-2 font-sans text-[13px] leading-relaxed text-muted-foreground">
            Kata sandi barumu sudah aktif. Silakan masuk menggunakan kata sandi
            yang baru.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition-colors duration-200 hover:bg-primary"
          >
            Masuk Sekarang
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      ) : (
        <>
          <motion.h1
            variants={itemVariants}
            className="font-display text-[22px] font-bold leading-[1.1] tracking-[-0.02em] text-foreground flex-shrink-0"
          >
            Buat Kata
            <br />
            Sandi Baru
          </motion.h1>
          <motion.p
            variants={itemVariants}
            className="mt-1.5 font-sans text-[13px] leading-relaxed text-muted-foreground flex-shrink-0"
          >
            Tautanmu terverifikasi. Tentukan kata sandi baru untuk akun
            ReBites-mu.
          </motion.p>

          <motion.form
            variants={itemVariants}
            className="mt-6 flex flex-1 flex-col gap-4 overflow-hidden min-h-0"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="grid gap-4 overflow-y-auto overscroll-contain pr-1.5 -mr-1.5 pb-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent min-h-0">
              <FieldBox
                id="new-password"
                label="Kata Sandi Baru"
                icon={Lock}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    className="shrink-0 rounded-sm p-0.5 text-muted-foreground/55 hover:text-[hsl(var(--primary))]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              >
                <input
                  id="new-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent py-1 font-sans text-[14px] leading-none text-foreground outline-none placeholder:text-muted-foreground"
                />
              </FieldBox>

              <FieldBox
                id="confirm-new-password"
                label="Konfirmasi Kata Sandi"
                icon={Lock}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Sembunyikan password" : "Tampilkan password"}
                    className="shrink-0 rounded-sm p-0.5 text-muted-foreground/55 hover:text-[hsl(var(--primary))]"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              >
                <input
                  id="confirm-new-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-transparent py-1 font-sans text-[14px] leading-none text-foreground outline-none placeholder:text-muted-foreground"
                />
              </FieldBox>

              {error && (
                <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 font-sans text-[12px] leading-relaxed text-destructive">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition-colors duration-200 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-70 flex-shrink-0"
            >
              {loading ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.form>
        </>
      )}
    </motion.div>
  );
}
