'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
if (!hasSupabaseConfig) {
    if (typeof window !== 'undefined') {
        (window as unknown as {
            __REBITES_SUPABASE_MISCONFIG__?: boolean;
        }).__REBITES_SUPABASE_MISCONFIG__ = true;
    }
    console.error('[ReBites] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY tidak ditemukan. ' +
        'Katalog produk akan kosong. Pastikan file .env.local ada di root project lalu restart dev server.');
}
export const supabase: SupabaseClient = createClient(supabaseUrl ?? 'http://localhost:54321', supabaseAnonKey ?? 'public-anon-key-placeholder', {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});
