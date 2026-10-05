import type { SupabaseClient } from '@supabase/supabase-js';

export type ModerationVerdict = 'approved' | 'rejected';

export interface NotifySellerModerationInput {
  productId: string;
  umkmUserId: string;
  productName: string;
  verdict: ModerationVerdict;
  reason?: string | null;
}

const SELLER_MENU_HREF = '/dashboard/penjual/menu';

/**
 * Helper server terpusat untuk notifikasi hasil moderasi produk ke seller.
 * Dipanggil best-effort dari API approve/reject setelah moderation_logs berhasil.
 *
 * Menerima SupabaseClient server (authed admin client) dari caller agar
 * mengikuti pola existing project dan tidak memakai helper client-side
 * `createNotification()` maupun mengekspos service role ke client.
 */
export async function notifySellerModeration(
  db: SupabaseClient,
  input: NotifySellerModerationInput
): Promise<{ inserted: boolean }> {
  const productId = input.productId?.trim();
  const umkmUserId = input.umkmUserId?.trim();
  if (!productId || !umkmUserId) return { inserted: false };

  const productName = input.productName?.trim() || 'Produk';
  const type =
    input.verdict === 'approved' ? 'product_approved' : 'product_rejected';
  const title =
    input.verdict === 'approved' ? 'Produk Disetujui' : 'Produk Ditolak';
  const message =
    input.verdict === 'approved'
      ? `Produk "${productName}" telah disetujui dan dapat ditampilkan di marketplace.`
      : `Produk "${productName}" ditolak. Alasan: ${input.reason?.trim() || '-'}`;

  const { data: existing, error: checkErr } = await db
    .from('notifications')
    .select('id')
    .eq('user_id', umkmUserId)
    .eq('role', 'seller')
    .eq('type', type)
    .eq('reference_id', productId)
    .limit(1);
  if (checkErr) throw checkErr;
  if (existing && existing.length > 0) return { inserted: false };

  const { error: insertErr } = await db.from('notifications').insert({
    user_id: umkmUserId,
    role: 'seller',
    type,
    title,
    message,
    reference_id: productId,
    href: SELLER_MENU_HREF,
    read: false,
  });
  if (insertErr) throw insertErr;

  return { inserted: true };
}
