"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Store,
  Mail,
  Lock,
} from "lucide-react";
import { SELLER_STATUS_UPDATED_EVENT } from "@/hooks/use-seller-status";
import {
  CurrentUserRoleError,
  fetchCurrentUserRole,
  getHomePathForRole,
} from "@/lib/current-user";
import {
  EMAIL_COOLDOWN_SECONDS,
  getAuthCallbackUrl,
  getDesiredNextPath,
  mapResendError,
  parseCooldownSeconds,
  useEmailCooldown,
} from "@/lib/auth-email";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.5, ease: EASE },
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
      <div className="group flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 transition-colors duration-200 focus-within:border-primary focus-within:bg-white focus-within:ring-1 focus-within:ring-[hsl(var(--primary))]/15">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/55 transition-colors duration-200 group-focus-within:text-[hsl(var(--primary))]" />
        {children}
        {trailing}
      </div>
    </div>
  );
}

function PasswordVisibilityButton({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
      aria-pressed={visible}
      className="shrink-0 rounded-sm p-0.5 text-muted-foreground/55 transition-colors duration-200 hover:text-[hsl(var(--primary))] focus-visible:text-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]/30"
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

function inputClass(additional?: string) {
  return `w-full bg-transparent py-1 font-sans text-[14px] leading-none text-[#1B3F2C] outline-none placeholder:text-muted-foreground ${additional ?? ""}`;
}

export default function PenjualLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
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
          ? getDesiredNextPath(
              window.location.search,
              "/auth/register/penjual"
            )
          : "/auth/register/penjual";
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
      setResendMessage(
        "Email konfirmasi dikirim ulang. Cek inbox, spam, dan folder promosi, lalu klik tautan terbaru dalam 5 menit."
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setResendMessage("");

    const emailTrim = email.trim();
    const nameTrim = businessName.trim();
    const passTrim = password;

    if (!emailTrim || !nameTrim || !passTrim) {
      setError("Email, nama toko, dan password wajib diisi.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setError("Format email tidak valid.");
      return;
    }
    if (passTrim.length < 6) {
      setError("Kata sandi minimal 6 karakter.");
      return;
    }

    setLoading(true);
    try {
      const { supabase } = await import("@/lib/supabase");

      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: emailTrim,
          password: passTrim,
        });

      if (signInError) {
        
        const msg = signInError.message;
        if (msg.includes("Invalid login credentials")) {
          throw new Error("Email atau kata sandi salah.");
        }
        if (msg.includes("Email not confirmed")) {
          setNeedsVerification(true);
          throw new Error(
            "Email belum diverifikasi. Cek email Anda dan klik tautan terbaru, atau kirim ulang di bawah."
          );
        }
        throw new Error(msg);
      }

      const user =
        signInData.session?.user ??
        (await supabase.auth.getSession()).data.session?.user;

      if (!user) {
        throw new Error("Gagal mendapatkan sesi. Silakan coba lagi.");
      }

      const { data: umkm, error: umkmError } = await supabase
        .from("umkm_profiles")
        .select("id, business_name, slug")
        .eq("user_id", user.id)
        .maybeSingle();

      if (umkmError) {
        throw new Error(umkmError.message);
      }

      if (!umkm) {
        
        await supabase.auth.signOut();
        setError(
          "Akun ini belum memiliki toko. Silakan daftar sebagai penjual terlebih dahulu."
        );
        return;
      }

      const dbName = (umkm.business_name ?? "").trim().toLowerCase();
      const inputName = nameTrim.toLowerCase();

      if (dbName !== inputName) {
        await supabase.auth.signOut();
        setError(
          `Nama toko tidak cocok. Toko terdaftar atas akun ini: "${umkm.business_name}". Periksa ejaan nama toko.`
        );
        return;
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(SELLER_STATUS_UPDATED_EVENT));
      }
      let role: Awaited<ReturnType<typeof fetchCurrentUserRole>> = null;
      try {
        role = await fetchCurrentUserRole(user.id);
      } catch (roleErr) {
        if (roleErr instanceof CurrentUserRoleError) {
          setError(roleErr.message);
        } else {
          setError("Gagal membaca peran akun. Silakan coba lagi.");
        }
        return;
      }
      if (!role) {
        setError("Peran akun tidak ditemukan. Hubungi administrator ReBites.");
        return;
      }
      try {
        const { supabase } = await import("@/lib/supabase");
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          activity_type: "login",
          description: "Masuk sebagai penjual.",
          metadata: { business_name: nameTrim },
          target_type: "store",
          target_id: umkm.id,
        });
      } catch {
        // Logging aktivitas bersifat non-blokir agar login tetap berjalan.
      }
      // Seller flow dipertahankan: umkm (dan anomali buyer/null yang lolos
      // cek umkm_profiles) tetap ke dashboard penjual. Hanya admin yang
      // diarahkan keluar via mapping terpusat.
      const target =
        role === "admin"
          ? getHomePathForRole(role)
          : getHomePathForRole("umkm");
      router.push(target);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message || "Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex h-full flex-col"
    >
      <motion.div variants={itemVariants} className="mb-3 flex-shrink-0">
        <Link
          href="/auth/register/penjual"
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
          src="/logo.png"
          alt="ReBites"
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5"
        />
        <span className="font-display text-lg font-semibold tracking-tight text-[hsl(var(--primary))]">
          ReBites
        </span>
      </motion.div>

      <motion.h1
        variants={itemVariants}
        className="font-display text-[22px] font-bold leading-[1.1] tracking-[-0.02em] text-[#14261E] flex-shrink-0"
      >
        Masuk sebagai Penjual
      </motion.h1>
      <motion.p
        variants={itemVariants}
        className="mt-1.5 font-sans text-[13px] leading-relaxed text-muted-foreground flex-shrink-0"
      >
        Sudah punya toko? Masukkan email, nama toko, dan password untuk
        melanjutkan ke dashboard penjual.
      </motion.p>

      <motion.form
        variants={itemVariants}
        className="mt-6 grid grid-cols-1 gap-4"
        onSubmit={handleSubmit}
        noValidate
      >
        <FieldBox id="email" label="Alamat Email" icon={Mail}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass()}
          />
        </FieldBox>

        <FieldBox id="businessName" label="Nama Toko" icon={Store}>
          <input
            id="businessName"
            type="text"
            autoComplete="organization"
            placeholder="Contoh: Warung Nasi Berkah"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className={inputClass()}
          />
        </FieldBox>

        <FieldBox
          id="password"
          label="Kata Sandi"
          icon={Lock}
          trailing={
            <PasswordVisibilityButton
              visible={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />
          }
        >
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass()}
          />
        </FieldBox>

        <div className="flex items-center justify-between">
          <Link
            href="/auth/forgotPassword"
            className="font-sans text-[12px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-[hsl(var(--primary))]"
          >
            Lupa password?
          </Link>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-[12px] leading-relaxed text-red-700"
          >
            {error}
          </p>
        )}

        {needsVerification && (
          <div className="rounded-lg border border-border bg-secondary px-3 py-2.5">
            <p className="font-sans text-[12px] leading-relaxed text-muted-foreground">
              Tidak menemukan email? Cek spam/promosi, lalu kirim ulang ke{" "}
              <span className="font-semibold text-[hsl(var(--primary))]">
                {email.trim() || "email kamu"}
              </span>
              .
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading || isResendCooling || !email.trim()}
              className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-md border border-primary/30 bg-white px-4 font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--primary))] transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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

        <button
          type="submit"
          disabled={loading}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition-colors duration-200 hover:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Memverifikasi..." : "Masuk"}
        </button>
      </motion.form>

      <motion.p
        variants={itemVariants}
        className="mt-6 text-center font-sans text-[13px] text-muted-foreground flex-shrink-0"
      >
        Belum punya toko?{" "}
        <Link
          href="/auth/register/penjual"
          className="font-semibold text-[hsl(var(--primary))] underline underline-offset-4 transition-colors hover:text-[#1B3F2C]"
        >
          Daftar sebagai penjual
        </Link>
      </motion.p>
    </motion.div>
  );
}
