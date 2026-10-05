'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  AdminArticlesApiError,
  createAdminArticle,
  deleteAdminArticle,
  fetchAdminArticles,
  fetchUmkmOptions,
  publishAdminArticle,
  updateAdminArticle,
  type AdminArticleItem,
  type ArticlePayload,
  type ArticleStatus,
  type UmkmOption,
} from '@/lib/admin-articles';
import { ArticleForm } from '@/app/components/admin/article-form';
import { refreshAdminSessionSafe } from '@/lib/admin-auth';

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;

const STATUS_FILTER_OPTIONS: { value: '' | ArticleStatus; label: string }[] = [
  { value: '', label: 'Semua status' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

function statusBadgeVariant(status: string | null): 'default' | 'secondary' | 'success' {
  if (status === 'published') return 'success';
  if (status === 'draft') return 'secondary';
  return 'default';
}

function statusLabel(status: string | null): string {
  if (status === 'published') return 'Published';
  if (status === 'draft') return 'Draft';
  if (status === 'archived') return 'Archived';
  return status ?? '-';
}

export function ArticlesManagementView() {
  const router = useRouter();
  const [items, setItems] = useState<AdminArticleItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | ArticleStatus>('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminArticleItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [umkms, setUmkms] = useState<UmkmOption[]>([]);

  const [confirmDelete, setConfirmDelete] = useState<AdminArticleItem | null>(null);
  const [confirmPublish, setConfirmPublish] = useState<AdminArticleItem | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(
    async (nextOffset: number, nextSearch: string, nextStatus: '' | ArticleStatus) => {
      setStatus('loading');
      setErrorMsg('');
      const applyResult = (result: Awaited<ReturnType<typeof fetchAdminArticles>>) => {
        setItems(result.articles);
        setTotal(result.total);
        setOffset(result.offset);
        setStatus('ready');
      };
      try {
        try {
          applyResult(await fetchAdminArticles(PAGE_LIMIT, nextOffset, nextSearch, nextStatus));
          return;
        } catch (err) {
          // 401 belum tentu sesi benar-benar habis: bisa access_token masuk
          // refresh window saat request dikirim. Refresh aman satu kali lalu
          // retry satu kali; TANPA signOut otomatis, TANPA loop.
          if (!(err instanceof AdminArticlesApiError && err.status === 401)) throw err;
          const refreshed = await refreshAdminSessionSafe();
          if (!refreshed) {
            router.replace('/auth/login');
            return;
          }
          try {
            applyResult(await fetchAdminArticles(PAGE_LIMIT, nextOffset, nextSearch, nextStatus));
            return;
          } catch (retryErr) {
            if (retryErr instanceof AdminArticlesApiError && retryErr.status === 401) {
              router.replace('/auth/login');
              return;
            }
            throw retryErr;
          }
        }
      } catch (err) {
        if (err instanceof AdminArticlesApiError && err.status === 401) {
          router.replace('/auth/login');
          return;
        }
        if (err instanceof AdminArticlesApiError && err.status === 403) {
          setStatus('forbidden');
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat daftar artikel.');
        setStatus('error');
      }
    },
    [router]
  );

  useEffect(() => {
    load(0, search, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch((prev) => (prev === searchInput.trim() ? prev : searchInput.trim()));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Dropdown UMKM dimuat sekali saat halaman dibuka.
  // Author selalu ReBites (ditentukan server dari admin login).
  // 401 di sini tidak redirect (dropdown boleh kosong), tapi tetap retry
  // satu kali setelah refresh aman agar tidak kosong hanya karena token
  // sedang dalam refresh window.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        try {
          const u = await fetchUmkmOptions();
          if (mounted) setUmkms(u);
          return;
        } catch (err) {
          if (!(err instanceof AdminArticlesApiError && err.status === 401)) throw err;
          const refreshed = await refreshAdminSessionSafe();
          if (!refreshed) return;
          const u = await fetchUmkmOptions();
          if (mounted) setUmkms(u);
        }
      } catch {
        // Dropdown boleh kosong; API tetap memvalidasi umkm_id.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (item: AdminArticleItem) => {
    setEditing(item);
    setFormError('');
    setFormOpen(true);
  };

  const handleSubmit = async (payload: ArticlePayload) => {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateAdminArticle(editing.id, payload);
        toast({ title: 'Artikel diperbarui.' });
      } else {
        await createAdminArticle(payload);
        toast({ title: 'Draft artikel dibuat.' });
      }
      setFormOpen(false);
      setEditing(null);
      await load(editing ? offset : 0, search, statusFilter);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan artikel.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!confirmPublish) return;
    const wantPublished = confirmPublish.status !== 'published';
    setActing(true);
    try {
      await publishAdminArticle(confirmPublish.id, wantPublished);
      toast({ title: wantPublished ? 'Artikel dipublish.' : 'Artikel dikembalikan ke draft.' });
      setConfirmPublish(null);
      await load(offset, search, statusFilter);
    } catch (err) {
      toast({
        title: 'Aksi gagal',
        description: err instanceof Error ? err.message : 'Gagal memproses publish.',
        variant: 'destructive',
      });
    } finally {
      setActing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActing(true);
    try {
      await deleteAdminArticle(confirmDelete.id);
      toast({ title: 'Artikel dihapus.' });
      setConfirmDelete(null);
      await load(offset, search, statusFilter);
    } catch (err) {
      toast({
        title: 'Hapus gagal',
        description: err instanceof Error ? err.message : 'Gagal menghapus artikel.',
        variant: 'destructive',
      });
    } finally {
      setActing(false);
    }
  };

  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_LIMIT, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_LIMIT < total;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/admin"
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-charcoal-500 transition-colors hover:bg-white hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard Admin
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-caramel">
            Admin · Artikel
          </p>
          <h1 className="mt-1 font-display text-[clamp(1.6rem,3.5vw,2.4rem)] font-semibold tracking-tight text-primary">
            Manajemen Artikel
          </h1>
          <p className="mt-1 text-sm text-sage-500">
            Kelola konten artikel ReBites: draft, publish, dan hapus.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-bold">
            {total} Artikel
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => load(offset, search, statusFilter)}
            disabled={status === 'loading'}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah Artikel
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/70 bg-white px-3 py-2 focus-within:border-primary">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearch(searchInput.trim());
            }}
            placeholder="Cari judul atau excerpt..."
            aria-label="Cari artikel"
            className="w-full bg-transparent py-1 text-sm text-charcoal-900 outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | ArticleStatus)}
          aria-label="Filter status artikel"
          className="appearance-none rounded-xl border border-border/70 bg-white px-3 py-2.5 text-sm font-medium text-charcoal-900 outline-none focus:border-primary"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {status === 'loading' && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {status === 'forbidden' && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <ShieldAlert className="h-10 w-10 text-caramel" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">Akses ditolak</h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">
              Halaman ini hanya untuk admin. Akun kamu tidak memiliki hak mengelola artikel.
            </p>
            <Link href="/" className="mt-5">
              <Button type="button" variant="outline" size="sm">
                Kembali ke Beranda
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {status === 'error' && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <ShieldAlert className="h-10 w-10 text-caramel" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">Gagal memuat artikel</h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">{errorMsg}</p>
            <Button
              type="button"
              size="sm"
              className="mt-5"
              onClick={() => load(offset, search, statusFilter)}
            >
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && items.length === 0 && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <Newspaper className="h-10 w-10 text-primary" />
            <h2 className="mt-4 font-display text-xl font-semibold text-primary">
              {search || statusFilter ? 'Artikel tidak ditemukan' : 'Belum ada artikel'}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-sage-500">
              {search || statusFilter
                ? 'Tidak ada artikel yang cocok dengan filter saat ini.'
                : 'Buat draft artikel pertama dengan tombol Tambah Artikel.'}
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <Card className="mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-cream-50 text-[11px] uppercase tracking-wider text-sage-500">
                    <th className="px-4 py-3 font-bold">Judul</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Kategori</th>
                    <th className="px-4 py-3 font-bold">Author</th>
                    <th className="px-4 py-3 font-bold">Published</th>
                    <th className="px-4 py-3 font-bold">Dibuat</th>
                    <th className="px-4 py-3 font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border/50 last:border-0 hover:bg-cream-50/60"
                    >
                      <td className="max-w-[220px] truncate px-4 py-3 font-semibold text-charcoal-900">
                        {item.title ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge variant={statusBadgeVariant(item.status)}>
                          {statusLabel(item.status)}
                        </Badge>
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-charcoal-900">
                        {item.category ?? '-'}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-charcoal-900">
                        {item.author?.full_name?.trim() || item.author?.email || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-sage-500">
                        {formatDate(item.published_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-sage-500">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(item)}>
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {item.status === 'published' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmPublish(item)}
                            >
                              Unpublish
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => setConfirmPublish(item)}
                            >
                              Publish
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmDelete(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs text-sage-500">
              Menampilkan {showingFrom}–{showingTo} dari {total} artikel
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => load(Math.max(0, offset - PAGE_LIMIT), search, statusFilter)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => load(offset + PAGE_LIMIT, search, statusFilter)}
              >
                Berikutnya
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <ArticleForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        umkms={umkms}
        saving={saving}
        formError={formError}
        onSubmit={handleSubmit}
      />

      <Dialog open={confirmPublish !== null} onOpenChange={(open) => !open && setConfirmPublish(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmPublish?.status === 'published' ? 'Unpublish artikel ini?' : 'Publish artikel ini?'}
            </DialogTitle>
            <DialogDescription>
              {confirmPublish?.status === 'published'
                ? `“${confirmPublish?.title}” akan kembali menjadi draft dan tidak tampil di website publik.`
                : `“${confirmPublish?.title}” akan tampil di website publik.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={acting} onClick={() => setConfirmPublish(null)}>
              Batal
            </Button>
            <Button type="button" disabled={acting} onClick={handlePublishToggle}>
              {acting ? 'Memproses…' : confirmPublish?.status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus artikel ini?</DialogTitle>
            <DialogDescription>
              Yakin ingin menghapus artikel “{confirmDelete?.title}”? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={acting} onClick={() => setConfirmDelete(null)}>
              Batal
            </Button>
            <Button type="button" variant="destructive" disabled={acting} onClick={handleDelete}>
              {acting ? 'Menghapus…' : 'Hapus Artikel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
