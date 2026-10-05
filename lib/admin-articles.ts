'use client';

import { supabase } from './supabase';
import { AdminAuthError, getAdminAuthHeader } from './admin-auth';

export type ArticleStatus = 'draft' | 'published' | 'archived';

export interface AdminArticleAuthor {
  id: string | null;
  full_name: string | null;
  email: string | null;
}

export interface AdminArticleItem {
  id: string;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  cover_image: string | null;
  status: ArticleStatus | string | null;
  published_at: string | null;
  author_id: string | null;
  umkm_id: string | null;
  category: string | null;
  tags: string[] | null;
  created_at: string | null;
  updated_at: string | null;
  author: AdminArticleAuthor | null;
}

export interface AdminArticleListResult {
  articles: AdminArticleItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ArticleFormValues {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string;
  author_id: string;
  umkm_id: string;
  category: string;
  tags: string;
}

export class AdminArticlesApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminArticlesApiError';
    this.status = status;
  }
}

async function authHeader(): Promise<string> {
  try {
    return await getAdminAuthHeader();
  } catch (err) {
    if (err instanceof AdminAuthError) {
      throw new AdminArticlesApiError(err.message, 401);
    }
    throw err;
  }
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new AdminArticlesApiError(json?.error ?? fallback, res.status);
}

export async function fetchAdminArticles(
  limit = 20,
  offset = 0,
  search = '',
  status: '' | ArticleStatus = ''
): Promise<AdminArticleListResult> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (search.trim()) params.set('search', search.trim());
  if (status) params.set('status', status);
  const res = await fetch(`/api/admin/articles?${params.toString()}`, {
    headers: { Authorization: await authHeader() },
  });
  if (!res.ok) {
    await parseError(res, 'Gagal memuat daftar artikel.');
  }
  const json = (await res.json().catch(() => null)) as AdminArticleListResult | null;
  if (!json || !Array.isArray(json.articles)) {
    throw new AdminArticlesApiError('Respons daftar artikel tidak valid.', 500);
  }
  return {
    articles: json.articles,
    total: json.total ?? json.articles.length,
    limit: json.limit ?? limit,
    offset: json.offset ?? offset,
  };
}

export interface ArticlePayload {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  umkm_id: string | null;
  category: string | null;
  tags: string[];
}

/** Frontend tidak pernah mengirim status/published_at/author_id (dipaksa server). */
export async function createAdminArticle(payload: ArticlePayload): Promise<AdminArticleItem> {
  const res = await fetch('/api/admin/articles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: await authHeader(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, 'Gagal membuat artikel.');
  }
  const json = (await res.json().catch(() => null)) as {
    article?: AdminArticleItem;
  } | null;
  if (!json || !json.article) {
    throw new AdminArticlesApiError('Respons buat artikel tidak valid.', 500);
  }
  return json.article;
}

export async function updateAdminArticle(
  id: string,
  payload: ArticlePayload
): Promise<AdminArticleItem> {
  const res = await fetch(`/api/admin/articles/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: await authHeader(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, 'Gagal mengubah artikel.');
  }
  const json = (await res.json().catch(() => null)) as {
    article?: AdminArticleItem;
  } | null;
  if (!json || !json.article) {
    throw new AdminArticlesApiError('Respons ubah artikel tidak valid.', 500);
  }
  return json.article;
}

export async function publishAdminArticle(
  id: string,
  published: boolean
): Promise<AdminArticleItem> {
  const res = await fetch(`/api/admin/articles/${encodeURIComponent(id)}/publish`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: await authHeader(),
    },
    body: JSON.stringify({ published }),
  });
  if (!res.ok) {
    await parseError(res, published ? 'Gagal mempublish artikel.' : 'Gagal mengembalikan artikel ke draft.');
  }
  const json = (await res.json().catch(() => null)) as {
    article?: AdminArticleItem;
  } | null;
  if (!json || !json.article) {
    throw new AdminArticlesApiError('Respons publish artikel tidak valid.', 500);
  }
  return json.article;
}

export async function deleteAdminArticle(id: string): Promise<void> {
  const res = await fetch(`/api/admin/articles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: await authHeader() },
  });
  if (!res.ok) {
    await parseError(res, 'Gagal menghapus artikel.');
  }
}

const MAX_COVER_BYTES = 5 * 1024 * 1024;

/**
 * Upload cover ke bucket article-images memakai sesi authenticated
 * browser (anon client + JWT user), BUKAN service role. RLS INSERT
 * mengizinkan authenticated; owner otomatis = uploader.
 */
export async function uploadArticleCover(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new AdminArticlesApiError('File harus berupa gambar.', 400);
  }
  if (file.size > MAX_COVER_BYTES) {
    throw new AdminArticlesApiError('Ukuran gambar maksimal 5MB.', 400);
  }
  const safeName = (file.name || 'cover.jpg').replace(/[^\w.\-]+/g, '_');
  const path = `covers/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('article-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    throw new AdminArticlesApiError(`Upload cover gagal: ${error.message}`, 500);
  }
  const { data } = supabase.storage.from('article-images').getPublicUrl(path);
  if (!data.publicUrl) {
    throw new AdminArticlesApiError('Gagal mendapatkan URL cover.', 500);
  }
  return data.publicUrl;
}

export interface UmkmOption {
  id: string;
  label: string;
}

/** Dropdown UMKM memakai GET /api/admin/umkm yang sudah ada (opsional). */
export async function fetchUmkmOptions(search = ''): Promise<UmkmOption[]> {
  const params = new URLSearchParams({ limit: '100', offset: '0' });
  if (search.trim()) params.set('search', search.trim());
  const res = await fetch(`/api/admin/umkm?${params.toString()}`, {
    headers: { Authorization: await authHeader() },
  });
  if (!res.ok) {
    await parseError(res, 'Gagal memuat daftar UMKM.');
  }
  const json = (await res.json().catch(() => null)) as {
    umkm?: { id: string | null; business_name: string | null }[];
  } | null;
  const rows = json?.umkm ?? [];
  return rows
    .filter((u) => typeof u.id === 'string' && u.id.length > 0)
    .map((u) => ({
      id: u.id as string,
      label: (u.business_name?.trim() || u.id) as string,
    }));
}
