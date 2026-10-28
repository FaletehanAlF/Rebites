'use client';

import { supabase } from './supabase';

export const FAVORITE_UPDATED_EVENT = 'rebites:favorite-updated';

export interface LikedFood {
  id: string;
  productId: string;
  name?: string;
  image?: string | null;
  price?: number | null;
}

async function getSessionUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function dispatchUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FAVORITE_UPDATED_EVENT));
  }
}

async function resolveProductId(key: string): Promise<string | null> {
  const trimmed = key.trim();
  if (!trimmed) return null;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) return trimmed;
  
  try {
    const { data } = await supabase.from('products').select('id').eq('id', trimmed).eq('verification_status', 'approved').maybeSingle();
    if (data?.id) return data.id;
  } catch {}
  try {
    const { data } = await supabase.from('products').select('id').eq('slug', trimmed).eq('verification_status', 'approved').maybeSingle();
    if (data?.id) return data.id;
  } catch {}
  
  return trimmed;
}

export async function isFavorited(productKey: string): Promise<boolean> {
  try {
    const userId = await getSessionUserId();
    if (!userId) return false;
    const productId = await resolveProductId(productKey);
    if (!productId) return false;
    const { data } = await supabase
      .from('product_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function setFavorite(productKey: string, favorite: boolean): Promise<boolean> {
  const userId = await getSessionUserId();
  if (!userId) {
    if (typeof window !== 'undefined') window.location.href = '/auth/login';
    return false;
  }
  const productId = await resolveProductId(productKey);
  if (!productId) return false;

  if (favorite) {
    const { data: existing } = await supabase
      .from('product_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle();
    if (existing) {
      dispatchUpdated();
      return true;
    }
    const { error } = await supabase.from('product_favorites').insert({ user_id: userId, product_id: productId });
    if (error) {
      
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('rebites_favorites');
          const arr: string[] = raw ? JSON.parse(raw) : [];
          if (!arr.includes(productKey)) {
            arr.push(productKey);
            localStorage.setItem('rebites_favorites', JSON.stringify(arr));
            dispatchUpdated();
            return true;
          }
        } catch {}
      }
      console.error('[liked-foods] gagal suka:', error.message);
      return false;
    }
    dispatchUpdated();
    
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('rebites_favorites');
        const arr: string[] = raw ? JSON.parse(raw) : [];
        if (!arr.includes(productKey)) {
          arr.push(productKey);
          localStorage.setItem('rebites_favorites', JSON.stringify(arr));
        }
      } catch {}
    }
    return true;
  }

  const { error } = await supabase
    .from('product_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);
  if (error) {
    
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('rebites_favorites');
        const arr: string[] = raw ? JSON.parse(raw) : [];
        const next = arr.filter((id) => id !== productKey);
        localStorage.setItem('rebites_favorites', JSON.stringify(next));
        dispatchUpdated();
        return true;
      } catch {}
    }
    console.error('[liked-foods] gagal batal suka:', error.message);
    return false;
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('rebites_favorites');
      const arr: string[] = raw ? JSON.parse(raw) : [];
      const next = arr.filter((id) => id !== productKey);
      localStorage.setItem('rebites_favorites', JSON.stringify(next));
    } catch {}
  }
  dispatchUpdated();
  return true;
}

export async function getLikedFoods(): Promise<LikedFood[]> {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('rebites_favorites');
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) return arr.map((id: string) => ({ id: String(id), productId: String(id) }));
          }
        } catch {}
      }
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('product_favorites')
        .select('product_id, created_at, products(id, slug, name, image_url, surplus_price, original_price)')
        .eq('user_id', userId)
        .eq('products.verification_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) {
        return data.map((row: any) => {
          const prod = row.products as { id: string; slug: string | null; name: string | null; image_url: string | null; surplus_price: number | null; original_price: number | null } | null;
          return {
            id: String(row.product_id),
            productId: String(row.product_id),
            name: prod?.name ?? undefined,
            image: prod?.image_url ?? null,
            price: prod?.surplus_price ?? prod?.original_price ?? null,
          };
        });
      }
    } catch {}

    const tables = ['favorites', 'liked_foods', 'food_likes'];
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('id, product_id, food_id, name').eq('user_id', userId).limit(100);
        if (!error && data) {
          return data.map((row: any) => ({
            id: String(row.id ?? row.product_id ?? row.food_id ?? ''),
            productId: String(row.product_id ?? row.food_id ?? row.id ?? ''),
            name: row.name ?? undefined,
          }));
        }
      } catch {
        continue;
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('rebites_favorites');
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) return arr.map((id: string) => ({ id: String(id), productId: String(id) }));
        }
      } catch {}
    }

    return [];
  } catch {
    return [];
  }
}
