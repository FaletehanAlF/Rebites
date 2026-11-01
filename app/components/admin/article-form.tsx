'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, ImageUp, Loader2, Wand2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import {
  uploadArticleCover,
  type AdminArticleItem,
  type ArticlePayload,
  type UmkmOption,
} from '@/lib/admin-articles';
import { COVER_IMAGE_ERROR, isArticleCoverUrl } from '@/lib/article-cover';
import { AdminInlineError } from './admin-state';
import { SmartImage } from '@/app/components/shared/SmartImage';

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

/** Label kecil + penghitung karakter di bawah kolom isian. */
function FieldMeta({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-[11px] font-medium tabular-nums text-sage-500">{children}</p>
  );
}

/** Judul kelompok isian supaya form panjang mudah dipindai. */
function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="text-xs font-bold uppercase tracking-[0.1em] text-sage-500">
        {title}
      </legend>
      {children}
    </fieldset>
  );
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

  const alamatPublikAktif =
    editing?.status === 'published' &&
    !!editing.slug &&
    form.slug.trim() === editing.slug.trim();

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
      setUploadError(err instanceof Error ? err.message : 'Unggah cover gagal.');
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

  const wordCount = useMemo(
    () => form.content.trim().split(/\s+/).filter(Boolean).length,
    [form.content]
  );

  const tagList = useMemo(
    () =>
      form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [form.tags]
  );

  // Slug harus sesuai pola server: huruf kecil + angka + strip.
  const slugError = useMemo(() => {
    const slug = form.slug.trim();
    if (!slug) return '';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return 'Slug hanya boleh huruf kecil, angka, dan strip (tanpa spasi atau garis miring).';
    }
    return '';
  }, [form.slug]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Ubah Artikel' : 'Tambah Artikel'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Ubah kolom konten artikel. Status hanya berubah via tombol Terbitkan/Batalkan Terbit.'
              : 'Artikel baru selalu tersimpan sebagai draf.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2">
          <FieldGroup title="Identitas artikel">
            <div className="grid gap-2">
              <Label htmlFor="article-title">Judul *</Label>
              <Input
                id="article-title"
                value={form.title}
                onChange={set('title')}
                placeholder="Judul artikel"
                maxLength={200}
              />
              <FieldMeta>{form.title.length}/200 karakter</FieldMeta>
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
                  aria-invalid={slugError ? true : undefined}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setForm((prev) => ({ ...prev, slug: slugify(prev.title) }))}
                >
                  <Wand2 aria-hidden className="h-3.5 w-3.5" />
                  Dari judul
                </Button>
              </div>
              {slugError ? (
                <p className="mt-1 text-[11px] font-medium text-destructive">{slugError}</p>
              ) : (
                <FieldMeta>
                  {form.slug.trim() ? (
                    alamatPublikAktif ? (
                      <Link
                        href={`/artikel/${form.slug.trim()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        /artikel/{form.slug.trim()}
                        <ExternalLink aria-hidden className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span>
                        /artikel/{form.slug.trim()} · tautan publik aktif setelah artikel
                        diterbitkan dan slug disimpan.
                      </span>
                    )
                  ) : (
                    'Alamat publik artikel muncul di sini setelah slug diisi.'
                  )}
                </FieldMeta>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="article-excerpt">Ringkasan</Label>
              <Textarea
                id="article-excerpt"
                value={form.excerpt}
                onChange={set('excerpt')}
                placeholder="Ringkasan singkat artikel"
                rows={3}
                maxLength={500}
              />
              <FieldMeta>{form.excerpt.length}/500 karakter</FieldMeta>
            </div>
          </FieldGroup>

          <FieldGroup title="Konten">
            <div className="grid gap-2">
              <Label htmlFor="article-content">Isi artikel *</Label>
              <Textarea
                id="article-content"
                value={form.content}
                onChange={set('content')}
                placeholder="Isi artikel"
                rows={12}
                className="font-normal leading-relaxed"
              />
              <FieldMeta>
                {wordCount} kata · {form.content.length} karakter
              </FieldMeta>
            </div>
          </FieldGroup>

          <FieldGroup title="Gambar sampul">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-[var(--radius)] border border-border bg-sage-100/60 sm:w-40">
                  {form.coverImage.trim() ? (
                    <SmartImage
                      src={form.coverImage.trim()}
                      alt="Pratinjau sampul"
                      sizes="160px"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-sage-500">
                      <ImageUp aria-hidden className="h-5 w-5" />
                      <span className="text-[10px] font-semibold">Belum ada sampul</span>
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor="article-cover-file" className="sr-only">
                    Unggah gambar sampul
                  </Label>
                  <Input
                    id="article-cover-file"
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    disabled={uploading || saving}
                  />
                  <Label htmlFor="article-cover" className="text-xs text-sage-500">
                    atau tempel URL sampul
                  </Label>
                  <Input
                    id="article-cover"
                    value={form.coverImage}
                    onChange={set('coverImage')}
                    placeholder="URL sampul (otomatis terisi setelah upload)"
                    maxLength={1000}
                  />
                  {uploading && (
                    <p className="flex items-center gap-1.5 text-sm text-sage-500">
                      <Loader2
                        aria-hidden
                        className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                      />
                      Mengunggah sampul…
                    </p>
                  )}
                  <AdminInlineError message={uploadError} />
                  <AdminInlineError message={coverOriginError} />
                  {form.coverImage.trim() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() => setForm((prev) => ({ ...prev, coverImage: '' }))}
                    >
                      Hapus sampul
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </FieldGroup>

          <FieldGroup title="Klasifikasi & peny-author">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="article-author">Penulis</Label>
                <Input id="article-author" value="ReBites" readOnly disabled />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="article-umkm">UMKM (opsional)</Label>
                <select
                  id="article-umkm"
                  value={form.umkmId}
                  onChange={set('umkmId')}
                  className="h-10 w-full rounded-[var(--radius)] border border-border bg-white px-3 text-sm text-charcoal-900 outline-none transition-colors hover:border-sage-500 focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                <Label htmlFor="article-tags">Tag (pisahkan koma)</Label>
                <Input
                  id="article-tags"
                  value={form.tags}
                  onChange={set('tags')}
                  placeholder="hemat, umkm, promo"
                />
                {tagList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {tagList.map((tag) => (
                      <span
                        key={tag}
                        className={cn(
                          'rounded-full bg-sage-100 px-2.5 py-0.5 text-[11px] font-semibold text-sage-600'
                        )}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </FieldGroup>

          <AdminInlineError message={formError} />
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
            {saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Buat Draf'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
