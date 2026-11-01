/**
 * Server-only helper: seller status untuk Admin User Management.
 *
 * Definisi "subscription aktif" DIREPLIKASI dari logic existing
 * lib/subscription-storage.ts (getActiveSubscription):
 *   status === 'active' DAN current_period_end > sekarang,
 *   dinilai pada subscription TERBARU per UMKM
 *   (getSubscription: order created_at desc, limit 1).
 * Helper ini tidak mengimpor kode client agar dapat dipakai route server
 * untuk user mana pun (bukan hanya pemilik sesi).
 *
 * seller_status TIDAK PERNAH diturunkan dari profiles.role.
 */

export type SellerStatus = 'active' | 'no_subscription' | 'no_store';

export type SubscriptionLike = Record<string, unknown>;

/**
 * Cerminan getActiveSubscription(): status harus 'active' dan periode
 * belum berakhir. current_period_end NULL/kadaluarsa = tidak aktif.
 */
export function isSubscriptionActivePeriod(
  sub: SubscriptionLike | null | undefined,
  now: number = Date.now()
): boolean {
  if (!sub || sub.status !== 'active') return false;
  const end = sub.current_period_end;
  if (typeof end !== 'string' || !end) return false;
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(endMs)) return false;
  return endMs > now;
}

export function resolveSellerStatus(
  hasUmkm: boolean,
  latestSubscription: SubscriptionLike | null | undefined,
  now: number = Date.now()
): SellerStatus {
  if (!hasUmkm) return 'no_store';
  return isSubscriptionActivePeriod(latestSubscription, now) ? 'active' : 'no_subscription';
}
