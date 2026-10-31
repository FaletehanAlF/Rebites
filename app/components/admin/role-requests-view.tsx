'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ClipboardCheck, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { Textarea } from '@/app/components/ui/textarea';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER, ADMIN_BACK_LABEL } from './admin-page-header';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from './admin-state';
import { AdminPagination, AdminSelect, AdminToolbar } from './admin-controls';
import {
  AdminTableCard,
  AdminTableHead,
  AdminTd,
  AdminTh,
  AdminTr,
} from './admin-table';
import {
  formatTanggalWaktu,
  labelPeran,
  labelStatusPermintaan,
  varianPeran,
  varianStatusPermintaan,
} from './admin-format';
import { useAdminMe } from '@/hooks/use-admin-me';
import { markRoleDecisionsSeen } from '@/lib/admin-preferences';
import {
  RoleRequestsApiError,
  decideRoleRequest,
  fetchAdminRoleRequests,
  type AdminRoleRequestItem,
  type RoleRequestStatus,
} from '@/lib/role-requests';

import { redirectIfSessionExpired } from './admin-session';

const PAGE_LIMIT = 20;
const NOTE_MAX = 500;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua status' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
];

const SCOPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Semua permintaan' },
  { value: 'mine', label: 'Permintaan saya' },
];

type DecisionDraft = {
  id: string;
  action: 'approve' | 'reject';
  targetName: string;
  currentLabel: string;
  requestedLabel: string;
};

function namaPengguna(
  nama: string | null | undefined,
  email: string | null | undefined
): string {
  return (nama ?? '').trim() || email || '-';
}

/**
 * Halaman "Permintaan Role" (/dashboard/admin/permintaan-role).
 *
 * - Semua admin dapat melihat daftar + filter status (Menunggu/Disetujui/
 *   Ditolak) dan scope (semua / permintaan sendiri) sehingga pemohon dapat
 *   memantau status permintaannya.
 * - Tombol Setujui/Tolak hanya dirender untuk Super Admin dan hanya untuk
 *   status 'pending'; server tetap penentu akhir (403/409 bila dipaksa).
 * - Keputusan bersifat exactly-once (RPC mengklaim status='pending'); hasil
 *   keputusan + role + audit tercatat atomik di server.
 */
