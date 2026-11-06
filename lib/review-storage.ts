'use client';

import { supabase } from './supabase';
import type { OrderReview } from './types';
import type { Review } from '@/app/components/detail-product/data';

type ReviewRow = Record<string, any>;

function rowToDisplayReview(row: ReviewRow): Review {
  const created = row.created_at ? new Date(row.created_at) : null;
  return {
    id: String(row.id ?? ''),
    reviewerName: row.author_name?.trim() || 'Pembeli ReBites',
    avatar: row.author_avatar ?? '',
    rating: Number(row.rating ?? 5),
    comment: row.comment ?? '',
    date: created
      ? created.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '',
  };
}

async function resolveProductId(slug: string): Promise<string | null> {
  if (!slug) return null;
  // Hanya produk approved yang boleh punya ulasan yang tampil publik.
  // Konsisten dengan filter di detail-data.ts, dan menutup jalur ini
  // sebelum migration 20261011000000 (RLS) diterapkan.
  const { data } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .eq('verification_status', 'approved')
    .maybeSingle();
  return data?.id ?? null;
}

async function resolveUmkmId(slug: string): Promise<string | null> {
  if (!slug) return null;
  const { data } = await supabase
    .from('umkm_profiles')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getProductReviews(
  productSlug: string
): Promise<Review[]> {
  const productId = await resolveProductId(productSlug);
  if (!productId) return [];
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(12);
  if (error || !data) return [];
  return data.map(rowToDisplayReview);
}

export async function getServiceReviews(storeSlug: string): Promise<Review[]> {
  const umkmId = await resolveUmkmId(storeSlug);
  if (!umkmId) return [];
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('umkm_id', umkmId)
    .eq('kind', 'service')
    .order('created_at', { ascending: false })
    .limit(9);
  if (error || !data) return [];
  return data.map(rowToDisplayReview);
}

export async function getSellerProductReviewCount(): Promise<number> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return 0;
  const umkm = await supabase
    .from('umkm_profiles')
    .select('id')
    .eq('user_id', uid)
    .maybeSingle();
  if (!umkm.data) return 0;
  const { count, error } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('umkm_id', (umkm.data as Record<string, any>).id);
  if (error) return 0;
  return count ?? 0;
}

function rowToOrderReview(row: ReviewRow): OrderReview {
  return {
    orderId: row.order_code ?? '',
    userId: row.user_id,
    rating: Number(row.rating),
    comment: row.comment ?? '',
    createdAt: row.created_at,
  };
}

export async function getReviewFor(
  orderId: string,
  userId: string
): Promise<OrderReview | undefined> {
  if (!orderId || !userId) return undefined;
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('order_code', orderId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return undefined;
  return rowToOrderReview(data);
}

export const REVIEWS_UPDATED_EVENT = 'rebites-reviews-updated';

function dispatchReviewsUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(REVIEWS_UPDATED_EVENT));
}

export interface SellerReview {
  id: string;
  orderCode: string;
  orderId: string | null;
  productId: string | null;
  umkmId: string | null;
  rating: number;
  comment: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string;
  menuName: string;
  userId: string;
}

function rowToSellerReview(row: ReviewRow): SellerReview {
  return {
    id: String(row.id ?? ''),
    orderCode: row.order_code ?? '',
    orderId: row.order_id ?? null,
    productId: row.product_id ?? null,
    umkmId: row.umkm_id ?? null,
    rating: Number(row.rating ?? 0),
    comment: row.comment ?? '',
    createdAt: row.created_at ?? new Date().toISOString(),
    authorName: row.author_name?.trim() || 'Pembeli ReBites',
    authorAvatar: row.author_avatar ?? '',
    menuName: row.menu_name ?? '',
    userId: row.user_id ?? '',
  };
}

export async function getSellerReviews(): Promise<SellerReview[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return [];
  const { data: umkm } = await supabase
    .from('umkm_profiles')
    .select('id')
    .eq('user_id', uid)
    .maybeSingle();
  if (!umkm?.id) return [];
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('umkm_id', umkm.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data.map(rowToSellerReview);
}

export async function saveReview(review: OrderReview): Promise<void> {
  if (review.rating < 1 || review.rating > 5) {
    throw new Error('Rating harus 1-5');
  }
  
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('id, product_id, umkm_id, product_name, lifecycle_status, buyer_id')
    .eq('order_code', review.orderId)
    .maybeSingle();
  if (orderError || !orderRow) {
    console.error('[review-storage] pesanan tidak ditemukan:', orderError?.message);
    throw new Error('Pesanan tidak ditemukan');
  }
  if ((orderRow as Record<string, any>).lifecycle_status !== 'completed') {
    throw new Error('Pesanan belum selesai, belum bisa diberi ulasan');
  }
  if ((orderRow as Record<string, any>).buyer_id !== review.userId) {
    throw new Error('Hanya pembeli pesanan yang dapat memberi ulasan');
  }

  // Produk ditolak/di-takedown setelah pesanan dibuat tidak boleh mendapat
  // ulasan BARU. Ulasan lama tidak dihapus (tidak ada perubahan data di sini);
  // yang dicegah hanya penambahan baru untuk produk non-approved.
  const orderProductId = (orderRow as Record<string, any>).product_id;
  if (orderProductId) {
    const { data: reviewedProduct } = await supabase
      .from('products')
      .select('id')
      .eq('id', orderProductId)
      .eq('verification_status', 'approved')
      .maybeSingle();
    if (!reviewedProduct) {
      throw new Error('Produk ini sedang tidak tersedia untuk diberi ulasan');
    }
  }
  
  let authorName: string | null = null;
  let authorAvatar: string | null = null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, email')
    .eq('id', review.userId)
    .maybeSingle();
  if (profile) {
    const p = profile as Record<string, any>;
    authorName = p.full_name?.trim() || p.email?.split('@')[0] || null;
    authorAvatar = p.avatar_url || null;
  }
  if (!authorName) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authorName =
      (user?.user_metadata as Record<string, any>)?.full_name ||
      user?.email?.split('@')[0] ||
      'Pembeli ReBites';
    authorAvatar = (user?.user_metadata as Record<string, any>)?.avatar_url || null;
  }

  const payload = {
    order_id: (orderRow as Record<string, any>).id,
    product_id: (orderRow as Record<string, any>).product_id,
    umkm_id: (orderRow as Record<string, any>).umkm_id,
    order_code: review.orderId,
    user_id: review.userId,
    kind: 'product',
    rating: review.rating,
    comment: review.comment?.trim() ?? '',
    author_name: authorName,
    author_avatar: authorAvatar,
    menu_name: (orderRow as Record<string, any>).product_name ?? '',
  };

  // Upsert manual: index unik (user_id, order_code) sebelumnya partial, jadi
  // ON CONFLICT supabase-js selalu gagal (42P10) dan rating tidak tersimpan.
  // Cek dulu review existing, lalu update / insert.
  const { data: existingReview } = await supabase
    .from('reviews')
    .select('id')
    .eq('user_id', review.userId)
    .eq('order_code', review.orderId)
    .maybeSingle();

  const { error } = existingReview
    ? await supabase
        .from('reviews')
        .update(payload)
        .eq('id', (existingReview as Record<string, any>).id)
    : await supabase.from('reviews').insert(payload);
  if (error) {
    console.error('[review-storage] gagal menyimpan review:', error.message);
    throw error;
  }
  dispatchReviewsUpdated();
}
