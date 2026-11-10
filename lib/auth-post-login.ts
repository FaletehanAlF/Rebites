'use client';
import { supabase } from './supabase';
import { CurrentUserRoleError, fetchCurrentUserRole, getHomePathForRole, type UserRole, } from './current-user';
import { isSafeInternalPath } from './safe-path';
import { resolvePostLoginRoute } from './post-login-route';
import { isBlockedRoleErrorCode } from './account-block';
import { sellerStorePath } from './seller-store-path';
const BUYER_HOME = getHomePathForRole('buyer');
const SELLER_PLANS = ['basic', 'standar', 'premium'] as const;
export interface PostLoginContext {
    redirectParam?: string | null;
    plan?: string | null;
    billing?: string | null;
    allowMissingProfile: boolean;
    fallback: string;
    logLogin?: boolean;
}
export type PostLoginResult = {
    ok: true;
    destination: string;
    role: UserRole | null;
} | {
    ok: false;
    message: string;
    /** Diisi saat kegagalan murni soal sesi/peran (transien) —
     *  sesi valid tetap tersimpan dan dipanggil boleh fallback redirect. */
    kind?: 'role-error';
};
function getSellerOnboardingTarget(plan: string | null | undefined, billing: string | null | undefined): string | null {
    const planParam = plan ?? '';
    if (!(SELLER_PLANS as readonly string[]).includes(planParam))
        return null;
    const billingParam = billing === 'yearly' ? 'yearly' : 'monthly';
    return `/auth/register/penjual?plan=${planParam}&billing=${billingParam}`;
}
export async function completeAuthSession(userId: string | null, context: PostLoginContext): Promise<PostLoginResult> {
    const safeRedirectCandidate = isSafeInternalPath(context.redirectParam)
        ? context.redirectParam
        : null;
    let role: UserRole | null = null;
    try {
        role = await fetchCurrentUserRole(userId);
    }
    catch (err) {
        if (err instanceof CurrentUserRoleError) {
            if (isBlockedRoleErrorCode(err.code)) {
                try {
                    await supabase.auth.signOut();
                }
                catch {
                }
                return { ok: false, message: err.message };
            }
            return { ok: false, message: err.message, kind: 'role-error' };
        }
        return {
            ok: false,
            message: 'Gagal membaca peran akun. Silakan coba lagi.',
            kind: 'role-error',
        };
    }
    // Peran admin selalu mendarat di dashboard admin: `next` hasil guard halaman pembeli
    // (mis. /riwayatPesanan/...) tidak boleh menimpa beranda peran admin.
    const isAdminLanding = role === 'admin';
    const safeRedirect = isAdminLanding ? null : safeRedirectCandidate;
    const penjualRegisterTarget = isAdminLanding ? null : getSellerOnboardingTarget(context.plan, context.billing);
    if (!context.allowMissingProfile && role === null) {
        return {
            ok: false,
            message: 'Peran akun tidak ditemukan. Hubungi administrator ReBites.',
        };
    }
    if (context.logLogin !== false && userId && role !== 'admin') {
        try {
            await supabase.from('activity_logs').insert({
                user_id: userId,
                activity_type: 'login',
                description: 'Masuk ke ReBites.',
                metadata: { role: role ?? null },
            });
        }
        catch {
        }
    }
    const roleHome = role ? getHomePathForRole(role) : context.fallback;
    let hasStore = false;
    let storeId: string | null = null;
    if (!safeRedirect && !penjualRegisterTarget && roleHome === BUYER_HOME) {
        try {
            const { getSellerUmkmResult } = await import('./product-storage');
            const result = await getSellerUmkmResult();
            hasStore = result.kind === 'ok';
            if (result.kind === 'ok')
                storeId = result.umkm.id;
        }
        catch {
            hasStore = false;
        }
    }
    const destination = resolvePostLoginRoute({
        safeRedirect,
        sellerOnboardingTarget: penjualRegisterTarget,
        roleHome,
        buyerHome: BUYER_HOME,
        sellerHome: sellerStorePath(storeId),
        hasStore,
    });
    return { ok: true, destination, role };
}
