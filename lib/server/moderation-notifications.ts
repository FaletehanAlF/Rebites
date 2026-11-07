import type { SupabaseClient } from '@supabase/supabase-js';
import { sellerStorePath } from '@/lib/seller-store-path';
export type ModerationVerdict = 'approved' | 'rejected';
export interface NotifySellerModerationInput {
    productId: string;
    umkmUserId: string;
    umkmId: string;
    productName: string;
    verdict: ModerationVerdict;
    reason?: string | null;
}
export async function notifySellerModeration(db: SupabaseClient, input: NotifySellerModerationInput): Promise<{
    inserted: boolean;
}> {
    const productId = input.productId?.trim();
    const umkmUserId = input.umkmUserId?.trim();
    if (!productId || !umkmUserId)
        return { inserted: false };
    const productName = input.productName?.trim() || 'Produk';
    const type = input.verdict === 'approved' ? 'product_approved' : 'product_rejected';
    const title = input.verdict === 'approved' ? 'Produk Disetujui' : 'Produk Ditolak';
    const message = input.verdict === 'approved'
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
    if (checkErr)
        throw checkErr;
    if (existing && existing.length > 0)
        return { inserted: false };
    const { error: insertErr } = await db.from('notifications').insert({
        user_id: umkmUserId,
        role: 'seller',
        type,
        title,
        message,
        reference_id: productId,
        href: sellerStorePath(input.umkmId, 'menu'),
        read: false,
    });
    if (insertErr)
        throw insertErr;
    return { inserted: true };
}