export function RoleRequestsView() {
  const router = useRouter();
  const {
    loading: accessLoading,
    me,
    status: accessStatus,
    errorMessage: accessError,
    retry: retryAccess,
  } = useAdminMe();
  const [items, setItems] = useState<AdminRoleRequestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>(
    'loading'
  );
  const [errorMsg, setErrorMsg] = useState('');
  // Default 'Semua status' — sebelumnya 'pending', sehingga permintaan yang
  // sudah disetujui/ditolak tidak pernah terlihat tanpa mengubah filter.
  // Super Admin perlu melihat riwayat keputusan, bukan hanya antrean.
  const [statusFilter, setStatusFilter] = useState<'' | RoleRequestStatus>('');
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [draft, setDraft] = useState<DecisionDraft | null>(null);
  const [note, setNote] = useState('');
  const [deciding, setDeciding] = useState(false);
  // Fitur belum aktif di server (tabel role_change_requests belum dibuat).
  // Ditampilkan sebagai empty state yang menjelaskan, bukan error merah.
  const [notProvisioned, setNotProvisioned] = useState(false);
  // Filter status/scope memicu request baru; hanya respons terbaru yang boleh
  // menulis state agar tabel tidak berkedip ke hasil lama.
  const requestIdRef = useRef(0);
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  const load = useCallback(
    async (
      nextOffset: number,
      nextStatus: '' | RoleRequestStatus,
      nextScope: 'all' | 'mine'
    ) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setStatus('loading');
      setErrorMsg('');
      try {
        const result = await fetchAdminRoleRequests({
          status: nextStatus,
          mine: nextScope === 'mine',
          limit: PAGE_LIMIT,
          offset: nextOffset,
        });
        if (requestId !== requestIdRef.current) return;
        setItems(result.requests);
        setTotal(result.total);
        setOffset(result.offset);
        setNotProvisioned(result.notProvisioned);
        setStatus('ready');
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        if (await redirectIfSessionExpired((err as { status?: number })?.status ?? 0, router, () => {
            setErrorMsg('Tidak dapat menghubungi server data. Coba lagi.');
            setStatus('error');
          })) return;
        // Refresh berhasil: request ini tetap gagal, jadi tampilkan error +
        // tombol coba lagi — jangan biarkan status 'loading' menggantung.
        if (requestId !== requestIdRef.current) return;
        if (err instanceof RoleRequestsApiError && err.status === 403) {
          setStatus('forbidden');
          return;
        }
        setErrorMsg(
          err instanceof Error ? err.message : 'Gagal memuat permintaan role.'
        );
        setStatus('error');
      }
    },
    [router]
  );

  useEffect(() => {
    setDraft(null);
    setFeedback(null);
    load(0, statusFilter, scope);
  }, [statusFilter, scope, load]);

  // Auto-update: permintaan baru dari admin tim (atau keputusan Super Admin
  // lain) harus muncul tanpa refresh manual. `role_change_requests` TIDAK
  // terdaftar di publication `supabase_realtime`, jadi subscription tidak
  // akan menerima apa pun — polling yang jujur lebih baik daripada badge
  // yang diam. Hanya berjalan saat tab terlihat.
  //
  // `offset` dibawa apa adanya: menyegarkan halaman yang sedang dibuka,
  // bukan memaksa kembali ke halaman pertama saat admin sedang menelusuri.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (deciding) return; // jangan timpa dialog keputusan yang sedang terbuka
      void load(offset, statusFilter, scope);
    };
    const intervalId = window.setInterval(refresh, 20_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, offset, statusFilter, scope, deciding]);

  const viewerIsSuperAdmin = me?.isSuperAdmin === true;
  const page = Math.floor(offset / PAGE_LIMIT) + 1;

  /**
   * Tandai keputusan atas permintaan SENDIRI sebagai sudah dilihat.
   *
   * Badge di sidebar untuk admin pengaju menghitung permintaan yang sudah
   * diputuskan tetapi belum dibuka hasilnya. Begitu halaman ini menampilkan
   * keputusan itu, badge harus hilang — tanpa ini badge akan menetap selamanya
   * dan admin tidak tahu kapan tanda itu sudah tidak berlaku.
   *
   * Hanya untuk admin non-Super Admin: Super Admin memakai arti badge yang
   * lain (jumlah yang menunggu), yang tidak dipengaruhi apa pun di sini.
   */
  useEffect(() => {
    if (viewerIsSuperAdmin || items.length === 0) return;
    const ids = items
      .filter(
        (item) =>
          item.requested_by_me === true &&
          typeof item.id === 'string' &&
          (item.status === 'approved' || item.status === 'rejected')
      )
      .map((item) => item.id as string);
    markRoleDecisionsSeen(ids);
  }, [items, viewerIsSuperAdmin]);

  const bisaDiputuskan = (item: AdminRoleRequestItem): boolean =>
    viewerIsSuperAdmin &&
    item.status === 'pending' &&
    !item.requested_by_me &&
    !item.target_is_super_admin &&
    !!item.id;

  const mulaiKeputusan = (item: AdminRoleRequestItem, action: 'approve' | 'reject') => {
    if (!item.id) return;
    setFeedback(null);
    setNote('');
    setDraft({
      id: item.id,
      action,
      targetName: namaPengguna(item.target?.full_name, item.target?.email),
      currentLabel: labelPeran(item.current_role_live ?? item.current_role),
      requestedLabel: labelPeran(item.requested_role),
    });
  };

  const kirimKeputusan = async () => {
    if (!draft || deciding) return;
    setDeciding(true);
    setFeedback(null);
    try {
      await decideRoleRequest(draft.id, draft.action, note.trim());
      setFeedback({
        kind: 'success',
        text:
          draft.action === 'approve'
            ? `Permintaan pengguna "${draft.targetName}" disetujui. Peran diubah menjadi ${draft.requestedLabel} dan dicatat di riwayat.`
            : `Permintaan pengguna "${draft.targetName}" ditolak. Peran tidak berubah; keputusan dicatat di riwayat.`,
      });
      setDraft(null);
      setNote('');
      await load(offset, statusFilter, scope);
    } catch (err) {
      if (await redirectIfSessionExpired((err as { status?: number })?.status ?? 0, router, () => {
          // Gangguan saat MENGIRIM keputusan bukan kegagalan memuat daftar:
          // jangan ganti seluruh halaman dengan state error — tampilkan
          // feedback di dialog dan biarkan tabel tetap seperti semula.
          setFeedback({
            kind: 'error',
            text: 'Tidak dapat menghubungi server data. Coba lagi.',
          });
        })) return;
      if (err instanceof RoleRequestsApiError && err.status === 409) {
        setDraft(null);
        setNote('');
      }
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Gagal memproses keputusan.',
      });
      if (err instanceof RoleRequestsApiError && err.status === 409) {
        await load(offset, statusFilter, scope);
      }
    } finally {
      setDeciding(false);
    }
  };

  const keputusanTampil = (item: AdminRoleRequestItem) => {
    if (item.status === 'pending') return '—';
    const oleh = namaPengguna(item.decided_by?.full_name, item.decided_by?.email);
    const waktu = item.decided_at ? formatTanggalWaktu(item.decided_at) : '-';
    return (
      <div className="grid gap-0.5">
        <span className="text-xs font-medium text-charcoal-700">
          {oleh} · {waktu}
        </span>
        {item.decision_note && (
          <span className="text-xs italic text-sage-500" title={item.decision_note}>
            “{item.decision_note}”
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader
        eyebrow="Admin · Permintaan Role"
        title="Permintaan Role"
        description="Persetujuan perubahan peran pengguna. Admin tim mengajukan; hanya Super Admin yang memutuskan."
        backHref="/dashboard/admin"
        backLabel={ADMIN_BACK_LABEL}
        actions={
          <>
            <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
              {total} permintaan
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => load(offset, statusFilter, scope)}
              disabled={status === 'loading'}
            >
              <RefreshCw aria-hidden className="h-3.5 w-3.5" />
              Muat ulang
            </Button>
          </>
        }
      />

      <AdminToolbar>
        <AdminSelect
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as '' | RoleRequestStatus)}
          label="Status permintaan"
          options={STATUS_OPTIONS}
        />
        <AdminSelect
          value={scope}
          onChange={(value) => setScope(value === 'mine' ? 'mine' : 'all')}
          label="Cakupan"
          options={SCOPE_OPTIONS}
        />
      </AdminToolbar>

      {feedback && (
        <p
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          className={
            feedback.kind === 'error'
              ? 'mb-4 rounded-[var(--radius)] border border-destructive/25 bg-destructive/5 px-4 py-3 text-[13px] font-medium text-destructive'
              : 'mb-4 flex items-center gap-1.5 rounded-[var(--radius)] border border-success/25 bg-success/5 px-4 py-3 text-[13px] font-medium text-success'
          }
        >
          {feedback.kind === 'success' && (
            <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0" />
          )}
          {feedback.text}
        </p>
      )}

      {draft && (
        <Card className="mb-4 border-primary/30">
          <CardContent className="grid gap-3 px-4 py-4">
            <p className="text-sm font-medium text-charcoal-900">
              {draft.action === 'approve' ? 'Setujui' : 'Tolak'} permintaan perubahan
              peran untuk{' '}
              <span className="font-semibold">{draft.targetName}</span> (
              {draft.currentLabel} → {draft.requestedLabel})?
              {draft.action === 'reject' && (
                <span className="font-normal text-sage-500">
                  {' '}
                  Peran pengguna tidak akan berubah.
                </span>
              )}
            </p>
            <div>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
                placeholder="Catatan keputusan (opsional)…"
                aria-label="Catatan keputusan"
                maxLength={NOTE_MAX}
                disabled={deciding}
                className="min-h-[70px] rounded-[var(--radius)] border-border bg-white text-sm"
              />
              <p className="mt-1 text-xs text-sage-500">
                {note.length}/{NOTE_MAX} karakter
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={draft.action === 'approve' ? 'default' : 'destructive'}
                disabled={deciding}
                onClick={() => void kirimKeputusan()}
              >
                {draft.action === 'approve' ? (
                  <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
                ) : (
                  <XCircle aria-hidden className="h-3.5 w-3.5" />
                )}
                {deciding
                  ? 'Memproses…'
                  : draft.action === 'approve'
                    ? 'Ya, setujui'
                    : 'Ya, tolak'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deciding}
                onClick={() => {
                  setDraft(null);
                  setNote('');
                }}
              >
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pemeriksaan status Super Admin GAGAL (jaringan/5xx/timeout). Ditempatkan
          SEBELUM tabel agar admin melihat alasannya tanpa harus menggulir, dan
          dapat mengulang pemeriksaan di tempat. Selama `accessStatus` bukan
          'verified', tidak ada tombol keputusan yang dirender. */}
      {accessStatus === 'error' && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-[13px] font-medium text-charcoal-700"
        >
          <span className="min-w-0 flex-1">
            {accessError} Tombol Setujui/Tolak disembunyikan sampai status admin
            terverifikasi.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={retryAccess}>
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
            Coba lagi
          </Button>
        </div>
      )}

      {status === 'loading' && <AdminLoadingState label="Memuat permintaan role" />}

      {status === 'forbidden' && (
        <AdminForbiddenState message="Akun kamu tidak memiliki hak melihat permintaan role." />
      )}

      {status === 'error' && (
        <AdminErrorState
          title="Gagal memuat permintaan role"
          message={errorMsg}
          onRetry={() => load(offset, statusFilter, scope)}
        />
      )}

      {status === 'ready' && items.length === 0 && (
        <AdminEmptyState
          icon={<ClipboardCheck aria-hidden className="h-10 w-10 text-primary" />}
          title={
            notProvisioned
              ? 'Belum ada permintaan role'
              : statusFilter === 'pending'
                ? 'Tidak ada permintaan menunggu'
                : 'Belum ada permintaan role'
          }
          description={
            notProvisioned
              ? 'Fitur permintaan role belum diaktifkan di server ini. Super Admin masih dapat mengubah peran langsung dari halaman Pengguna.'
              : scope === 'mine'
                ? 'Permintaan yang kamu ajukan akan muncul di sini beserta statusnya.'
                : 'Permintaan perubahan role dari admin tim akan muncul di sini.'
          }
        />
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <AdminTableCard label="Daftar permintaan role" minWidth={1020} className="hidden md:block">
            <AdminTableHead>
              <AdminTh>Pemohon</AdminTh>
              <AdminTh>Pengguna</AdminTh>
              <AdminTh>Perubahan peran</AdminTh>
              <AdminTh>Alasan</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Diajukan</AdminTh>
              <AdminTh>Keputusan</AdminTh>
              {viewerIsSuperAdmin && <AdminTh>Aksi</AdminTh>}
            </AdminTableHead>
            <tbody>
              {items.map((item, index) => {
                const targetNama = namaPengguna(
                  item.target?.full_name,
                  item.target?.email
                );
                return (
                  <AdminTr key={item.id ?? `role-request-row-${index}`}>
                    <AdminTd className="max-w-[180px]">
                      <span className="block truncate font-medium text-charcoal-900">
                        {namaPengguna(item.requested_by?.full_name, item.requested_by?.email)}
                      </span>
                      {item.requested_by_me && (
                        <Badge variant="secondary" className="mt-1">
                          Saya
                        </Badge>
                      )}
                    </AdminTd>
                    <AdminTd className="max-w-[200px]">
                      {item.target?.id ? (
                        <Link
                          href={`/dashboard/admin/pengguna/${item.target.id}`}
                          title={targetNama}
                          className="block truncate font-medium text-charcoal-900 transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
                        >
                          {targetNama}
                        </Link>
                      ) : (
                        <span className="block truncate font-medium text-charcoal-900" title={targetNama}>
                          {targetNama}
                        </span>
                      )}
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        <Badge variant={varianPeran(item.current_role_live ?? item.current_role)}>
                          {labelPeran(item.current_role_live ?? item.current_role)}
                        </Badge>
                        {item.target_is_super_admin && (
                          <Badge variant="warning" className="font-bold">
                            Super Admin
                          </Badge>
                        )}
                      </span>
                    </AdminTd>
                    <AdminTd className="whitespace-nowrap">
                      <span className="text-xs text-sage-500">
                        {labelPeran(item.current_role_live ?? item.current_role)}
                      </span>{' '}
                      <span aria-hidden className="text-sage-500">
                        →
                      </span>{' '}
                      <Badge variant={varianPeran(item.requested_role)}>
                        {labelPeran(item.requested_role)}
                      </Badge>
                    </AdminTd>
                    <AdminTd className="max-w-[200px]">
                      {item.reason ? (
                        <span className="block truncate text-xs text-charcoal-700" title={item.reason}>
                          {item.reason}
                        </span>
                      ) : (
                        <span className="text-xs text-sage-500">—</span>
                      )}
                    </AdminTd>
                    <AdminTd className="whitespace-nowrap">
                      <Badge variant={varianStatusPermintaan(item.status)}>
                        {labelStatusPermintaan(item.status)}
                      </Badge>
                    </AdminTd>
                    <AdminTd className="whitespace-nowrap text-xs text-sage-500">
                      {formatTanggalWaktu(item.created_at)}
                    </AdminTd>
                    <AdminTd className="max-w-[200px]">{keputusanTampil(item)}</AdminTd>
                    {viewerIsSuperAdmin && (
                      <AdminTd className="whitespace-nowrap">
                        {bisaDiputuskan(item) ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 px-2.5"
                              onClick={() => mulaiKeputusan(item, 'approve')}
                            >
                              <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
                              Setujui
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="h-8 px-2.5"
                              onClick={() => mulaiKeputusan(item, 'reject')}
                            >
                              <XCircle aria-hidden className="h-3.5 w-3.5" />
                              Tolak
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-sage-500">—</span>
                        )}
                      </AdminTd>
                    )}
                  </AdminTr>
                );
              })}
            </tbody>
          </AdminTableCard>

          <div className="space-y-3 md:hidden">
            {items.map((item, index) => {
              const targetNama = namaPengguna(item.target?.full_name, item.target?.email);
              return (
                <Card key={item.id ?? `role-request-card-${index}`}>
                  <CardContent className="grid gap-2 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={varianStatusPermintaan(item.status)}>
                        {labelStatusPermintaan(item.status)}
                      </Badge>
                      {item.requested_by_me && <Badge variant="secondary">Saya</Badge>}
                      {item.target_is_super_admin && (
                        <Badge variant="warning" className="font-bold">
                          Super Admin
                        </Badge>
                      )}
                    </div>
                    <div>
                      {item.target?.id ? (
                        <Link
                          href={`/dashboard/admin/pengguna/${item.target.id}`}
                          className="text-sm font-semibold text-charcoal-900 hover:text-primary"
                        >
                          {targetNama}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-charcoal-900">{targetNama}</p>
                      )}
                      <p className="text-xs text-sage-500">
                        Diajukan oleh{' '}
                        {namaPengguna(item.requested_by?.full_name, item.requested_by?.email)} ·{' '}
                        {formatTanggalWaktu(item.created_at)}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-charcoal-700">
                      Peran: {labelPeran(item.current_role_live ?? item.current_role)} →{' '}
                      {labelPeran(item.requested_role)}
                    </p>
                    {item.reason && (
                      <p className="text-xs text-charcoal-700">Alasan: {item.reason}</p>
                    )}
                    {item.status !== 'pending' && (
                      <p className="text-xs text-sage-500">
                        Keputusan: {namaPengguna(item.decided_by?.full_name, item.decided_by?.email)} ·{' '}
                        {formatTanggalWaktu(item.decided_at)}
                        {item.decision_note ? ` — “${item.decision_note}”` : ''}
                      </p>
                    )}
                    {bisaDiputuskan(item) && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => mulaiKeputusan(item, 'approve')}
                        >
                          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
                          Setujui
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => mulaiKeputusan(item, 'reject')}
                        >
                          <XCircle aria-hidden className="h-3.5 w-3.5" />
                          Tolak
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <AdminPagination
            total={total}
            page={page}
            pageSize={PAGE_LIMIT}
            noun="permintaan"
            onPageChange={(next) => load((next - 1) * PAGE_LIMIT, statusFilter, scope)}
          />
        </>
      )}

      {!accessLoading && accessStatus !== 'error' && !viewerIsSuperAdmin && status === 'ready' && items.length > 0 && (
        <p className="mt-4 text-xs text-sage-500">
          Hanya Super Admin yang dapat menyetujui atau menolak permintaan. Kamu dapat
          memantau status permintaan yang diajukan di halaman ini.
        </p>
      )}
    </div>
  );
}
