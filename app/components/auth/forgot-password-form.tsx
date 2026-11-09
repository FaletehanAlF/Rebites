"use client";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { EMAIL_COOLDOWN_SECONDS, EMAIL_DELIVERY_ERROR_MESSAGE, getAuthCallbackUrl, isEmailDeliveryError, isEmailRateLimitError, parseCooldownSeconds, useEmailCooldown, } from "@/lib/auth-email";
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
function FieldBox({ id, label, icon: Icon, children, }: {
    id: string;
    label: string;
    icon: React.ElementType;
    children: React.ReactNode;
}) {
    return (<div>

      <label htmlFor={id} className="mb-1.5 block font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">

        {label}

      </label>

      <div className="group flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2.5 transition-colors duration-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/15">

        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/55 transition-colors duration-200 group-focus-within:text-primary"/>

        {children}

      </div>

    </div>);
}
export default function ForgotPasswordForm() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [resendNote, setResendNote] = useState("");
    const { remainingSec: cooldownSec, isCooling, start: startCooldown, } = useEmailCooldown(EMAIL_COOLDOWN_SECONDS);
    function describeResetError(rawMessage: string): {
        message: string;
        cooldownSeconds: number | null;
    } {
        if (isEmailRateLimitError(rawMessage)) {
            const trustedSeconds = parseCooldownSeconds(rawMessage);
            return {
                message: trustedSeconds !== null
                    ? `Terlalu banyak permintaan. Silakan tunggu ${trustedSeconds} detik sebelum mencoba lagi.`
                    : "Terlalu banyak permintaan. Silakan tunggu sebelum mencoba lagi.",
                cooldownSeconds: trustedSeconds,
            };
        }
        if (rawMessage.includes("Supabase env")) {
            return {
                message: "Fitur ini belum aktif. Atur NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.",
                cooldownSeconds: null,
            };
        }
        if (isEmailDeliveryError(rawMessage)) {
            return {
                message: EMAIL_DELIVERY_ERROR_MESSAGE,
                cooldownSeconds: null,
            };
        }
        if (rawMessage.includes("Email not found")) {
            return { message: "Email tidak terdaftar.", cooldownSeconds: null };
        }
        return {
            message: rawMessage || "Terjadi kesalahan. Silakan coba lagi.",
            cooldownSeconds: null,
        };
    }
    async function requestResetEmail(): Promise<void> {
        const { supabase } = await import("@/lib/supabase");
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: getAuthCallbackUrl("/auth/buat-sandi-baru"),
        });
        if (resetError)
            throw resetError;
    }
    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (loading)
            return;
        setError("");
        setResendNote("");
        if (!email.trim()) {
            setError("Email wajib diisi.");
            return;
        }
        setLoading(true);
        try {
            await requestResetEmail();
            setSent(true);
            startCooldown(EMAIL_COOLDOWN_SECONDS);
        }
        catch (err) {
            const rawMessage = err instanceof Error ? err.message : "";
            const friendly = describeResetError(rawMessage);
            setError(friendly.message);
            if (friendly.cooldownSeconds !== null || isEmailRateLimitError(rawMessage)) {
                startCooldown(friendly.cooldownSeconds ?? EMAIL_COOLDOWN_SECONDS);
            }
        }
        finally {
            setLoading(false);
        }
    }
    async function handleResend() {
        if (loading || isCooling)
            return;
        setError("");
        setResendNote("");
        if (!email.trim()) {
            setError("Email wajib diisi.");
            return;
        }
        setLoading(true);
        try {
            await requestResetEmail();
            startCooldown(EMAIL_COOLDOWN_SECONDS);
            setResendNote("Tautan reset baru dikirim. Cek inbox, spam, dan folder promosi.");
        }
        catch (err) {
            const rawMessage = err instanceof Error ? err.message : "";
            const friendly = describeResetError(rawMessage);
            setError(friendly.message);
            if (friendly.cooldownSeconds !== null || isEmailRateLimitError(rawMessage)) {
                startCooldown(friendly.cooldownSeconds ?? EMAIL_COOLDOWN_SECONDS);
            }
        }
        finally {
            setLoading(false);
        }
    }
    return (<motion.div variants={containerVariants} initial="hidden" animate="show" className="flex min-h-0 flex-col">

      <motion.div variants={itemVariants} className="mb-4 flex-shrink-0">

        <Link href="/auth/login" className="group inline-flex items-center gap-1.5 rounded-full py-1 pr-2 font-sans text-[13px] font-medium text-muted-foreground transition-colors duration-200 hover:text-primary">

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



      {sent ? (<motion.div variants={itemVariants} className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-border bg-secondary px-6 py-8 text-center">

          <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, delay: 0.2, ease: EASE }} className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white">

            <CheckCircle2 className="h-6 w-6"/>

          </motion.span>

          <h1 className="mt-4 font-display text-[24px] font-bold tracking-[-0.02em] text-primary">

            Cek Email Kamu

          </h1>

          <p className="mt-2 font-sans text-[13px] leading-relaxed text-muted-foreground">

            Kami sudah mengirimkan tautan reset kata sandi ke{" "}

            <span className="font-semibold text-primary">{email}</span>. Ikuti

            tautan tersebut untuk membuat kata sandi baru.

          </p>

          <button type="button" onClick={handleResend} disabled={loading || isCooling} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-white px-5 font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-primary transition-colors duration-200 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60">

            {loading
                ? "Mengirim..."
                : isCooling
                    ? `Kirim ulang dalam ${cooldownSec} detik`
                    : "Kirim Ulang Email"}

          </button>

          {resendNote && (<p role="status" className="mt-2 font-sans text-[12px] leading-relaxed text-muted-foreground">

              {resendNote}

            </p>)}

          {error && (<p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left font-sans text-[12px] leading-relaxed text-red-700">

              {error}

            </p>)}

          <Link href="/auth/login" className="mt-6 inline-flex items-center gap-2 font-sans text-[13px] font-semibold text-primary underline underline-offset-4 transition-colors hover:text-primary">

            Kembali ke halaman login

            <ArrowRight className="h-4 w-4"/>

          </Link>

        </motion.div>) : (<>

          <motion.h1 variants={itemVariants} className="font-display text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-primary flex-shrink-0">

            Lupa Kata Sandi?

          </motion.h1>

          <motion.p variants={itemVariants} className="mt-2 font-sans text-[13px] leading-relaxed text-muted-foreground flex-shrink-0">

            Masukkan email yang terdaftar. Kami akan mengirimkan tautan untuk

            mengatur ulang kata sandimu.

          </motion.p>



          <motion.form variants={itemVariants} className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>

            <div className="grid gap-4">

              <FieldBox id="email" label="Alamat Email" icon={Mail}>

                <input id="email" name="email" type="email" autoComplete="email" placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent py-1 font-sans text-[14px] leading-none text-primary outline-none placeholder:text-muted-foreground"/>

              </FieldBox>



              {error && (<p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-2.5 py-1.5 font-sans text-[12px] leading-relaxed text-destructive">

                  {error}

                </p>)}

            </div>



            <button type="submit" disabled={loading || isCooling} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition-colors duration-200 hover:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-70 flex-shrink-0">

              {loading
                ? "Mengirim..."
                : isCooling
                    ? `Kirim ulang dalam ${cooldownSec} detik`
                    : "Kirim Tautan Reset"}

              <ArrowRight className="h-4 w-4"/>

            </button>

          </motion.form>



          <motion.p variants={itemVariants} className="mt-6 text-center font-sans text-[13px] text-muted-foreground flex-shrink-0">

            Ingat kata sandi?{" "}

            <Link href="/auth/login" className="font-semibold text-primary underline underline-offset-4 transition-colors hover:text-primary">

              Masuk

            </Link>

          </motion.p>

        </>)}

    </motion.div>);
}
