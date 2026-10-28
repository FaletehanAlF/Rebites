/**
 * Validasi origin Cover Image artikel.
 *
 * Cover HANYA boleh berasal dari bucket Supabase Storage `article-images`
 * (hasil upload via fitur Cover Image). URL eksternal (Pinterest, Unsplash,
 * Google Images, domain lain) ditolak karena next/image hanya mengizinkan
 * host di next.config (pexels + *.supabase.co) sehingga URL eksternal
 * menyebabkan runtime error di halaman publik.
 *
 * Modul ini tanpa directive 'use client' agar bisa dipakai server routes
 * dan client form dari satu sumber kebenaran.
 */

export const ARTICLE_COVERS_BUCKET = 'article-images';

export const COVER_IMAGE_ERROR =
  'Cover image harus menggunakan gambar yang di-upload melalui ReBites. URL gambar dari website lain tidak diperbolehkan.';

/**
 * URL public hasil getPublicUrl() selalu berbentuk:
 *   {SUPABASE_URL}/storage/v1/object/public/article-images/{path}
 * Nilai kosong (null/undefined/'') dianggap valid karena cover opsional.
 */
export function isArticleCoverUrl(value: unknown, supabaseUrl: string | undefined | null): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'string') return false;
  const url = value.trim();
  if (!url) return true;
  const base = (supabaseUrl ?? '').trim().replace(/\/+$/, '');
  if (!base) return false;
  const prefix = `${base}/storage/v1/object/public/${ARTICLE_COVERS_BUCKET}/`;
  return url.startsWith(prefix) && url.length > prefix.length;
}
