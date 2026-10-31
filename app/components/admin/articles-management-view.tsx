'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  Check,
  ExternalLink,
  Eye,
  FileText,
  ImageOff,
  Loader2,
  MoreHorizontal,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  AdminPageHeader,
  ADMIN_PAGE_WRAPPER,
} from './admin-page-header';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-state';
import {
  AdminPagination,
  AdminSearchInput,
  AdminToolbar,
} from './admin-controls';
import {
  AdminTableCard,
  AdminTableHead,
  AdminTd,
  AdminTdActions,
  AdminTh,
  AdminTr,
} from './admin-table';
import { formatTanggal, formatTanggalWaktu } from './admin-format';
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
  fetchAdminArticleDetail,
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
import { SmartImage } from '@/app/components/shared/SmartImage';

import { refreshAdminSessionSafe } from '@/lib/admin-auth';

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;
/** Lama pesan "daftar diperbarui" tampil sebelum hilang sendiri. */
const REFRESH_NOTE_MS = 4000;

/**
 * Ringkasan per status yang sekaligus menjadi filter halaman ini.
 * `hint` menjelaskan ARTINYA ke pembaca, bukan mengulang labelnya — admin
 * baru tidak perlu menebak apa bedanya Draf dan Diarsipkan.
 */
const STATUS_TILES: {
  value: '' | ArticleStatus;
  label: string;
  hint: string;
  icon: typeof Newspaper;
  tone: string;
}[] = [
  {
    value: '',
    label: 'Semua artikel',
    hint: 'Seluruh artikel di database',
    icon: Newspaper,
    tone: 'bg-primary/10 text-primary',
  },
  {
    value: 'published',
    label: 'Terbit',
    hint: 'Tampil di website publik',
    icon: Send,
    tone: 'bg-success/[0.15] text-success',
  },
  {
    value: 'draft',
    label: 'Draf',
    hint: 'Belum tampil di publik',
    icon: FileText,
    tone: 'bg-sage-100 text-sage-600',
  },
  {
    value: 'archived',
    label: 'Diarsipkan',
    hint: 'Disembunyikan dari publik',
    icon: Archive,
    tone: 'bg-charcoal-900/[0.06] text-charcoal-700',
  },
];

function statusBadgeVariant(
  status: string | null
): 'default' | 'secondary' | 'success' | 'outline' {
  if (status === 'published') return 'success';
  if (status === 'draft') return 'secondary';
  // Diarsipkan bukan status aktif: badge outline lebih tenang daripada
  // badge hijau solid yang justru terbaca sebagai "terbit".
  if (status === 'archived') return 'outline';
  return 'secondary';
}

function statusLabel(status: string | null): string {
  if (status === 'published') return 'Terbit';
  if (status === 'draft') return 'Draf';
  if (status === 'archived') return 'Diarsipkan';
  return status ?? '-';
}

function jumlahKata(content: string | null | undefined): number {
  return (content ?? '').trim().split(/\s+/).filter(Boolean).length;
}

function urlPublik(item: AdminArticleItem): string {
  return `/artikel/${item.slug ?? item.id}`;
}

/**
 * Thumbnail foto makanan artikel.
 *
 * - Memakai SmartImage (komponen bersama yang sudah dipakai halaman publik
 *   dan halaman UMKM admin) sehingga URL kosong maupun gambar gagal dimuat
 *   menampilkan placeholder rapi, bukan kotak rusak.
 * - Selalu tampil untuk admin, termasuk artikel berstatus draf/arsip;
 *   status publikasi tidak pernah menyembunyikan foto dari admin.
 * - Rasio tetap 4:3 (`aspect-[4/3]`) dengan object-cover supaya baris tabel
 *   rapi dan foto tidak terpotong aneh.
 */
