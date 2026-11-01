"use client";

import Image from "next/image";
import { useState, useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Store,
  MapPin,
  Tag,
  ImageIcon,
  User,
  Mail,
  Lock,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/components/ui/form";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { Checkbox } from "@/app/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { SELLER_STATUS_UPDATED_EVENT } from "@/hooks/seller/use-seller-status";
import { SUBSCRIPTION_PLANS, getPlanPrice, type BillingCycle } from "@/lib/subscription-plans";
import { formatRupiah } from "@/lib/data";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const KECAMATAN_DEPOK = [
  "Beji",
  "Bojongsari",
  "Cilodong",
  "Cimanggis",
  "Cinere",
  "Cipayung",
  "Limo",
  "Pancoran Mas",
  "Sawangan",
  "Sukmajaya",
  "Tapos",
] as const;

const KATEGORI_KULINER = [
  "Makanan Berat",
  "Jajanan",
  "Dessert",
  "Japanese",
  "Roti & Kue",
  "Makanan Cepat Saji",
  "Buah & Sayur",
  "Minuman",
] as const;

const step1Schema = z
  .object({
    fullName: z.string().min(1, "Nama lengkap wajib diisi."),
    email: z.string().email("Email tidak valid."),
    password: z.string().min(6, "Kata sandi minimal 6 karakter."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Kata sandi tidak cocok.",
    path: ["confirmPassword"],
  });

const step2Schema = z.object({
  businessName: z.string().min(1, "Nama usaha wajib diisi."),
  categories: z.array(z.string()).min(1, "Pilih minimal satu kategori usaha."),
  address: z.string().min(1, "Alamat usaha wajib diisi."),
  city: z.string().min(1, "Kecamatan wajib dipilih."),
  description: z.string().optional(),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;

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

const stepSlide: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.4, ease: EASE } },
  exit: (dir: number) => ({
    x: dir > 0 ? -60 : 60,
    opacity: 0,
    transition: { duration: 0.3, ease: EASE },
  }),
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
  return `w-full bg-transparent py-1 font-sans text-[14px] leading-none text-foreground outline-none placeholder:text-muted-foreground ${additional ?? ""}`;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "toko"
  );
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

export default function PenjualRegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sessionUser, setSessionUser] = useState<{
    fullName: string;
    email: string;
  } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'standar' | 'premium'>('basic');
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [payProcessing, setPayProcessing] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  
  const [existingStoreNotice, setExistingStoreNotice] = useState<string | null>(null);

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const step2Form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      businessName: "",
      categories: [],
      address: "",
      city: "",
      description: "",
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!session) {
          router.replace("/auth/login");
          return;
        }

        const user = session.user;
        const fullName =
          (user.user_metadata?.full_name as string) ||
          (user.email?.split("@")[0] ?? "");
        const email = user.email ?? "";

        setSessionUser({ fullName, email });
        step1Form.setValue("fullName", fullName);
        step1Form.setValue("email", email);

        const { getSellerUmkm } = await import("@/lib/product-storage");
        const existingUmkm = await getSellerUmkm();
        if (cancelled) return;

        if (existingUmkm) {
          const { getActiveSubscription } = await import(
            "@/lib/subscription-storage"
          );
          const activeSub = await getActiveSubscription();
          if (cancelled) return;
          if (activeSub) {
            
            window.dispatchEvent(new Event(SELLER_STATUS_UPDATED_EVENT));
            router.replace("/dashboard/penjual");
            return;
          }
          
          setExistingStoreNotice(
            `Tokomu "${existingUmkm.businessName}" sudah terdaftar. Silakan pilih paket langganan untuk melanjutkan berjualan.`
          );
          setDirection(1);
          setStep(3);
          setSessionReady(true);
          return;
        }

        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const stepParam = Number(params.get("step"));
          if (stepParam === 3) {
            setDirection(1);
            setStep(3);
          }
          const planParam = params.get("plan");
          if (
            planParam === "basic" ||
            planParam === "standar" ||
            planParam === "premium"
          ) {
            setSelectedPlan(planParam);
          }
          const billingParam = params.get("billing");
          if (billingParam === "monthly" || billingParam === "yearly") {
            setBilling(billingParam);
          }
        }

        setSessionReady(true);
      } catch {
        if (!cancelled) router.replace("/auth/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, step1Form]);

  function goNext() {
    setDirection(1);
    setStep(2);
  }

  function goToStep3() {
    setDirection(1);
    setStep(3);
  }

  function goBack() {
    setDirection(-1);
    if (step === 3) setStep(2);
    else setStep(1);
  }

  function goBackToStep2() {
    setDirection(-1);
    setStep(2);
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 2MB.");
      return;
    }
    setError("");
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function onSubmit() {
    setError("");
    setLoading(true);

    try {
      const { supabase } = await import("@/lib/supabase");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/auth/login");
        return;
      }

      const s2 = step2Form.getValues();
      const userId = session.user.id;

      const { data: existingUmkm } = await supabase
        .from("umkm_profiles")
        .select("id")
        .eq("user_id", userId)
        .limit(1);
      if (existingUmkm && existingUmkm.length > 0) {
        
        const { getActiveSubscription } = await import("@/lib/subscription-storage");
        const activeSub = await getActiveSubscription();
        if (!activeSub) {
          setLoading(false);
          setDirection(1);
          setStep(3);
          return;
        }
        window.dispatchEvent(new Event(SELLER_STATUS_UPDATED_EVENT));
        router.push("/dashboard/penjual");
        return;
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: session.user.email ?? "",
        password: step1Form.getValues("password"),
      });
      if (verifyError) {
        setError("Kata sandi salah. Konfirmasi kata sandi akun kamu.");
        return;
      }

      let logoUrl: string | null = null;
      if (logoFile) {
        const ext = (logoFile.name.split(".").pop() ?? "png").toLowerCase();
        
        const path = `logos/${userId}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("umkm-logos")
          .upload(path, logoFile, {
            contentType: logoFile.type || "image/png",
          });
        if (uploadError) {
          throw new Error(`Gagal mengunggah logo: ${uploadError.message}`);
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from("umkm-logos").getPublicUrl(path);
        logoUrl = publicUrl;
      }

      const slugBase = slugify(s2.businessName);
      let slug = `${slugBase}-${randomSuffix()}`;
      let insertPayloadError: { code?: string; message: string } | null = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { error } = await supabase.from("umkm_profiles").insert({
          user_id: userId,
          slug,
          business_name: s2.businessName,
          description: s2.description || null,
          category: s2.categories.join(", "),
          address: s2.address,
          city: s2.city,
          logo_url: logoUrl,
        });
        if (!error) {
          insertPayloadError = null;
          break;
        }
        insertPayloadError = error as { code?: string; message: string };
        if (error.code !== "23505") break;
        slug = `${slugBase}-${randomSuffix()}`;
      }

      if (insertPayloadError) {
        throw new Error(insertPayloadError.message);
      }

      window.dispatchEvent(new Event(SELLER_STATUS_UPDATED_EVENT));
      
      setDirection(1);
      setStep(3);
      setPayError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message || "Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePaySubscription() {
    if (payProcessing) return;
    setPayError(null);
    setPayProcessing(true);
    try {
      const { getValidAuthHeader, fetchWithAuth, AuthError } = await import("@/lib/auth-token");
      let authHeader: string;
      try {
        authHeader = await getValidAuthHeader();
      } catch (err) {
        setPayError(err instanceof AuthError ? err.message : "Sesi habis, silakan login ulang.");
        router.push("/auth/login");
        return;
      }
      const res = await fetchWithAuth("/api/subscriptions/xendit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ planSlug: selectedPlan, billing }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string; invoiceUrl?: string } | null;
      if (!res.ok) {
        setPayError(json?.error ?? "Gagal membuat invoice.");
        return;
      }
      if (json?.invoiceUrl) {
        window.location.href = json.invoiceUrl;
        return;
      }
      setPayError("Respons pembayaran tidak valid.");
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Terjadi kesalahan pembayaran.");
    } finally {
      setPayProcessing(false);
    }
  }

  if (!sessionReady) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex h-full flex-col">
      <motion.div variants={itemVariants} className="mb-3 flex-shrink-0">
        <Link
          href="/home"
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

      {}
      <motion.div variants={itemVariants} className="mb-5 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
              step >= 1 ? "bg-[hsl(var(--primary))] text-white shadow-sm" : "bg-muted text-muted-foreground"
            }`}
          >
            {step > 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : "1"}
          </div>
          <div className={`h-px flex-1 transition-colors ${step >= 2 ? "bg-[hsl(var(--primary))]" : "bg-border"}`} />
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
              step >= 2 ? "bg-[hsl(var(--primary))] text-white shadow-sm" : "bg-muted text-muted-foreground"
            }`}
          >
            {step > 2 ? <CheckCircle2 className="h-3.5 w-3.5" /> : "2"}
          </div>
          <div className={`h-px flex-1 transition-colors ${step >= 3 ? "bg-[hsl(var(--primary))]" : "bg-border"}`} />
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
              step >= 3 ? "bg-[hsl(var(--primary))] text-white shadow-sm" : "bg-muted text-muted-foreground"
            }`}
          >
            3
          </div>
        </div>
        <div className="mt-2 flex justify-between">
          <span className={`font-sans text-[10px] font-semibold uppercase tracking-widest ${step===1 ? "text-[hsl(var(--primary))]" : "text-muted-foreground"}`}>Akun</span>
          <span className={`font-sans text-[10px] font-semibold uppercase tracking-widest ${step===2 ? "text-[hsl(var(--primary))]" : "text-muted-foreground"}`}>Usaha</span>
          <span className={`font-sans text-[10px] font-semibold uppercase tracking-widest ${step===3 ? "text-[hsl(var(--primary))]" : "text-muted-foreground"}`}>Paket</span>
        </div>
      </motion.div>

      <motion.h1
        variants={itemVariants}
        className="font-display text-[22px] font-bold leading-[1.1] tracking-[-0.02em] text-foreground flex-shrink-0"
      >
        {step === 1 ? "Buat Akun Penjual" : step === 2 ? "Data Usaha" : "Pilih Paket Langganan"}
      </motion.h1>
      <motion.p
        variants={itemVariants}
        className="mt-1.5 font-sans text-[13px] leading-relaxed text-muted-foreground flex-shrink-0"
      >
        {step === 1
          ? "Verifikasi akun Anda untuk melanjutkan. Email & nama sudah sesuai sesi login."
          : step === 2
            ? "Ceritakan tentang usaha kuliner Anda untuk tampil di ReBites."
            : "Pilih paket untuk memulai berjualan, Basic 24.999/bulan wajib bayar via Xendit."}
      </motion.p>

      <div className="mt-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1.5 -mr-1.5 pb-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
        <AnimatePresence mode="wait" custom={direction}>
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={stepSlide}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <Form {...step1Form}>
                <form
                  className="grid grid-cols-1 gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    step1Form.handleSubmit(goNext)();
                  }}
                  noValidate
                >
                  <FormField
                    control={step1Form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FieldBox
                          id="fullName"
                          label="Nama Lengkap"
                          icon={User}
                        >
                          <input
                            id="fullName"
                            {...field}
                            readOnly
                            className={inputClass("cursor-default opacity-60")}
                          />
                        </FieldBox>
                        <FormMessage className="font-sans text-[12px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FieldBox
                          id="email"
                          label="Alamat Email"
                          icon={Mail}
                        >
                          <input
                            id="email"
                            type="email"
                            {...field}
                            readOnly
                            className={inputClass("cursor-default opacity-60")}
                          />
                        </FieldBox>
                        <FormMessage className="font-sans text-[12px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
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
                            autoComplete="new-password"
                            placeholder="••••••••"
                            className={inputClass()}
                            {...field}
                          />
                        </FieldBox>
                        <FormMessage className="font-sans text-[12px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FieldBox
                          id="confirmPassword"
                          label="Konfirmasi Kata Sandi"
                          icon={Lock}
                          trailing={
                            <PasswordVisibilityButton
                              visible={showConfirmPassword}
                              onToggle={() => setShowConfirmPassword((v) => !v)}
                            />
                          }
                        >
                          <input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            className={inputClass()}
                            {...field}
                          />
                        </FieldBox>
                        <FormMessage className="font-sans text-[12px]" />
                      </FormItem>
                    )}
                  />

                  {error && (
                    <p
                      role="alert"
                      className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 font-sans text-[12px] leading-relaxed text-destructive"
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition-colors duration-200 hover:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary))]"
                  >
                    Selanjutnya
                  </button>
                </form>
              </Form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={stepSlide}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <Form {...step2Form}>
                <form
                  className="grid grid-cols-1 gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    step2Form.handleSubmit(onSubmit)();
                  }}
                  noValidate
                >
                  <FormField
                    control={step2Form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FieldBox
                          id="businessName"
                          label="Nama Usaha"
                          icon={Store}
                        >
                          <input
                            id="businessName"
                            placeholder="Contoh: Warung Nasi Berkah"
                            className={inputClass()}
                            {...field}
                          />
                        </FieldBox>
                        <FormMessage className="font-sans text-[12px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step2Form.control}
                    name="categories"
                    render={({ field }) => {
                      const selected = (field.value ?? []) as string[];
                      const toggleCategory = (k: string) => {
                        const next = selected.includes(k)
                          ? selected.filter((c) => c !== k)
                          : [...selected, k];
                        field.onChange(next);
                      };
                      return (
                        <FormItem>
                          <div>
                            <div className="mb-1.5 flex items-baseline justify-between gap-3">
                              <label className="block font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Kategori Jualan
                              </label>
                              <span className="font-sans text-[10px] text-muted-foreground">
                                Bisa lebih dari satu
                              </span>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 transition-colors duration-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-[hsl(var(--primary))]/15">
                              <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground/55" />
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label="Pilih kategori jualan"
                                    className={cn(
                                      "flex w-full items-center justify-between gap-2 bg-transparent text-left font-sans text-[14px] outline-none",
                                      selected.length > 0
                                        ? "text-foreground"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    <span className="truncate">
                                      {selected.length > 0
                                        ? selected.join(", ")
                                        : "Pilih kategori kuliner"}
                                    </span>
                                    <ChevronDown className="h-4 w-4 shrink-0 opacity-40" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="start"
                                  className="w-72 rounded-xl border-border p-2"
                                >
                                  <div className="space-y-0.5">
                                    {KATEGORI_KULINER.map((k) => {
                                      const checked = selected.includes(k);
                                      return (
                                        <label
                                          key={k}
                                          className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-secondary"
                                        >
                                          <Checkbox
                                            checked={checked}
                                            onCheckedChange={() =>
                                              toggleCategory(k)
                                            }
                                            className="data-[state=checked]:border-primary data-[state=checked]:bg-[hsl(var(--primary))]"
                                          />
                                          <span className="font-sans text-sm text-foreground">
                                            {k}
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                          <FormMessage className="font-sans text-[12px]" />
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={step2Form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <div>
                          <label className="mb-1.5 block font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Kecamatan (Depok)
                          </label>
                          <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 transition-colors duration-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-[hsl(var(--primary))]/15">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/55" />
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <SelectTrigger className="w-full border-0 bg-transparent p-0 font-sans text-[14px] text-foreground shadow-none focus:ring-0 focus:ring-offset-0 h-auto py-1 [&>span]:text-left">
                                <SelectValue placeholder="Pilih kecamatan di Depok" />
                              </SelectTrigger>
                              <SelectContent>
                                {KECAMATAN_DEPOK.map((k) => (
                                  <SelectItem key={k} value={k}>
                                    {k}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <FormMessage className="font-sans text-[12px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step2Form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FieldBox
                          id="address"
                          label="Alamat Usaha"
                          icon={MapPin}
                        >
                          <input
                            id="address"
                            placeholder="Jl. contoh no. 123, RT/RW"
                            className={inputClass()}
                            {...field}
                          />
                        </FieldBox>
                        <FormMessage className="font-sans text-[12px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step2Form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <div>
                          <div className="mb-1.5 flex items-baseline justify-between gap-3">
                            <label
                              htmlFor="description"
                              className="block font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                            >
                              Deskripsi Usaha
                            </label>
                            <span className="font-sans text-[10px] text-muted-foreground">
                              Opsional
                            </span>
                          </div>
                          <div className="group flex items-start gap-2 rounded-lg border border-border bg-white px-3 py-2 transition-colors duration-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-[hsl(var(--primary))]/15">
                            <Store className="mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/55 transition-colors duration-200 group-focus-within:text-[hsl(var(--primary))]" />
                            <Textarea
                              id="description"
                              placeholder="Ceritakan tentang usaha Anda..."
                              rows={2}
                              className="min-h-[56px] resize-none border-0 bg-transparent p-0 py-1 font-sans text-[14px] leading-relaxed text-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
                              {...field}
                            />
                          </div>
                        </div>
                        <FormMessage className="font-sans text-[12px]" />
                      </FormItem>
                    )}
                  />

                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <label className="block font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Gambar Toko
                      </label>
                      <span className="font-sans text-[10px] text-muted-foreground">
                        Opsional
                      </span>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-secondary px-3 py-2.5">
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
                        {logoPreview ? (
                          <Image
                            src={logoPreview}
                            alt="Logo preview"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="rounded-md border border-border bg-white px-3 py-1.5 font-sans text-[11px] font-medium text-[hsl(var(--primary))] shadow-sm transition-colors hover:bg-secondary"
                        >
                          {logoFile ? "Ganti Logo" : "Pilih Logo"}
                        </button>
                        <p className="mt-1 font-sans text-[10px] text-muted-foreground">
                          PNG/JPG, maks 2MB
                        </p>
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                    </div>
                  </div>

                  {error && (
                    <p
                      role="alert"
                      className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 font-sans text-[12px] leading-relaxed text-destructive"
                    >
                      {error}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-4 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-sm transition-colors duration-200 hover:bg-secondary"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Kembali
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-3 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition-colors duration-200 hover:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {loading ? "Menyimpan..." : "Lanjut ke Paket"}
                      {!loading && <ArrowRight className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </form>
              </Form>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={stepSlide}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
            >
              {existingStoreNotice && (
                <p
                  role="status"
                  className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 font-sans text-[12px] leading-relaxed text-[hsl(var(--primary))]"
                >
                  {existingStoreNotice}
                </p>
              )}

              {}
              <div className="flex justify-center">
                <div className="inline-flex items-center rounded-full border border-border bg-white p-1">
                  {(['monthly','yearly'] as BillingCycle[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBilling(mode)}
                      aria-pressed={billing===mode}
                      className={cn('rounded-full px-4 py-1.5 text-xs font-semibold transition-colors', billing===mode ? 'bg-[hsl(var(--primary))] text-white shadow-sm' : 'text-muted-foreground hover:text-[hsl(var(--primary))]')}
                    >
                      {mode==='monthly' ? 'Bulanan' : 'Tahunan'}
                    </button>
                  ))}
                </div>
              </div>

              {}
              <div className="grid grid-cols-1 gap-3">
                {SUBSCRIPTION_PLANS.map((plan) => {
                  const isSelected = selectedPlan===plan.slug;
                  const price = getPlanPrice(plan as any, billing);
                  const total = price + Math.round(price*0.12);
                  return (
                    <button
                      key={plan.slug}
                      type="button"
                      onClick={() => setSelectedPlan(plan.slug)}
                      className={cn('relative flex flex-col rounded-2xl border bg-white p-4 text-left transition-all', isSelected ? 'border-primary bg-secondary shadow-sm ring-1 ring-[hsl(var(--primary))]/20' : 'border-border hover:border-border')}
                    >
                      <span className={cn('absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border-2', isSelected ? 'border-primary bg-[hsl(var(--primary))]' : 'border-border bg-white')}>
                        {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                      <h3 className="font-display text-[15px] font-semibold text-[hsl(var(--primary))]">ReBites {plan.name}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{plan.tagline}</p>
                      <p className="mt-2">
                        <span className="font-display text-xl font-bold text-[hsl(var(--primary))]">{formatRupiah(price)}</span>
                        <span className="ml-1 text-xs text-muted-foreground">/ {billing==='yearly'?'tahun':'bulan'}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">+ Pajak 12% → {formatRupiah(total)}</p>
                      <ul className="mt-2 space-y-1">
                        {plan.features.map((f) => (
                          <li key={f} className="flex gap-1.5 text-[11px] leading-snug text-[hsl(var(--primary))]">
                            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[hsl(var(--primary))]" />{f}
                          </li>
                        ))}
                      </ul>
                      {isSelected && <span className="absolute -top-2 right-6 rounded-full bg-[hsl(var(--primary))] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Dipilih</span>}
                    </button>
                  );
                })}
              </div>

              {}
              {(() => {
                const plan = SUBSCRIPTION_PLANS.find(p=>p.slug===selectedPlan)!;
                const price = getPlanPrice(plan as any, billing);
                const tax = Math.round(price*0.12);
                const total = price + tax;
                const periodEnd = new Date(); if(billing==='yearly') periodEnd.setFullYear(periodEnd.getFullYear()+1); else periodEnd.setMonth(periodEnd.getMonth()+1);
                return (
                  <div className="rounded-xl border border-border bg-secondary p-4">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">Paket terpilih</span>
                      <span className="font-semibold text-[hsl(var(--primary))]">ReBites {plan.name} {billing==='yearly'?'Tahunan':'Bulanan'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px] mt-1.5">
                      <span className="text-muted-foreground">Total bayar</span>
                      <span className="font-display text-[15px] font-bold text-[hsl(var(--primary))]">{formatRupiah(total)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Berlaku s.d. {periodEnd.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})} • via Xendit</p>
                  </div>
                );
              })()}

              {payError && (
                <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{payError}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={goBackToStep2}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:bg-secondary"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Kembali
                </button>
                <button
                  type="button"
                  onClick={handlePaySubscription}
                  disabled={payProcessing}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-primary disabled:opacity-60"
                >
                  {payProcessing ? 'Memproses…' : `Bayar ${formatRupiah(getPlanPrice(SUBSCRIPTION_PLANS.find(p=>p.slug===selectedPlan)! as any, billing)+Math.round(getPlanPrice(SUBSCRIPTION_PLANS.find(p=>p.slug===selectedPlan)! as any, billing)*0.12))} via Xendit`}
                  {!payProcessing && <ArrowRight className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-center text-[11px] text-muted-foreground">Wajib bayar, Basic 24.999 untuk memulai berjualan. Belum bisa tambah produk sebelum paid.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.p
        variants={itemVariants}
        className="mt-6 text-center font-sans text-[13px] text-muted-foreground flex-shrink-0"
      >
        Sudah punya toko?{" "}
        <Link
          href="/auth/login/penjual"
          className="font-semibold text-[hsl(var(--primary))] underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Masuk sebagai penjual
        </Link>
      </motion.p>
    </motion.div>
  );
}
