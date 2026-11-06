'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { formatRupiah } from '@/lib/data';
import {
  SUBSCRIPTION_PLANS,
  computePeriodEnd,
  getPlanPrice,
  getSubscriptionPlan,
  type BillingCycle,
} from '@/lib/subscription-plans';
import { saveSubscription } from '@/lib/subscription-storage';
import { supabase } from '@/lib/supabase';
import { AuthError, fetchWithAuth, getValidAuthHeader } from '@/lib/auth-token';
import { useCurrentUser } from '@/lib/current-user';
import { toast } from '@/hooks/use-toast';

function SubscriptionContent({
  plan,
  billing,
  userEmail,
  router,
}: {
  plan: ReturnType<typeof getSubscriptionPlan> & { slug: string };
  billing: BillingCycle;
  userEmail: string | null;
  router: ReturnType<typeof useRouter>;
}) {
  const [selectedSlug, setSelectedSlug] = useState<'basic' | 'standar' | 'premium'>(() => {
    if (plan && (plan.slug === 'basic' || plan.slug === 'standar' || plan.slug === 'premium')) return plan.slug as 'basic' | 'standar' | 'premium';
    return 'basic';
  });

  useEffect(() => {
    if (plan && (plan.slug === 'basic' || plan.slug === 'standar' || plan.slug === 'premium')) {
      setSelectedSlug(plan.slug as 'basic' | 'standar' | 'premium');
    }
  }, [plan]);

  const currentPlan = getSubscriptionPlan(selectedSlug) ?? getSubscriptionPlan('basic')!;

  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const price = getPlanPrice(currentPlan, billing);
  const subtotal = price;
  const tax = Math.round(subtotal * 0.12);
  const total = subtotal + tax;
  const periodEndLabel = computePeriodEnd(billing).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handlePay = async () => {
    if (processing) return;
    setProcessing(true);
    setErrorMessage(null);

    try {
      let authHeader: string;
      try {
        authHeader = await getValidAuthHeader();
      } catch (err) {
        setProcessing(false);
        setErrorMessage(
          err instanceof AuthError ? err.message : 'Sesi habis, silakan login ulang.'
        );
        router.push('/auth/login');
        return;
      }
      const res = await fetchWithAuth('/api/subscriptions/xendit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({ planSlug: currentPlan.slug, billing }),
      });
      const json = (await res.json().catch(() => null)) as
        | { error?: string; invoiceUrl?: string }
        | null;
      if (!res.ok) {
        setProcessing(false);
        setErrorMessage(json?.error ?? 'Gagal membuat invoice.');
        return;
      }
      if (json?.invoiceUrl) {
        window.location.href = json.invoiceUrl;
        return;
      }
      setProcessing(false);
      setErrorMessage('Respons pembayaran tidak valid.');
    } catch (err) {
      console.error('[subscription] handlePay error', err);
      setProcessing(false);
      setErrorMessage('Terjadi kesalahan saat memproses pembayaran.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => router.back()}
        disabled={processing}
        className="inline-flex h-9 items-center gap-1.5 -ml-2 rounded-full px-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-white hover:text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali
      </button>

      {}
      <section className="mt-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
          Pilih Paket Langganan
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Pilih Basic, Standar atau Max. Klik card untuk mengganti, detail di bawah akan mengikuti pilihanmu. Semua paket berbayar via Xendit (Basic 24.999).
        </p>
      </section>

      {}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((p) => {
          const isSelected = p.slug === selectedSlug;
          const pPrice = getPlanPrice(p, billing);
          const pTotal = pPrice + Math.round(pPrice * 0.12);
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() => setSelectedSlug(p.slug as 'basic' | 'standar' | 'premium')}
              className={`relative flex flex-col rounded-2xl border bg-white p-5 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-secondary shadow-sm ring-1 ring-primary/20'
                  : 'border-border hover:border-border hover:bg-white'
              }`}
            >
              {}
              <span
                className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  isSelected ? 'border-primary bg-primary' : 'border-border bg-white'
                }`}
              >
                {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>

              <h3 className="font-display text-lg font-semibold text-primary">ReBites {p.name}</h3>
              <p className="mt-1 min-h-[2.2rem] text-xs leading-relaxed text-muted-foreground">{p.tagline}</p>
              <p className="mt-3">
                <span className="font-display text-2xl font-bold text-primary">{formatRupiah(pPrice)}</span>
                <span className="ml-1 text-xs text-muted-foreground">/ {billing === 'yearly' ? 'tahun' : 'bulan'}</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">+ Pajak 12% {formatRupiah(pTotal)}</p>
              <ul className="mt-3 space-y-1.5">
                {p.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex gap-1.5 text-[12px] leading-snug text-primary">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              {isSelected && (
                <span className="absolute -top-2 right-8 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Dipilih
                </span>
              )}
            </button>
          );
        })}
      </div>

      {}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-7 lg:col-span-3">
          <h2 className="font-display text-[18px] font-semibold tracking-tight text-primary">Rincian Pembayaran</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            ReBites {currentPlan.name} {billing === 'yearly' ? 'Tahunan' : 'Bulanan'}  berlaku s.d. {periodEndLabel}
          </p>

          {userEmail && (
            <p className="mt-4 rounded-lg bg-secondary px-3 py-2 text-[12px] text-muted-foreground">
              Pembayaran untuk <span className="font-semibold text-primary">{userEmail}</span> , akan diproses via Xendit
            </p>
          )}

          <div className="mt-6 rounded-xl border border-border bg-secondary p-4">
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-muted-foreground">Paket terpilih</span>
              <span className="font-semibold text-primary">ReBites {currentPlan.name}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
              <span className="text-muted-foreground">Periode</span>
              <span className="font-medium text-primary">{billing === 'yearly' ? 'Tahunan' : 'Bulanan'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
              <span className="text-muted-foreground">Fitur utama</span>
              <span className="max-w-[60%] truncate text-right text-primary">{currentPlan.features[0]}</span>
            </div>
          </div>

          <dl className="mt-6 space-y-3 border-t border-border pt-5">
            <div className="flex items-center justify-between text-[14px]">
              <dt className="text-muted-foreground">Total sementara</dt>
              <dd className="font-medium tabular-nums text-primary">{formatRupiah(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between text-[14px]">
              <dt className="text-muted-foreground">Pajak 12%</dt>
              <dd className="font-medium tabular-nums text-primary">{formatRupiah(tax)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <dt className="text-[14px] font-semibold text-primary">Total</dt>
              <dd className="font-display text-[18px] font-semibold tabular-nums text-primary">{formatRupiah(total)}</dd>
            </div>
          </dl>

          <div className="mt-5 flex gap-2 rounded-xl border border-border/40 bg-primary/10 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-[12px] leading-relaxed text-primary">
              Tidak ada form yang perlu diisi. Klik bayar untuk lanjut ke Xendit (QRIS, GoPay, OVO, DANA, ShopeePay, VA, Kartu).
            </p>
          </div>

          {errorMessage && !processing && (
            <div role="alert" className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3.5">
              <p className="flex items-start gap-1.5 text-[13px] font-semibold text-destructive">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Pembayaran belum dapat diproses.
              </p>
              <p className="mt-1 pl-[1.375rem] text-xs leading-relaxed text-destructive">{errorMessage}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handlePay}
            disabled={processing}
            className="mt-6 inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(34,81,56,0.20)] transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Memproses
              </>
            ) : (
              `Bayar ${formatRupiah(total)} via Xendit`
            )}
          </button>
          <p className="mt-2.5 text-center text-[11px] text-muted-foreground">Aman & terverifikasi otomatis oleh Xendit. Pajak 12% sudah termasuk.</p>
        </div>

        {}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm lg:col-span-2">
          <div className="bg-secondary px-6 py-5">
            <h3 className="font-display text-[15px] font-semibold text-primary">ReBites {currentPlan.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">Paket termasuk:</p>
          </div>
          <div className="flex-1 bg-white px-6 py-5">
            <ul className="space-y-2.5">
              {currentPlan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-[13px] leading-snug">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-primary">{feature}</span>
                </li>
              ))}
              <li className="flex gap-2.5 text-[13px] leading-snug">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-primary">Pembayaran aman via Xendit</span>
              </li>
            </ul>

            <div className="mt-6 rounded-xl border border-border bg-secondary p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total sementara</span>
                <span className="font-medium text-primary">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Pajak 12%</span>
                <span className="font-medium text-primary">{formatRupiah(tax)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-semibold">
                <span className="text-primary">Total</span>
                <span className="text-primary">{formatRupiah(total)}</span>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2.5 rounded-full bg-secondary px-3.5 py-2 ring-1 ring-black/5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <span className="text-[12px] font-medium text-primary">Pembayaran via Xendit, aman & instan</span>
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        1 halaman penuh, tanpa form. Klik card Basic/Standar/Max di atas untuk ganti pilihan.
      </p>
    </>
  );
}

export function SubscriptionCheckoutView() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useCurrentUser();

  const planParam = params.get('plan');
  const initialPlan = getSubscriptionPlan(planParam);
  const billing: BillingCycle =
    params.get('billing') === 'yearly' ? 'yearly' : 'monthly';

  const [authChecked, setAuthChecked] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });
  }, []);

  // Auth check effect - must be at top level
  useEffect(() => {
    if (!authLoading) {
      setAuthChecked(true);
      if (!user) {
        toast({
          title: "Silakan login terlebih dahulu",
          description: "Anda harus login untuk berlangganan paket penjual.",
          variant: "default",
        });
        const currentUrl = window.location.pathname + window.location.search;
        router.push(`/auth/login?redirect=${encodeURIComponent(currentUrl)}`);
      }
    }
  }, [user, authLoading, router]);

  // Early returns after all hooks
  if (authLoading || !authChecked) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-border bg-white px-6 py-14 text-center">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Memeriksa autentikasi...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  if (!initialPlan) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-border bg-white px-6 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-primary">
          <CreditCard className="h-6 w-6" />
        </span>
        <h1 className="mt-5 font-display text-xl font-medium tracking-tight text-foreground">Paket tidak tersedia</h1>
        <Link
          href="/dashboard/penjual/langganan"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white hover:bg-primary"
        >
          Pilih Paket
        </Link>
      </div>
    );
  }

  return <SubscriptionContent plan={initialPlan} billing={billing} userEmail={userEmail} router={router} />;
}