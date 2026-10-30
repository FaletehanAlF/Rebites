'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Clock, LayoutDashboard, Store, XCircle } from 'lucide-react';
import { getSubscriptionPlan, computePeriodEnd, type BillingCycle } from '@/lib/subscription-plans';
import {
  resolveSuccessStatus,
  resolvePostPaymentHref,
  type SuccessStatus,
} from '@/lib/subscription-success';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth, getValidAuthHeader } from '@/lib/auth-token';

const METHOD_NAMES: Record<string, string> = {
  qris: 'QRIS',
  gopay: 'GoPay',
  ovo: 'OVO',
  dana: 'DANA',
  shopeepay: 'ShopeePay',
  'transfer-bank': 'Transfer Bank',
  xendit: 'Xendit',
};

interface Props {
  planSlug?: string;
  billingParam?: string;
  externalId?: string;
}

/**
 * Halaman konfirmasi setelah pembayaran langganan.
 *
 * Dua aturan keamanan dipegang di sini:
 *  1. `plan` yang tidak dikenal atau kosong TIDAK pernah dianggap paket aktif.
 *     Sebelumnya `plan` null hanya menampilkan "pilih paket", sementara
 *     `plan: 'standard'` (ejaan lain dari 'standar') jatuh ke cabang sukses dan
 *     menampilkan "Langganan Aktif!" tanpa bukti pembayaran apa pun.
 *  2. Tujuan redirect ditentukan dari kondisi akun, bukan diasumsikan penjual:
 *     pembeli yang belum punya toko (daftar penjualan bisa dibatalkan di tengah
 *     alur Xendit) tidak boleh dilempar ke dashboard penjual.
 */
