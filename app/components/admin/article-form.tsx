'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import {
  uploadArticleCover,
  type AdminArticleItem,
  type ArticlePayload,
  type UmkmOption,
} from '@/lib/admin-articles';
import { COVER_IMAGE_ERROR, isArticleCoverUrl } from '@/lib/article-cover';

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

export interface ArticleFormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  umkmId: string;
  category: string;
  tags: string;
}

function toFormState(a: AdminArticleItem | null): ArticleFormState {
  return {
    title: a?.title ?? '',
    slug: a?.slug ?? '',
    excerpt: a?.excerpt ?? '',
    content: a?.content ?? '',
    coverImage: a?.cover_image ?? '',
    umkmId: a?.umkm_id ?? '',
    category: a?.category ?? '',
    tags: Array.isArray(a?.tags) ? (a?.tags as string[]).join(', ') : '',
  };
}

export function articleFormToPayload(form: ArticleFormState): ArticlePayload {
  const tags = form.tags
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return {
    title: form.title.trim(),
    slug: form.slug.trim(),
    excerpt: form.excerpt.trim() ? form.excerpt.trim() : null,
    content: form.content.trim(),
    cover_image: form.coverImage.trim() ? form.coverImage.trim() : null,
    umkm_id: form.umkmId.trim() ? form.umkmId.trim() : null,
    category: form.category.trim() ? form.category.trim() : null,
    tags,
  };
}

interface ArticleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AdminArticleItem | null;
  umkms: UmkmOption[];
  saving: boolean;
  formError: string;
  onSubmit: (payload: ArticlePayload) => void;
}

export function ArticleForm({
  open,
  onOpenChange,
  editing,
  umkms,
  saving,
  formError,
  onSubmit,
}: ArticleFormProps) {
  const [form, setForm] = useState<ArticleFormState>(() => toFormState(editing));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(toFormState(editing));
      setUploadError('');
    }
  }, [open, editing]);

  const set = (key: keyof ArticleFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const url = await uploadArticleCover(file);
      setForm((prev) => ({ ...prev, coverImage: url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload cover gagal.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Cover opsional, tetapi bila diisi harus URL Storage ReBites
  // (server tetap memvalidasi ulang agar request manual tidak lolos).
  const coverOriginError =
    form.coverImage.trim() &&
    !isArticleCoverUrl(form.coverImage, process.env.NEXT_PUBLIC_SUPABASE_URL)
      ? COVER_IMAGE_ERROR
      : '';

  const canSubmit =
    form.title.trim().length > 0 &&
    form.slug.trim().length > 0 &&
    form.content.trim().length > 0 &&
    !coverOriginError &&
    !saving &&
    !uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Artikel' : 'Tambah Artikel'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Ubah field konten artikel. Status hanya berubah via tombol Publish/Unpublish.'
              : 'Artikel baru selalu tersimpan sebagai Draft.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="article-title">Judul *</Label>
            <Input
              id="article-title"
              value={form.title}
              onChange={set('title')}
              placeholder="Judul artikel"
              maxLength={200}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="article-slug">Slug *</Label>
            <div className="flex gap-2">
              <Input
                id="article-slug"
                value={form.slug}
                onChange={set('slug')}
                placeholder="judul-artikel"
                maxLength={200}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForm((prev) => ({ ...prev, slug: slugify(prev.title) }))}
              >
                Dari judul
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="article-excerpt">Excerpt</Label>
            <Textarea
              id="article-excerpt"
              value={form.excerpt}
              onChange={set('excerpt')}
              placeholder="Ringkasan singkat artikel"
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="article-content">Konten *</Label>
            <Textarea
              id="article-content"
              value={form.content}
              onChange={set('content')}
              placeholder="Isi artikel"
              rows={8}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="article-cover">Cover image</Label>
            <div className="flex flex-col gap-2">
              <Input
                id="article-cover-file"
                type="file"
                accept="image/*"
                onChange={handleFile}
                disabled={uploading || saving}
              />
              <Input
                id="article-cover"
                value={form.coverImage}
                onChange={set('coverImage')}
                placeholder="URL cover (otomatis terisi setelah upload)"
                maxLength={1000}
              />
              {uploading && <p className="text-xs text-sage-500">Mengupload cover…</p>}
              {uploadError && <p className="text-xs font-medium text-red-600">{uploadError}</p>}
              {coverOriginError && (
                <p className="text-xs font-medium text-red-600">{coverOriginError}</p>
              )}
              {form.coverImage.trim() && (
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.coverImage.trim()}
                    alt="Pratinjau cover"
                    className="h-20 w-32 rounded-lg border object-cover"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((prev) => ({ ...prev, coverImage: '' }))}
                  >
                    Hapus cover
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="article-author">Author</Label>
              <Input id="article-author" value="ReBites" readOnly disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="article-umkm">UMKM (opsional)</Label>
              <select
                id="article-umkm"
                value={form.umkmId}
                onChange={set('umkmId')}
                className="rounded-xl border border-border/70 bg-white px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-primary"
              >
                <option value="">Tanpa UMKM</option>
                {umkms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="article-category">Kategori</Label>
              <Input
                id="article-category"
                value={form.category}
                onChange={set('category')}
                placeholder="mis. promo"
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="article-tags">Tags (pisahkan koma)</Label>
              <Input
                id="article-tags"
                value={form.tags}
                onChange={set('tags')}
                placeholder="hemat, umkm, promo"
              />
            </div>
          </div>

          {formError && <p className="text-sm font-medium text-red-600">{formError}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(articleFormToPayload(form))}
          >
            {saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Buat Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