function ArticleThumbnail({
  item,
  onPreview,
  className,
}: {
  item: AdminArticleItem;
  onPreview?: (item: AdminArticleItem) => void;
  className?: string;
}) {
  const adaGambar = Boolean(item.cover_image?.trim());
  const src = item.cover_image ?? '';
  const alt = item.title ? `Foto artikel ${item.title}` : 'Foto artikel';

  if (!adaGambar) {
    return (
      <div
        title="Artikel ini belum memiliki gambar"
        className={cn(
          'relative flex aspect-[4/3] w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[var(--radius)] border border-border bg-sage-100/60 text-sage-500',
          className
        )}
      >
        <ImageOff aria-hidden className="h-4 w-4" />
        <span className="text-[10px] font-semibold leading-none">Tanpa foto</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPreview?.(item)}
      title="Lihat detail artikel"
      aria-label={`Lihat detail artikel ${item.title ?? ''}`}
      className={cn(
        'relative aspect-[4/3] w-[4.5rem] shrink-0 overflow-hidden rounded-[var(--radius)] border border-border bg-sage-100 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1',
        className
      )}
    >
      <SmartImage src={src} alt={alt} sizes="72px" />
    </button>
  );
}

/**
 * Satu kartu ringkasan + filter. `aria-pressed` membuat status aktifnya
 * terbaca pembaca layar, bukan hanya lewat warna.
 */
