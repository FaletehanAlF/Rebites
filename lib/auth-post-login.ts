'use client';

/**
 * Jalur pasca-autentikasi bersama (login email, OTP, dan Google OAuth).
 *
 * Diekstrak dari `finishAuth()` di `app/components/auth/auth-form.tsx` agar
 * callback OAuth memakai aturan yang SAMA:
 *   1. baca role dari `public.profiles` (bukan user metadata),
 *   2. catat `activity_logs` bertipe `login` (non-blokir),
 *   3. tentukan tujuan: redirect eksplisit → onboarding penjual (?plan=) →
 *      beranda per role → fallback.
 *
 * Tidak ada query tulis ke `profiles`, tidak ada pembuatan profil, dan tidak
 * ada merge akun: profil tetap dibuat trigger `handle_new_user`.
 */

import { supabase } from './supabase';
import {
  CurrentUserRoleError,
  fetchCurrentUserRole,
  getHomePathForRole,
  type UserRole,
} from './current-user';
import { isSafeInternalPath } from './safe-path';

const SELLER_PLANS = ['basic', 'standar', 'premium'] as const;

export interface PostLoginContext {
  /** Nilai `?redirect=` mentah (divalidasi di sini). */
  redirectParam?: string | null;
  /** Nilai `?plan=` mentah (onboarding penjual). */
  plan?: string | null;
  /** Nilai `?billing=` mentah. */
  billing?: string | null;
  /**
   * true: akun boleh belum punya baris profil (alur signup / OAuth akun baru)
   * sehingga tidak berhenti dengan error role. false: perilaku login existing
   * (role kosong = error jelas, bukan diam-diam dianggap pembeli).
   */
  allowMissingProfile: boolean;
  /** Tujuan cadangan bila tidak ada redirect/plan/role. */
  fallback: string;
  /** false untuk melewati pencatatan activity log (mis. pencegah duplikat). */
  logLogin?: boolean;
}

export type PostLoginResult =
  | { ok: true; destination: string; role: UserRole | null }
  | { ok: false; message: string };

function getSellerOnboardingTarget(
  plan: string | null | undefined,
  billing: string | null | undefined
): string | null {
  const planParam = plan ?? '';
  if (!(SELLER_PLANS as readonly string[]).includes(planParam)) return null;
  const billingParam = billing === 'yearly' ? 'yearly' : 'monthly';
  return `/auth/register/penjual?plan=${planParam}&billing=${billingParam}`;
}

/**
 * Selesaikan sesi yang sudah aktif: baca role, catat login, hitung tujuan.
 * Pemanggil yang melakukan redirect (AuthForm memakai `window.location.href`,
 * callback memakai `router.replace`) agar tidak ada dua lapisan navigasi.
 */
export async function completeAuthSession(
  userId: string | null,
  context: PostLoginContext
): Promise<PostLoginResult> {
  const safeRedirect = isSafeInternalPath(context.redirectParam)
    ? context.redirectParam
    : null;
  const penjualRegisterTarget = getSellerOnboardingTarget(
    context.plan,
    context.billing
  );

  let role: UserRole | null = null;
  try {
    role = await fetchCurrentUserRole(userId);
  } catch (err) {
    if (err instanceof CurrentUserRoleError) {
      return { ok: false, message: err.message };
    }
    return { ok: false, message: 'Gagal membaca peran akun. Silakan coba lagi.' };
  }

  if (!context.allowMissingProfile && role === null) {
    return {
      ok: false,
      message: 'Peran akun tidak ditemukan. Hubungi administrator ReBites.',
    };
  }

  if (context.logLogin !== false && userId) {
    try {
      await supabase.from('activity_logs').insert({
        user_id: userId,
        activity_type: 'login',
        description: 'Masuk ke ReBites.',
        metadata: { role: role ?? null },
      });
    } catch {
      // Logging aktivitas bersifat non-blokir agar login tetap berjalan.
    }
  }

  const roleHome = role ? getHomePathForRole(role) : context.fallback;
  const destination =
    safeRedirect || penjualRegisterTarget || roleHome || context.fallback;

  return { ok: true, destination, role };
}