export function SubscriptionSuccessClient({ planSlug, billingParam, externalId }: Props) {
  const plan = getSubscriptionPlan(planSlug);
  const billing: BillingCycle = billingParam === 'yearly' ? 'yearly' : 'monthly';
  const router = useRouter();

  const [status, setStatus] = useState<SuccessStatus>(() =>
    resolveSuccessStatus({ externalId })
  );
  // null = belum diperiksa. Dipakai untuk memilih tujuan redirect tombol
  // maupun navigasi otomatis; tidak memengaruhi status pembayaran.
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        if (!cancelled) setHasStore(false);
        return;
      }
      const { data: umkm } = await supabase
        .from('umkm_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (!cancelled) setHasStore(!!umkm);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Navigasi otomatis hanya setelah tujuan diketahui; menebak lebih dahulu
    // membuat pembeli sempat terbawa ke dashboard penjual lalu dipentalikan.
    if (status !== 'active' || hasStore === null) return;
    redirectTimer.current = setTimeout(() => {
      router.replace(resolvePostPaymentHref({ hasStore }));
    }, 2500);
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [status, hasStore, router]);

  useEffect(() => {
    if (!externalId) return;
    let cancelled = false;
    let elapsed = 0;
    let interval: ReturnType<typeof setInterval>;

    const checkDb = async (): Promise<'active' | 'pending' | 'failed' | null> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return null;

      const { data: umkm } = await supabase
        .from('umkm_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (!umkm || cancelled) return null;
      const umkmId = (umkm as Record<string, string>).id;

      const { data: subs, error: subsError } = await supabase
        .from('subscriptions')
        .select('status, xendit_invoice_id')
        .eq('umkm_id', umkmId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (subsError || cancelled || !subs) return null;

      const rows = subs as Array<Record<string, string>>;
      const target =
        rows.find((r) => r.xendit_invoice_id && externalId.includes(r.xendit_invoice_id.slice(0, 8))) ??
        rows[0];
      if (!target) return null;

      if (target.status === 'active') return 'active';
      if (target.status === 'expired' || target.status === 'cancelled') return 'failed';
      return 'pending';
    };

    const check = async () => {
      try {
        const authHeader = await getValidAuthHeader();
        const res = await fetchWithAuth('/api/subscriptions/xendit/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({ externalId }),
        });
        if (res.ok && !cancelled) {
          const json = (await res.json()) as { status?: string };
          if (json.status === 'active') {
            setStatus('active');
            if (interval) clearInterval(interval);
            return;
          }
          if (json.status === 'expired') {
            setStatus('failed');
            if (interval) clearInterval(interval);
            return;
          }
          setStatus('pending');
          return;
        }
      } catch {
      }

      const dbStatus = await checkDb();
      if (cancelled || !dbStatus) return;
      setStatus(dbStatus);
      if (dbStatus !== 'pending' && interval) clearInterval(interval);
    };

    check();
    // Interval polling tidak boleh lebih sering dari batas server
    // (VERIFY_CHECK_WINDOW 15 dtk di lib/server/verify-throttle.ts).
    interval = setInterval(() => {
      elapsed += 15000;
      if (elapsed >= 180000) {
        clearInterval(interval);
        return;
      }
      check();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [externalId]);

  if (!plan) {
    // `plan` kosong ATAU tidak dikenal (mis. 'standard' alih-alih 'standar').
    // Halaman ini tidak punya bukti apa pun soal status langganan pengguna,
    // jadi yang ditampilkan hanya pilihan paket — bukan "Langganan Aktif".
    return (
      <main className="min-h-screen bg-secondary">
        <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-4 text-center">
          <h1 className="font-display text-2xl font-medium text-foreground">Langganan ReBites</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {planSlug
              ? 'Paket yang dipilih tidak dikenali. Pilih paket langganan terlebih dahulu.'
              : 'Pilih paket langganan terlebih dahulu.'}
          </p>
          <Link href="/#langganan" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-white">
            Lihat Paket
          </Link>
          <Link href="/dashboard/penjual/langganan" className="mt-3 text-xs font-semibold text-primary hover:underline">
            Cek langganan saya
          </Link>
        </div>
      </main>
    );
  }

  const periodEnd = computePeriodEnd(billing).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (status === 'pending') {
    return (
      <main className="min-h-screen bg-secondary">
        <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-4 py-10">
          <div className="w-full rounded-3xl border border-border bg-white p-8 text-center shadow-[0_24px_48px_-32px_rgba(42,55,49,0.35)] sm:p-10">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-[0_16px_32px_-16px_rgba(245,158,11,0.6)]">
              <Clock className="h-7 w-7" />
            </span>
            <h1 className="mt-5 font-display text-2xl font-medium tracking-tight text-foreground">Menunggu Pembayaran</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Selesaikan pembayaran di halaman Xendit. Langganan <strong className="text-foreground">ReBites {plan.name}</strong> akan aktif otomatis setelah pembayaran terverifikasi.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Memverifikasi
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <Link href="/dashboard/penjual/langganan" className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground">
                Cek Langganan
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (status === 'failed') {
    return (
      <main className="min-h-screen bg-secondary">
        <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-4 py-10">
          <div className="w-full rounded-3xl border border-border bg-white p-8 text-center shadow-[0_24px_48px_-32px_rgba(42,55,49,0.35)] sm:p-10">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-white">
              <XCircle className="h-7 w-7" />
            </span>
            <h1 className="mt-5 font-display text-2xl font-medium tracking-tight text-foreground">Pembayaran Gagal</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Pembayaran kadaluarsa atau dibatalkan. Silakan coba lagi.</p>
            <Link href="/dashboard/penjual/langganan" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-white">
              Kembali ke Langganan
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-secondary">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-4 py-10">
        <div className="w-full rounded-3xl border border-border bg-white p-8 text-center shadow-[0_24px_48px_-32px_rgba(42,55,49,0.35)] sm:p-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-[0_16px_32px_-16px_rgba(27,77,50,0.6)]">
            <Check className="h-7 w-7" strokeWidth={3} />
          </span>
          <h1 className="mt-5 font-display text-2xl font-medium tracking-tight text-foreground">Langganan Aktif!</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Selamat! Paket <strong className="text-foreground">ReBites {plan.name}</strong> kamu sudah aktif hingga{' '}
            <strong className="text-foreground">{periodEnd}</strong>.
          </p>
          <dl className="mt-6 space-y-2.5 rounded-2xl bg-muted p-4 text-left text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Paket</dt>
              <dd className="font-medium text-foreground">ReBites {plan.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Siklus</dt>
              <dd className="font-medium capitalize text-foreground">{billing === 'yearly' ? 'Tahunan' : 'Bulanan'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-2.5">
              <dt className="text-muted-foreground">Perpanjangan berikutnya</dt>
              <dd className="font-medium text-foreground">{periodEnd}</dd>
            </div>
          </dl>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href={resolvePostPaymentHref({ hasStore })}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-sm shadow-primary/25 hover:bg-primary-dark"
            >
              <LayoutDashboard className="h-4 w-4" />
              {hasStore ? 'Ke Dashboard Penjual' : 'Ke Beranda'}
            </Link>
            <Link href="/dashboard/penjual/langganan" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-primary px-5 text-sm font-semibold text-primary hover:bg-primary-dark/20">
              <Store className="h-4 w-4" />
              Cek Langganan
            </Link>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Pembayaran diproses aman via Xendit.</p>
        </div>
      </div>
    </main>
  );
}