function StatusTile({
  icon: Icon,
  value,
  label,
  hint,
  tone,
  active,
  onClick,
}: {
  icon: typeof Newspaper;
  value: number | null;
  label: string;
  hint: string;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Saring: ${label}${value === null ? '' : ` (${value} artikel)`}`}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors sm:p-4',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        active
          ? 'border-primary/45 bg-primary/[0.05]'
          : 'border-transparent bg-admin-panel shadow-admin-card hover:border-primary/25'
      )}
    >
      <span
        aria-hidden
        className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tone)}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="font-display text-xl font-bold leading-none tracking-tight text-charcoal-900 tabular-nums">
            {value === null ? '—' : value}
          </span>
          {active && <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-primary" />}
        </span>
        <span
          className={cn(
            'mt-1 block truncate text-xs font-semibold',
            active ? 'text-primary' : 'text-charcoal-700'
          )}
        >
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] leading-4 text-sage-500">
          {hint}
        </span>
      </span>
    </button>
  );
}

/**
 * Menu aksi baris. Sebelumnya keempat aksi ditulis sebagai tombol berderet
 * (4 tombol × 20 baris = 80 tombol) sehingga tabel terasa penuh dan sempit.
 * Sekarang aksi yang sering dipakai (Ubah) tetap terlihat, sisanya di menu.
 */
function ArticleRowMenu({
  item,
  onPreview,
  onPublishToggle,
  onDelete,
}: {
  item: AdminArticleItem;
  onPreview: (item: AdminArticleItem) => void;
  onPublishToggle: (item: AdminArticleItem) => void;
  onDelete: (item: AdminArticleItem) => void;
}) {
  /**
   * Radix mengembalikan fokus ke tombol pemicu tepat setelah menu ditutup.
   * Dialog yang dibuka pada tick yang sama bisa kehilangan fokus ke tombol
   * itu (fokus keluar dari dialog), jadi pembukaannya ditunda satu frame
   * supaya pemulihan fokus menu selesai lebih dulu.
   */
  const afterMenuCloses = (run: () => void) => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(run);
  };

  const sudahTerbit = item.status === 'published';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Aksi lain untuk artikel ${item.title ?? ''}`}
        >
          <MoreHorizontal aria-hidden className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => afterMenuCloses(() => onPreview(item))}>
          <Eye aria-hidden className="h-4 w-4" />
          Pratinjau isi
        </DropdownMenuItem>
        {sudahTerbit && (
          <DropdownMenuItem asChild>
            <a
              href={urlPublik(item)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <ExternalLink aria-hidden className="h-4 w-4" />
              Lihat di website
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => afterMenuCloses(() => onPublishToggle(item))}>
          <Send aria-hidden className="h-4 w-4" />
          {sudahTerbit ? 'Batalkan terbit' : 'Terbitkan'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => afterMenuCloses(() => onDelete(item))}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 aria-hidden className="h-4 w-4" />
          Hapus artikel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
  /**
   * True saat memuat ulang SETELAH tabel pernah tampil. Tabel dibiarkan
   * terlihat (diredupkan) alih-alih diganti spinner, supaya mengetik di
   * kotak cari atau pindah halaman tidak membuat seluruh daftar berkedip
   * hilang lalu muncul lagi.
   */
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const sudahPernahMemuat = useRef(false);

  // Jumlah artikel per status. Diambil terpisah dengan limit=1 supaya
  // hanya metadata `total` yang dibutuhkan — daftar artikel tidak
  // diunduh ulang.
  const [counts, setCounts] = useState<{
    all: number | null;
    published: number | null;
    draft: number | null;
    archived: number | null;
  }>({ all: null, published: null, draft: null, archived: null });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminArticleItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [umkms, setUmkms] = useState<UmkmOption[]>([]);

  const [confirmDelete, setConfirmDelete] = useState<AdminArticleItem | null>(null);
  const [confirmPublish, setConfirmPublish] = useState<AdminArticleItem | null>(null);
  const [acting, setActing] = useState(false);
  const [previewItem, setPreviewItem] = useState<AdminArticleItem | null>(null);
  /**
   * True saat isi satu artikel sedang diambil (klik "Ubah"/pratinjau).
   * Daftar tidak lagi membawa `content`, jadi isi diambil per artikel.
   */
  const [detailLoading, setDetailLoading] = useState(false);
  const detailLoadingRef = useRef(false);

  type LoadOutcome = 'ok' | 'error' | 'forbidden' | 'unauthorized';

  const load = useCallback(
    async (
      nextOffset: number,
      nextSearch: string,
      nextStatus: '' | ArticleStatus
    ): Promise<LoadOutcome> => {
      setErrorMsg('');
      // Data lama tetap tampil selama pemuatan berikutnya berjalan.
      if (sudahPernahMemuat.current) setRefreshing(true);
      else setStatus('loading');

      const applyResult = (result: Awaited<ReturnType<typeof fetchAdminArticles>>) => {
        setItems(result.articles);
        setTotal(result.total);
        setOffset(result.offset);
        sudahPernahMemuat.current = true;
        setStatus('ready');
      };

      // Kegagalan SETELAH tabel tampil tidak mengosongkan halaman: tabel
      // dipertahankan dan pesan tampil sebagai baris di atasnya.
      const gagal = (message: string): LoadOutcome => {
        setErrorMsg(message);
        if (sudahPernahMemuat.current) setStatus('ready');
        else setStatus('error');
        return 'error';
      };

      try {
        try {
          applyResult(await fetchAdminArticles(PAGE_LIMIT, nextOffset, nextSearch, nextStatus));
          return 'ok';
        } catch (err) {
          // 401 belum tentu sesi benar-benar habis: bisa access_token masuk
          // refresh window saat request dikirim. Refresh aman satu kali lalu
          // retry satu kali; TANPA signOut otomatis, TANPA loop.
          if (!(err instanceof AdminArticlesApiError && err.status === 401)) throw err;
          const refreshed = await refreshAdminSessionSafe();
          if (!refreshed) {
            router.replace('/auth/login');
            return 'unauthorized';
          }
          applyResult(
            await fetchAdminArticles(PAGE_LIMIT, nextOffset, nextSearch, nextStatus)
          );
          return 'ok';
        }
      } catch (err) {
        const errStatus = (err as { status?: number })?.status ?? 0;
        // 503: Supabase tidak terjangkau. Sesi masih ada, jadi jangan lempar
        // admin ke halaman login — cukup minta coba lagi.
        if (errStatus === 503) {
          return gagal('Tidak dapat menghubungi server data. Periksa koneksi lalu coba lagi.');
        }
        if (err instanceof AdminArticlesApiError && err.status === 403) {
          setStatus('forbidden');
          return 'forbidden';
        }
        if (err instanceof AdminArticlesApiError && err.status === 401) {
          // Sudah dicoba refresh di atas dan masih 401: sesi benar-benar habis.
          router.replace('/auth/login');
          return 'unauthorized';
        }
        return gagal(err instanceof Error ? err.message : 'Gagal memuat daftar artikel.');
      } finally {
        setRefreshing(false);
      }
    },
    [router]
  );

  // Jumlah per status: empat permintaan ringan (limit=1) yang berjalan
  // berdampingan dengan pemuatan daftar. Kegagalan tidak boleh
  // membatalkan halaman — petak statistik cukup menampilkan "—".
  const loadCounts = useCallback(async () => {
    try {
      const [all, published, draft, archived] = await Promise.all([
        fetchAdminArticles(1, 0),
        fetchAdminArticles(1, 0, '', 'published'),
        fetchAdminArticles(1, 0, '', 'draft'),
        fetchAdminArticles(1, 0, '', 'archived'),
      ]);
      setCounts({
        all: all.total,
        published: published.total,
        draft: draft.total,
        archived: archived.total,
      });
    } catch {
      setCounts({ all: null, published: null, draft: null, archived: null });
    }
  }, []);

  useEffect(() => {
    void load(0, search, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch((prev) => (prev === searchInput.trim() ? prev : searchInput.trim()));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Pesan "daftar diperbarui" hanya untuk umpan balik tombol Muat ulang;
  // hilang sendiri supaya tidak menumpuk dengan isi halaman.
  useEffect(() => {
    if (!refreshNote) return;
    const timer = setTimeout(() => setRefreshNote(null), REFRESH_NOTE_MS);
    return () => clearTimeout(timer);
  }, [refreshNote]);

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

  /**
   * Ambil isi satu artikel lalu jalankan `lanjut` dengan data lengkap.
   *
   * WAJIB sebelum membuka form ubah: daftar tidak lagi mengirim `content`,
   * dan PUT mengirim seluruh payload — membuka form tanpa isi lalu menekan
   * simpan akan MENGHAPUS badan artikel di server.
   */
  const withContent = async (
    item: AdminArticleItem,
    lanjut: (full: AdminArticleItem) => void
  ) => {
    // Baris yang sudah lengkap (mis. dari percobaan sebelumnya) dipakai apa adanya.
    if (typeof item.content === 'string') {
      lanjut(item);
      return;
    }
    if (detailLoadingRef.current) return;
    detailLoadingRef.current = true;
    setDetailLoading(true);
    try {
      const full = await fetchAdminArticleDetail(item.id);
      lanjut(full);
    } catch (err) {
      toast({
        title: 'Gagal membuka artikel',
        description:
          err instanceof Error
            ? err.message
            : 'Isi artikel tidak dapat dimuat. Coba lagi.',
        variant: 'destructive',
      });
    } finally {
      detailLoadingRef.current = false;
      setDetailLoading(false);
    }
  };

  const openEdit = (item: AdminArticleItem) => {
    void withContent(item, (full) => {
      setEditing(full);
      setFormError('');
      setFormOpen(true);
    });
  };

  const openPreview = (item: AdminArticleItem) => {
    void withContent(item, (full) => setPreviewItem(full));
  };

  const hasFilter = search !== '' || statusFilter !== '';

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
  };

  const handleReload = async () => {
    setRefreshNote(null);
    const outcome = await load(offset, search, statusFilter);
    if (outcome === 'ok') setRefreshNote('Daftar artikel diperbarui.');
    await loadCounts();
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
        toast({ title: 'Draf artikel dibuat.' });
      }
      setFormOpen(false);
      setEditing(null);
      await load(editing ? offset : 0, search, statusFilter);
      await loadCounts();
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
      toast({ title: wantPublished ? 'Artikel diterbitkan.' : 'Artikel dikembalikan ke draf.' });
      setConfirmPublish(null);
      await load(offset, search, statusFilter);
      await loadCounts();
    } catch (err) {
      toast({
        title: 'Aksi gagal',
        description: err instanceof Error ? err.message : 'Gagal memproses penerbitan.',
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
      // Hapus baris terakhir di halaman terakhir: mundur satu halaman,
      // supaya admin tidak melihat halaman kosong padahal datanya masih ada.
      const halamanKosong = items.length === 1 && offset > 0;
      await load(
        halamanKosong ? Math.max(0, offset - PAGE_LIMIT) : offset,
        search,
        statusFilter
      );
      await loadCounts();
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

  const page = Math.floor(offset / PAGE_LIMIT) + 1;

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader
        eyebrow="Admin · Artikel"
        title="Manajemen Artikel"
        description="Kelola artikel ReBites. Draf hanya terlihat oleh admin."
        actions={
          <>
            <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
              {total} artikel
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleReload()}
              disabled={status === 'loading' || refreshing}
            >
              <RefreshCw aria-hidden className="h-3.5 w-3.5" />
              Muat ulang
            </Button>
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus aria-hidden className="h-4 w-4" />
              Tambah Artikel
            </Button>
          </>
        }
      />

      {/* ====== Ringkasan + filter status (satu-satunya kontrol status).
           Sebelumnya status bisa disaring dari DUA tempat sekaligus —
           empat petak ini dan baris chip di toolbar — sehingga tampak
           seperti dua filter berbeda untuk hal yang sama. ====== */}
      <section aria-labelledby="judul-status-artikel" className="mb-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2
            id="judul-status-artikel"
            className="text-xs font-semibold uppercase tracking-[0.06em] text-sage-500"
          >
            Status artikel
          </h2>
          <p className="text-xs text-sage-500">Klik salah satu untuk menyaring daftar.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATUS_TILES.map((tile) => (
            <StatusTile
              key={tile.value || 'all'}
              icon={tile.icon}
              value={counts[tile.value === '' ? 'all' : tile.value]}
              label={tile.label}
              hint={tile.hint}
              tone={tile.tone}
              active={statusFilter === tile.value}
              onClick={() => setStatusFilter(tile.value)}
            />
          ))}
        </div>
      </section>

      <AdminToolbar>
        <AdminSearchInput
          value={searchInput}
          onChange={setSearchInput}
          label="Cari artikel"
          labelVisible
          placeholder="Cari judul atau ringkasan artikel…"
        />
        {hasFilter && (
          // Ukuran default (h-10) supaya sejajar dengan tinggi kotak cari.
          <Button type="button" variant="outline" onClick={resetFilters}>
            <RotateCcw aria-hidden className="h-4 w-4" />
            Atur ulang filter
          </Button>
        )}
      </AdminToolbar>

      {refreshNote && (
        <p
          role="status"
          className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-success"
        >
          <Check aria-hidden className="h-4 w-4 shrink-0" />
          {refreshNote}
        </p>
      )}

      {detailLoading && (
        <p
          role="status"
          className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-sage-500"
        >
          <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          Memuat isi artikel…
        </p>
      )}

      {status === 'loading' && <AdminLoadingState label="Memuat daftar artikel" />}

      {status === 'forbidden' && (
        <AdminForbiddenState message="Halaman ini hanya untuk admin. Akun kamu tidak memiliki hak mengelola artikel." />
      )}

      {status === 'error' && (
        <AdminErrorState
          title="Gagal memuat artikel"
          message={errorMsg}
          onRetry={() => void load(offset, search, statusFilter)}
        />
      )}

      {status === 'ready' && items.length === 0 && (
        <AdminEmptyState
          icon={<Newspaper aria-hidden className="h-10 w-10 text-primary" />}
          title={hasFilter ? 'Artikel tidak ditemukan' : 'Belum ada artikel'}
          description={
            hasFilter
              ? 'Tidak ada artikel yang cocok dengan pencarian atau status yang dipilih. Coba atur ulang filter.'
              : 'Buat draf artikel pertama dengan tombol Tambah Artikel. Artikel baru selalu tersimpan sebagai draf.'
          }
          action={
            hasFilter ? (
              <Button type="button" size="sm" variant="outline" onClick={resetFilters}>
                <RotateCcw aria-hidden className="h-4 w-4" />
                Atur ulang filter
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus aria-hidden className="h-4 w-4" />
                Tambah Artikel
              </Button>
            )
          }
        />
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          {/* Kegagalan saat memuat ulang / ganti halaman tidak mengosongkan
              tabel; pesannya tampil di sini. */}
          {errorMsg && (
            <div
              role="alert"
              className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-sm text-charcoal-900"
            >
              <span className="min-w-0">{errorMsg}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void load(offset, search, statusFilter)}
              >
                Coba lagi
              </Button>
            </div>
          )}

          {/* Menjelaskan kenapa daftar lebih pendek dari jumlah total. */}
          {hasFilter && (
            <p className="mb-3 text-xs text-sage-500">
              Menampilkan{' '}
              <span className="font-semibold text-charcoal-900 tabular-nums">{total}</span>{' '}
              artikel
              {statusFilter ? ` berstatus ${statusLabel(statusFilter)}` : ''}
              {search ? ` untuk pencarian “${search}”` : ''}.
            </p>
          )}

          {refreshing && (
            <p
              role="status"
              className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-sage-500"
            >
              <Loader2
                aria-hidden
                className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
              />
              Memperbarui daftar…
            </p>
          )}

          <div
            aria-busy={refreshing}
            className={cn('transition-opacity', refreshing && 'pointer-events-none opacity-60')}
          >
            <AdminTableCard label="Daftar artikel" minWidth={760} className="hidden md:block">
              <AdminTableHead>
                <AdminTh>Artikel</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Kategori</AdminTh>
                <AdminTh>Terakhir diubah</AdminTh>
                <AdminTh className="text-right">Aksi</AdminTh>
              </AdminTableHead>
              <tbody>
                {items.map((item) => (
                  <AdminTr key={item.id}>
                    <AdminTd className="max-w-[420px]">
                      <div className="flex items-start gap-3">
                        <ArticleThumbnail item={item} onPreview={openPreview} />
                        <div className="min-w-0">
                          <p
                            className="line-clamp-2 font-semibold leading-snug text-charcoal-900"
                            title={item.title ?? undefined}
                          >
                            {item.title ?? '-'}
                          </p>
                          <p
                            className="mt-0.5 truncate font-mono text-[11px] text-sage-500"
                            title={urlPublik(item)}
                          >
                            {urlPublik(item)}
                          </p>
                          {item.excerpt && (
                            <p
                              className="mt-1 line-clamp-1 text-xs text-sage-500"
                              title={item.excerpt}
                            >
                              {item.excerpt}
                            </p>
                          )}
                        </div>
                      </div>
                    </AdminTd>
                    <AdminTd className="whitespace-nowrap">
                      <Badge variant={statusBadgeVariant(item.status)}>
                        {statusLabel(item.status)}
                      </Badge>
                      <span className="mt-1 block text-xs text-sage-500">
                        {item.published_at
                          ? `Terbit ${formatTanggal(item.published_at)}`
                          : 'Belum terbit'}
                      </span>
                    </AdminTd>
                    <AdminTd className="max-w-[150px]">
                      {item.category?.trim() ? (
                        <span
                          className="inline-block max-w-full truncate rounded-full bg-sage-100 px-2.5 py-0.5 text-[11px] font-semibold text-sage-600"
                          title={item.category.trim()}
                        >
                          {item.category.trim()}
                        </span>
                      ) : (
                        <span className="text-xs text-sage-500">Tanpa kategori</span>
                      )}
                    </AdminTd>
                    <AdminTd className="whitespace-nowrap text-xs text-sage-500">
                      {formatTanggal(item.updated_at ?? item.created_at)}
                      <span className="mt-1 block text-[11px]">
                        Dibuat {formatTanggal(item.created_at)}
                      </span>
                    </AdminTd>
                    <AdminTdActions>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil aria-hidden className="h-3.5 w-3.5" />
                        Ubah
                      </Button>
                      <ArticleRowMenu
                        item={item}
                        onPreview={openPreview}
                        onPublishToggle={setConfirmPublish}
                        onDelete={setConfirmDelete}
                      />
                    </AdminTdActions>
                  </AdminTr>
                ))}
              </tbody>
            </AdminTableCard>

            {/* Kartu untuk layar kecil: satu kartu per artikel, tidak
                menumpuk di dalam satu kartu panjang. */}
            <div className="space-y-3 md:hidden">
              {items.map((item) => (
                <Card key={`artikel-card-${item.id}`}>
                  <CardContent className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <ArticleThumbnail
                        item={item}
                        onPreview={openPreview}
                        className="w-20"
                      />
                      <div className="min-w-0 flex-1">
                        <Badge variant={statusBadgeVariant(item.status)}>
                          {statusLabel(item.status)}
                        </Badge>
                        <p
                          className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-charcoal-900"
                          title={item.title ?? undefined}
                        >
                          {item.title ?? '-'}
                        </p>
                        <p className="mt-1 truncate text-xs text-sage-500">
                          {item.category?.trim() || 'Tanpa kategori'}
                          {' · '}
                          {item.published_at
                            ? `Terbit ${formatTanggal(item.published_at)}`
                            : `Diubah ${formatTanggal(item.updated_at ?? item.created_at)}`}
                        </p>
                      </div>
                    </div>
                    {item.excerpt && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-sage-500">
                        {item.excerpt}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil aria-hidden className="h-3.5 w-3.5" />
                        Ubah artikel
                      </Button>
                      <ArticleRowMenu
                        item={item}
                        onPreview={openPreview}
                        onPublishToggle={setConfirmPublish}
                        onDelete={setConfirmDelete}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <AdminPagination
            total={total}
            page={page}
            pageSize={PAGE_LIMIT}
            noun="artikel"
            busy={refreshing}
            onPageChange={(next) => void load((next - 1) * PAGE_LIMIT, search, statusFilter)}
          />
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
              {confirmPublish?.status === 'published'
                ? 'Batalkan terbit artikel ini?'
                : 'Terbitkan artikel ini?'}
            </DialogTitle>
            <DialogDescription>
              {confirmPublish?.status === 'published'
                ? `“${confirmPublish?.title}” akan kembali menjadi draf dan tidak tampil di website publik.`
                : `“${confirmPublish?.title}” akan langsung tampil di halaman /artikel dan bisa dibaca siapa saja.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={acting} onClick={() => setConfirmPublish(null)}>
              Batal
            </Button>
            <Button type="button" disabled={acting} onClick={() => void handlePublishToggle()}>
              {acting ? 'Memproses…' : confirmPublish?.status === 'published' ? 'Batalkan Terbit' : 'Terbitkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus artikel ini?</DialogTitle>
            <DialogDescription>
              Yakin ingin menghapus artikel “{confirmDelete?.title}”? Tindakan ini tidak dapat
              dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={acting} onClick={() => setConfirmDelete(null)}>
              Batal
            </Button>
            <Button type="button" variant="destructive" disabled={acting} onClick={() => void handleDelete()}>
              {acting ? 'Menghapus…' : 'Hapus Artikel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pratinjau artikel: foto, metadata, dan isi artikel lengkap.
          Hanya-baca — tidak mengubah data artikel. */}
      <Dialog open={previewItem !== null} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-8">{previewItem?.title ?? 'Pratinjau artikel'}</DialogTitle>
            <DialogDescription>
              Pratinjau isi — perubahan hanya tersimpan lewat form Ubah.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={statusBadgeVariant(previewItem?.status ?? null)}>
              {statusLabel(previewItem?.status ?? null)}
            </Badge>
            {previewItem?.category?.trim() && (
              <span className="rounded-full bg-sage-100 px-2.5 py-0.5 text-[11px] font-semibold text-sage-600">
                {previewItem.category.trim()}
              </span>
            )}
            {previewItem?.published_at && (
              <span className="text-xs text-sage-500">
                Terbit {formatTanggal(previewItem.published_at)}
              </span>
            )}
          </div>

          <div className="relative mt-3 aspect-[16/9] w-full overflow-hidden rounded-[var(--radius)] border border-border bg-sage-100/60">
            <SmartImage
              src={previewItem?.cover_image ?? ''}
              alt={previewItem?.title ? `Foto artikel ${previewItem.title}` : 'Foto artikel'}
              sizes="(max-width: 640px) 100vw, 672px"
            />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
            {[
              { label: 'Alamat', value: previewItem ? urlPublik(previewItem) : '-' },
              { label: 'Kategori', value: previewItem?.category?.trim() || 'Tanpa kategori' },
              { label: 'Jumlah kata', value: `${jumlahKata(previewItem?.content)} kata` },
              { label: 'Dibuat', value: formatTanggalWaktu(previewItem?.created_at) },
              { label: 'Diubah', value: formatTanggalWaktu(previewItem?.updated_at) },
            ].map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-sage-500">
                  {row.label}
                </dt>
                <dd className="mt-0.5 truncate text-sm text-charcoal-900" title={row.value}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          {previewItem?.excerpt && (
            <p className="mt-4 rounded-[var(--radius)] bg-sage-100/50 px-4 py-3 text-sm leading-relaxed text-charcoal-700">
              {previewItem.excerpt}
            </p>
          )}

          <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-charcoal-700">
            {previewItem?.content ?? 'Konten artikel belum tersedia.'}
          </div>

          {previewItem?.tags && previewItem.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {previewItem.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          <DialogFooter className="mt-5 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const target = previewItem;
                setPreviewItem(null);
                if (target) openEdit(target);
              }}
            >
              <Pencil aria-hidden className="h-4 w-4" />
              Ubah artikel
            </Button>
            <Button type="button" onClick={() => setPreviewItem(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
