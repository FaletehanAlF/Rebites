'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gavel, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
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
  AdminDateRange,
  AdminPagination,
  AdminSearchInput,
  AdminSelect,
  AdminToolbar,
} from './admin-controls';
import {
  AdminTableCard,
  AdminTableHead,
  AdminTd,
  AdminTh,
  AdminTr,
} from './admin-table';
import { formatTanggalWaktu } from './admin-format';
import {
  SanctionsApiError,
  fetchSanctions,
  type SanctionItem,
  type SanctionType,
} from '@/lib/admin-sanctions';

const PAGE_LIMIT = 20;

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Semua jenis sanksi' },
  { value: 'suspend', label: 'Tangguhkan' },
  { value: 'ban', label: 'Blokir' },
  { value: 'delete', label: 'Hapus Akun' },
];

function typeBadgeVariant(type: string): 'warning' | 'destructive' | 'secondary' {
  switch (type.toLowerCase()) {
    case 'suspend':
      return 'warning';
    case 'ban':
    case 'delete':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function typeLabel(type: string): string {
  switch (type.toLowerCase()) {
    case 'suspend':
      return 'Tangguhkan';
    case 'ban':
      return 'Blokir';
    case 'delete':
      return 'Hapus Akun';
    default:
      return type || '-';
  }
}

/**
 * Status sanksi DITURUNKAN HANYA dari kolom yang benar-benar ada di kontrak
 * GET /api/admin/sanctions: `sanctionType`, `startAt`, `endAt`.
 *
 * Aturan (sesuai skema `public.sanctions`):
 *   - `end_at IS NULL`  -> tidak berakhir (permanen menurut data).
 *   - `end_at > now()`  -> masih berlaku.
 *   - `end_at <= now()` -> sudah berakhir.
 *
 * PENTING 1: status ini menggambarkan MASA BERLAKU baris sanksi, bukan
 * `profiles.account_status` saat ini — daftar sanksi tidak membawa status
 * akun, dan satu akun bisa punya beberapa baris sanksi.
 *
 * PENTING 2: `sanction_type = 'delete'` TIDAK menghapus akun (API hanya
 * mencatat baris sanksi; `account_status` tidak diubah). Karena itu tipe ini
 * TIDAK boleh ditampilkan sebagai "Permanen" — labelnya menyatakan bahwa
 * tindakan hanya tercatat.
 */
type SanctionStatus = 'permanent' | 'active' | 'expired' | 'recorded_only';

function sanctionStatus(item: SanctionItem): SanctionStatus {
  if (item.sanctionType.toLowerCase() === 'delete') return 'recorded_only';
  if (!item.endAt) return 'permanent';
  const end = new Date(item.endAt).getTime();
  if (!Number.isFinite(end)) return 'permanent';
  return end > Date.now() ? 'active' : 'expired';
}

const STATUS_META: Record<
  SanctionStatus,
  { label: string; variant: 'secondary' | 'success' | 'warning' | 'destructive'; hint: string }
> = {
  permanent: {
    label: 'Permanen',
    variant: 'destructive',
    hint: 'Baris sanksi tidak memiliki tanggal berakhir.',
  },
  active: {
    label: 'Masih berlaku',
    variant: 'warning',
    hint: 'Tanggal berakhir sanksi belum lewat.',
  },
  expired: {
    label: 'Berakhir',
    variant: 'secondary',
    hint: 'Tanggal berakhir sanksi sudah lewat.',
  },
  recorded_only: {
    label: 'Hanya tercatat',
    variant: 'secondary',
    hint: 'Tipe "Hapus Akun" saat ini hanya dicatat sebagai sanksi; akun tidak dihapus.',
  },
};

function StatusBadge({ item }: { item: SanctionItem }) {
  const meta = STATUS_META[sanctionStatus(item)];
  return (
    <Badge variant={meta.variant} title={meta.hint}>
      {meta.label}
    </Badge>
  );
}

export function SanctionsView() {
  const router = useRouter();
  const [items, setItems] = useState<SanctionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState<SanctionType | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [selected, setSelected] = useState<SanctionItem | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Filter jenis/tanggal memicu request baru; hanya respons terbaru yang boleh
  // menulis state agar tabel tidak berkedip ke hasil lama.
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (nextOffset: number): Promise<'ok' | 'error' | 'forbidden' | 'unauthorized' | 'stale'> => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setStatus('loading');
      setErrorMsg('');
      try {
        const result = await fetchSanctions(PAGE_LIMIT, nextOffset, typeFilter ?? undefined, {
          from: from || undefined,
          to: to || undefined,
        });
        if (requestId !== requestIdRef.current) return 'stale';
        setItems(result.sanctions);
        setTotal(result.total);
        setOffset(result.offset);
        setStatus('ready');
        return 'ok';
      } catch (err) {
        if (requestId !== requestIdRef.current) return 'stale';
        if (err instanceof SanctionsApiError && err.status === 401) {
          router.replace('/auth/login');
          return 'unauthorized';
        }
        if (err instanceof SanctionsApiError && err.status === 403) {
          setStatus('forbidden');
          return 'forbidden';
        }
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat sanksi.');
        setStatus('error');
        return 'error';
      }
    },
    [router, typeFilter, from, to]
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  // Pencarian nama/email hanya menyaring data pada halaman ini
  // (API sanksi tidak menyediakan pencarian global).
  const searching = userQuery.trim().length > 0;
  const visible = searching
    ? items.filter((item) => {
        const needle = userQuery.toLowerCase();
        return (
          item.userName.toLowerCase().includes(needle) ||
          (item.userEmail ?? '').toLowerCase().includes(needle)
        );
      })
    : items;

  const hasActiveFilter =
    typeFilter !== null || from !== '' || to !== '' || userQuery.trim() !== '';

  const resetFilters = () => {
    setTypeFilter(null);
    setFrom('');
    setTo('');
    setUserQuery('');
  };

  const handleReload = async () => {
    setNote(null);
    const outcome = await load(offset);
    if (outcome === 'ok') setNote('Daftar sanksi diperbarui.');
  };

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(timer);
  }, [note]);

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader
        eyebrow="Admin · Monitoring"
        title="Sanksi"
        description="Riwayat tindakan sanksi yang diberikan admin."
        backHref="/dashboard/admin"
        backLabel="Dashboard Admin"
        actions={
          <>
            <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
              {total} sanksi
            </Badge>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleReload()}
              disabled={status === 'loading'}
            >
              <RefreshCw aria-hidden className="h-4 w-4" />
              Muat ulang
            </Button>
          </>
        }
      />

      {/* Satu baris filter, pencarian di awal (pojok kiri), lalu jenis sanksi
          sebagai dropdown dan rentang tanggal. Jenis sanksi sebelumnya berupa
          empat chip yang menempati awal baris sehingga pencarian terdorong ke
          tengah dan baris cepat penuh. */}
      <AdminToolbar>
        <AdminSearchInput
          value={userQuery}
          onChange={setUserQuery}
          label="Cari pengguna"
          labelVisible
          placeholder="Nama atau email…"
          className="sm:max-w-xs"
        />
        <AdminSelect
          value={typeFilter ?? ''}
          onChange={(value) => {
            setTypeFilter((value || null) as SanctionType | null);
            setOffset(0);
          }}
          label="Jenis sanksi"
          options={TYPE_FILTERS}
        />
        {/* Filter tanggal memakai `created_at` (tanggal sanksi DIBUAT),
            bukan masa berlaku sanksi. Nilai parameter `from`/`to` tidak berubah. */}
        <AdminDateRange
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          fromLabel="Dibuat dari"
          toLabel="Dibuat sampai"
        />
      </AdminToolbar>
      {/* Aksi dipisah dari baris filter: saat ikut berbaris, tombol ini
          mendorong pasangan tanggal ke baris bawah ketika sidebar terbuka. */}
      {hasActiveFilter && (
        <div className="mb-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
            Atur ulang filter
          </Button>
        </div>
      )}
      <p className="mb-6 text-xs leading-relaxed text-sage-500">
        Filter tanggal mengacu pada <strong className="font-semibold">tanggal sanksi dibuat</strong>,
        bukan pada masa berlaku sanksi.
      </p>

      {note && (
        <p
          role="status"
          className="mb-6 flex items-center gap-1.5 text-xs font-semibold text-success"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0" />
          {note}
        </p>
      )}

      {status === 'loading' && <AdminLoadingState label="Memuat sanksi" />}

      {status === 'forbidden' && (
        <AdminForbiddenState message="Halaman ini hanya untuk admin." />
      )}

      {status === 'error' && (
        <AdminErrorState
          title="Gagal memuat sanksi"
          message={errorMsg}
          onRetry={() => load(offset)}
        />
      )}

      {status === 'ready' && visible.length === 0 && (
        <AdminEmptyState
          icon={<Gavel aria-hidden className="h-10 w-10 text-primary" />}
          title={searching ? 'Tidak ada hasil pencarian' : hasActiveFilter ? 'Tidak ada sanksi yang cocok' : 'Belum ada sanksi'}
          description={
            searching
              ? 'Tidak ada pengguna yang cocok di halaman ini. Coba kata kunci lain atau buka halaman lain.'
              : hasActiveFilter
                ? 'Tidak ada sanksi yang cocok dengan tipe atau tanggal yang dipilih.'
                : 'Sanksi yang diberikan admin akan muncul di sini.'
          }
          action={
            hasActiveFilter ? (
              <Button type="button" variant="outline" onClick={resetFilters}>
                <RefreshCw aria-hidden className="h-4 w-4" />
                Atur ulang filter
              </Button>
            ) : undefined
          }
        />
      )}

      {status === 'ready' && visible.length > 0 && (
        <>
          <AdminTableCard
            label="Daftar sanksi"
            minWidth={1040}
            className="hidden sm:block"
          >
            <AdminTableHead>
              <AdminTh>Pengguna</AdminTh>
              <AdminTh>Tindakan</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Alasan</AdminTh>
              <AdminTh>Mulai</AdminTh>
              <AdminTh>Akhir</AdminTh>
              <AdminTh>Ditetapkan oleh</AdminTh>
              <AdminTh>Peringatan</AdminTh>
              <AdminTh>Dibuat</AdminTh>
              <AdminTh className="text-right">Aksi</AdminTh>
            </AdminTableHead>
            <tbody>
              {visible.map((item) => (
                <AdminTr
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(item)}
                >
                  {/* Pemotongan teks diletakkan pada elemen blok di dalam sel.
                      `max-w-*` pada <td> tidak dijamin karena tabel memakai
                      auto layout (bukan `table-fixed`). */}
                  <AdminTd>
                    <div className="max-w-[180px]">
                      <p className="truncate font-medium text-charcoal-900" title={item.userName}>
                        {item.userName}
                      </p>
                      {item.userEmail && (
                        <p className="truncate text-xs text-sage-500" title={item.userEmail}>
                          {item.userEmail}
                        </p>
                      )}
                    </div>
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap">
                    <Badge variant={typeBadgeVariant(item.sanctionType)}>
                      {typeLabel(item.sanctionType)}
                    </Badge>
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap">
                    <StatusBadge item={item} />
                  </AdminTd>
                  <AdminTd>
                    <p
                      className="line-clamp-2 max-w-[260px] break-words"
                      title={item.reason || undefined}
                    >
                      {item.reason || '-'}
                    </p>
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap text-xs text-sage-500">
                    {formatTanggalWaktu(item.startAt)}
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap text-xs text-sage-500">
                    {item.endAt ? formatTanggalWaktu(item.endAt) : 'Tanpa batas'}
                  </AdminTd>
                  <AdminTd>
                    <div className="max-w-[160px] truncate font-medium text-charcoal-900" title={item.issuerName}>
                      {item.issuerName}
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <div
                      className="max-w-[120px] truncate font-mono text-xs text-sage-500"
                      title={item.warningId ?? undefined}
                    >
                      {item.warningId ? `${item.warningId.slice(0, 8)}…` : '-'}
                    </div>
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap text-xs text-sage-500">
                    {formatTanggalWaktu(item.createdAt)}
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(item);
                      }}
                    >
                      Detail
                    </Button>
                  </AdminTd>
                </AdminTr>
              ))}
            </tbody>
          </AdminTableCard>

          <div className="mt-6 space-y-3 sm:hidden">
            {visible.map((item) => (
              // div pembungkus + tombol overlay: HTML valid dan seluruh kartu
              // tetap dapat diklik/diaktifkan dengan keyboard.
              <div key={item.id} className="relative">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="min-w-0 flex-1 truncate font-semibold text-charcoal-900"
                        title={item.userName}
                      >
                        {item.userName}
                      </p>
                      <Badge variant={typeBadgeVariant(item.sanctionType)} className="shrink-0">
                        {typeLabel(item.sanctionType)}
                      </Badge>
                    </div>
                    <div className="mt-2">
                      <StatusBadge item={item} />
                    </div>
                    <p
                      className="mt-2 line-clamp-2 break-words text-sm text-charcoal-700"
                      title={item.reason || undefined}
                    >
                      {item.reason || '-'}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-sage-500">
                      <span className="min-w-0 flex-1 truncate" title={item.issuerName}>
                        {item.issuerName}
                      </span>
                      <span className="shrink-0">{formatTanggalWaktu(item.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  aria-label={`Lihat detail sanksi ${item.userName}`}
                  className="absolute inset-0 rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                />
              </div>
            ))}
          </div>
        </>
      )}

      {status === 'ready' && total > 0 && (
        <>
          {searching && (
            <p className="mt-5 text-xs text-sage-500">
              Menampilkan {visible.length} hasil pencarian pada halaman ini
            </p>
          )}

          <AdminPagination
            total={total}
            page={Math.floor(offset / PAGE_LIMIT) + 1}
            pageSize={PAGE_LIMIT}
            noun="sanksi"
            onPageChange={(next) => load((next - 1) * PAGE_LIMIT)}
          />
        </>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        {/* `.dialog-panel` (CSS global, unlayered) menetapkan max-width 32rem
            dan menang atas utility Tailwind berlayer. `sm:max-w-lg` = 32rem,
            jadi kelas ini sejalan dengan batas global — tidak bertabrakan. */}
        <DialogContent className="overflow-hidden sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle>Detail sanksi</DialogTitle>
            <DialogDescription>
              {selected ? `${selected.userName} · ${typeLabel(selected.sanctionType)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-sage-500">Tindakan:</span>
                <Badge variant={typeBadgeVariant(selected.sanctionType)}>
                  {typeLabel(selected.sanctionType)}
                </Badge>
              </p>
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-sage-500">Status:</span>
                <StatusBadge item={selected} />
              </p>
              <p className="text-xs leading-relaxed text-sage-500">
                {STATUS_META[sanctionStatus(selected)].hint}
              </p>
              <p className="break-words">
                <span className="text-sage-500">Alasan: </span>
                <span className="font-semibold text-charcoal-900">{selected.reason || '-'}</span>
              </p>
              <p>
                <span className="text-sage-500">Mulai: </span>
                {formatTanggalWaktu(selected.startAt)}
              </p>
              <p>
                <span className="text-sage-500">Akhir: </span>
                {selected.endAt ? formatTanggalWaktu(selected.endAt) : 'Tanpa batas'}
              </p>
              <p>
                <span className="text-sage-500">Oleh: </span>
                {selected.issuerName}
              </p>
              <p className="break-all">
                <span className="text-sage-500">Peringatan terkait: </span>
                {selected.warningId ?? '-'}
              </p>
              <p>
                <span className="text-sage-500">Dibuat: </span>
                {formatTanggalWaktu(selected.createdAt)}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
