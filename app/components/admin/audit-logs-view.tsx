'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ClipboardList, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  AuditLogsApiError,
  fetchAuditLogs,
  type AuditLogItem,
} from '@/lib/admin-audit-logs';
import { formatMetadataSafe } from '@/lib/admin-metadata';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER } from './admin-page-header';
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
  AdminTrDetail,
} from './admin-table';
import {
  auditOutcome,
  describeAuditAction,
  describeAuditTarget,
  formatTanggalWaktu,
  labelAudit,
  labelTarget,
  matchesAuditQuery,
  waktuLalu,
} from './admin-format';
import { ADMIN_DETAIL_LABEL } from './admin-detail';

import { redirectIfSessionExpired } from './admin-session';



const PAGE_LIMIT = 20;

const SEMUA_AKSI = { value: '', label: 'Semua tindakan' };
const SEMUA_TARGET = { value: '', label: 'Semua target' };

export function AuditLogsView() {
  const router = useRouter();
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [knownActions, setKnownActions] = useState<string[]>([]);
  const [knownTargetTypes, setKnownTargetTypes] = useState<string[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  // Hanya respons dari request terbaru yang boleh menulis state; respons
  // lama yang datang terlambat tidak boleh menimpa hasil yang sudah tampil.
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (nextOffset: number, action: string, targetType: string) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setStatus('loading');
      setErrorMsg('');
      try {
        const result = await fetchAuditLogs(PAGE_LIMIT, nextOffset, {
          action: action || undefined,
          targetType: targetType || undefined,
          from: from || undefined,
          to: to || undefined,
        });
        if (requestId !== requestIdRef.current) return;
        setItems(result.logs);
        setTotal(result.total);
        setOffset(result.offset);
        setStatus('ready');
        if (!action && !targetType) {
          const actions = Array.from(
            new Set(result.logs.map((l) => l.action).filter(Boolean))
          ).sort();
          const targetTypes = Array.from(
            new Set(result.logs.map((l) => l.targetType).filter(Boolean))
          ).sort();
          setKnownActions(actions);
          setKnownTargetTypes(targetTypes);
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        if (await redirectIfSessionExpired((err as { status?: number })?.status ?? 0, router, () => {
            setErrorMsg('Tidak dapat menghubungi server data. Coba lagi.');
            setStatus('error');
          })) return;
        // Refresh berhasil: request ini tetap gagal, jadi tampilkan error +
        // tombol coba lagi — jangan biarkan status 'loading' menggantung.
        if (requestId !== requestIdRef.current) return;
        if (err instanceof AuditLogsApiError && err.status === 403) {
          setStatus('forbidden');
          return;
        }
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat audit log.');
        setStatus('error');
      }
    },
    [router, from, to]
  );

  useEffect(() => {
    load(0, actionFilter, targetTypeFilter);
  }, [load, actionFilter, targetTypeFilter]);

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const onRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement | HTMLButtonElement>,
    id: string
  ) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleExpanded(id);
  };

  const visible = userQuery.trim()
    ? items.filter((item) => matchesAuditQuery(item, userQuery))
    : items;

  const loading = status === 'loading';

  const hasActiveFilter =
    actionFilter !== '' ||
    targetTypeFilter !== '' ||
    from !== '' ||
    to !== '' ||
    userQuery.trim() !== '';

  const resetFilters = () => {
    setActionFilter('');
    setTargetTypeFilter('');
    setFrom('');
    setTo('');
    setUserQuery('');
    setOffset(0);
  };

  const actionOptions: { value: string; label: string }[] = [
    SEMUA_AKSI,
    ...knownActions.map((action) => ({ value: action, label: labelAudit(action) })),
  ];

  const targetTypeOptions: { value: string; label: string }[] = [
    SEMUA_TARGET,
    ...knownTargetTypes.map((type) => ({ value: type, label: labelTarget(type) })),
  ];

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader
        eyebrow="Admin · Monitoring"
        title="Log Audit"
        description="Jejak audit tindakan administratif: siapa, tindakan apa, objek terdampak, dan hasilnya. Bersifat read-only."
        actions={
          <>
            <Badge variant="secondary" className="text-xs">
              {total} entri
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => load(offset, actionFilter, targetTypeFilter)}
              disabled={loading}
            >
              <RefreshCw aria-hidden className="h-3.5 w-3.5" />
              Muat ulang
            </Button>
          </>
        }
      />

      {/* Satu baris alat: pencarian di awal, filter menyusul. Sebelumnya
          pencarian berada di baris sendiri di atas kotak filter, sehingga
          terlihat terpisah dari kontrol yang berpasangan dengannya. */}
      <AdminToolbar>
        <AdminSearchInput
          value={userQuery}
          onChange={setUserQuery}
          label="Cari log audit"
          placeholder="Cari admin, tindakan, target, alasan…"
          labelVisible
          className="sm:max-w-sm lg:w-56 lg:min-w-[7rem] lg:shrink"
        />
        <AdminSelect
          value={actionFilter}
          onChange={(value) => {
            setActionFilter(value);
            setOffset(0);
          }}
          label="Tindakan"
          options={actionOptions}
        />
        <AdminSelect
          value={targetTypeFilter}
          onChange={(value) => {
            setTargetTypeFilter(value);
            setOffset(0);
          }}
          label="Jenis target"
          options={targetTypeOptions}
        />
        <AdminDateRange
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
        />
        {hasActiveFilter && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="sm:mb-0.5"
          >
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
            Atur ulang
          </Button>
        )}
      </AdminToolbar>

      {status === 'loading' && <AdminLoadingState label="Memuat log audit" />}

      {status === 'forbidden' && (
        <AdminForbiddenState message="Halaman ini hanya untuk admin. Akun kamu tidak memiliki hak melihat log audit." />
      )}

      {status === 'error' && (
        <AdminErrorState
          title="Gagal memuat log audit"
          message={errorMsg}
          onRetry={() => load(offset, actionFilter, targetTypeFilter)}
        />
      )}

      {status === 'ready' && items.length === 0 && (
        <AdminEmptyState
          icon={<ClipboardList aria-hidden className="h-10 w-10 text-primary" />}
          title={hasActiveFilter ? 'Tidak ada entri yang cocok' : 'Belum ada log audit'}
          description={
            hasActiveFilter
              ? 'Tidak ada tindakan admin yang cocok dengan filter saat ini. Ubah atau atur ulang filter.'
              : 'Tindakan admin yang tercatat akan muncul di sini.'
          }
        />
      )}

      {status === 'ready' && items.length > 0 && visible.length === 0 && (
        <AdminEmptyState
          icon={<ClipboardList aria-hidden className="h-10 w-10 text-primary" />}
          title="Tidak ada entri yang cocok di halaman ini"
          description="Pencarian teks hanya menyaring baris pada halaman yang sedang ditampilkan. Atur ulang pencarian atau pindah halaman."
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => setUserQuery('')}>
              Atur ulang pencarian
            </Button>
          }
        />
      )}

      {status === 'ready' && visible.length > 0 && (
        <>
          <AdminTableCard label="Log audit admin" minWidth={900} className="hidden sm:block">
            {/* 6 kolom (sebelumnya 7, minWidth 1080).
                "Jenis Aktivitas" dan "Ringkasan" digabung ke satu kolom:
                describeAuditAction() mengembalikan labelAudit() apa adanya
                untuk sebagian besar aksi, sehingga kedua kolom menampilkan
                teks yang sama persis dan hanya memakan lebar. */}
            <AdminTableHead>
              <AdminTh>Waktu</AdminTh>
              <AdminTh>Admin</AdminTh>
              <AdminTh>Tindakan</AdminTh>
              <AdminTh>Hasil</AdminTh>
              <AdminTh>Objek Terdampak</AdminTh>
              <AdminTh className="w-12 text-right">
                <span className="sr-only">Detail</span>
              </AdminTh>
            </AdminTableHead>
            <tbody>
              {visible.map((item) => {
                const outcome = auditOutcome(item);
                return (
                  <Fragment key={item.id}>
                    <AdminTr
                      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                      onClick={() => toggleExpanded(item.id)}
                      tabIndex={0}
                      aria-expanded={expandedId === item.id}
                      aria-controls={
                        expandedId === item.id ? `audit-detail-${item.id}` : undefined
                      }
                      onKeyDown={(event) => onRowKeyDown(event, item.id)}
                    >
                      <AdminTd className="whitespace-nowrap">
                        <span className="block text-xs text-charcoal-700">
                          {formatTanggalWaktu(item.createdAt)}
                        </span>
                        <span className="mt-0.5 block text-xs text-sage-500">
                          {waktuLalu(item.createdAt)}
                        </span>
                      </AdminTd>
                      <AdminTd className="max-w-[200px]">
                        <p className="truncate text-sm font-medium text-charcoal-900" title={item.adminName}>
                          {item.adminName}
                        </p>
                        {item.adminEmail && (
                          <p className="truncate text-xs text-sage-500" title={item.adminEmail}>
                            {item.adminEmail}
                          </p>
                        )}
                      </AdminTd>
                      <AdminTd className="max-w-[320px]">
                        <Badge variant="outline" className="text-xs">
                          {labelAudit(item.action)}
                        </Badge>
                        {/* Ringkasan hanya ditampilkan bila memberi informasi
                            TAMBAHAN di luar label tindakan. describeAuditAction()
                            mengembalikan labelAudit() apa adanya untuk aksi tanpa
                            metadata, jadi tanpa cek ini teksnya tercetak dua kali. */}
                        {describeAuditAction(item) !== labelAudit(item.action) && (
                          <p className="mt-1 line-clamp-2 break-words text-xs leading-snug text-charcoal-700">
                            {describeAuditAction(item)}
                          </p>
                        )}
                      </AdminTd>
                      <AdminTd className="whitespace-nowrap">
                        {outcome ? (
                          <Badge variant={outcome.tone} className="text-xs">
                            {outcome.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-sage-500">—</span>
                        )}
                      </AdminTd>
                      <AdminTd className="max-w-[180px] whitespace-nowrap">
                        <span className="block truncate text-sm text-charcoal-700" title={describeAuditTarget(item)}>
                          {describeAuditTarget(item)}
                        </span>
                      </AdminTd>
                      <AdminTd className="text-right" aria-hidden>
                        <ChevronDown
                          className={cn(
                            'ml-auto h-4 w-4 text-sage-500 transition-transform',
                            expandedId === item.id && 'rotate-180'
                          )}
                        />
                      </AdminTd>
                    </AdminTr>
                    {expandedId === item.id && (
                      <AdminTrDetail colSpan={6} id={`audit-detail-${item.id}`}>
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                          <div className="min-w-0">
                            <dt className={ADMIN_DETAIL_LABEL}>Tindakan</dt>
                            <dd className="mt-1 text-sm text-charcoal-900">
                              {labelAudit(item.action)}{' '}
                              <span className="font-mono text-xs text-sage-500">({item.action})</span>
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className={ADMIN_DETAIL_LABEL}>Hasil</dt>
                            <dd className="mt-1 text-sm text-charcoal-900">
                              {outcome ? (
                                <Badge variant={outcome.tone} className="text-xs">
                                  {outcome.label}
                                </Badge>
                              ) : (
                                '—'
                              )}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className={ADMIN_DETAIL_LABEL}>Objek terdampak</dt>
                            <dd className="mt-1 break-all font-mono text-xs text-charcoal-700">
                              {labelTarget(item.targetType)}
                              {item.targetId ? ` · ${item.targetId}` : ''}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className={ADMIN_DETAIL_LABEL}>Alasan</dt>
                            <dd className="mt-1 break-words text-sm text-charcoal-700">
                              {item.reason || '—'}
                            </dd>
                          </div>
                          <div className="min-w-0 sm:col-span-2">
                            <dt className={ADMIN_DETAIL_LABEL}>Metadata (aman)</dt>
                            <dd className="mt-1">
                              <pre className="max-h-64 overflow-auto rounded-[var(--radius)] bg-sage-100/40 p-3 text-xs leading-relaxed text-charcoal-700">
                                {formatMetadataSafe(item.metadata)}
                              </pre>
                            </dd>
                          </div>
                        </dl>
                      </AdminTrDetail>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </AdminTableCard>

          <div className="space-y-3 sm:hidden">
            {visible.map((item) => {
              const outcome = auditOutcome(item);
              return (
                <Card key={item.id}>
                  <CardContent className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(item.id)}
                      aria-label={`Buka detail log audit ${item.adminName} — ${labelAudit(item.action)}`}
                      aria-expanded={expandedId === item.id}
                      aria-controls={
                        expandedId === item.id ? `audit-mobile-detail-${item.id}` : undefined
                      }
                      className="block w-full rounded-[var(--radius)] text-left transition-colors hover:bg-sage-100/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-xs">
                          {labelAudit(item.action)}
                        </Badge>
                        {outcome ? (
                          <Badge variant={outcome.tone} className="text-xs">
                            {outcome.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-sage-500">—</span>
                        )}
                      </div>
                      <p className="mt-2 line-clamp-3 break-words text-sm text-charcoal-700">
                        {describeAuditAction(item)}
                      </p>
                      <p className="mt-2 text-xs text-charcoal-700">
                        <span className="text-sage-500">Objek: </span>
                        {describeAuditTarget(item)}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-sage-500">
                        <span className="truncate" title={item.adminName}>
                          {item.adminName}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {formatTanggalWaktu(item.createdAt)}
                          <ChevronDown
                            className={cn(
                              'h-3.5 w-3.5 transition-transform',
                              expandedId === item.id && 'rotate-180'
                            )}
                          />
                        </span>
                      </div>
                    </button>
                    {expandedId === item.id && (
                      <div
                        id={`audit-mobile-detail-${item.id}`}
                        className="mt-3 space-y-2 border-t border-border/60 pt-3"
                      >
                        {item.adminEmail && (
                          <p className="truncate text-xs text-sage-500" title={item.adminEmail}>
                            {item.adminEmail}
                          </p>
                        )}
                        <p className="break-all font-mono text-xs text-charcoal-700">
                          {labelTarget(item.targetType)}
                          {item.targetId ? ` · ${item.targetId}` : ''}
                        </p>
                        {item.reason && (
                          <p className="break-words text-sm text-charcoal-700">{item.reason}</p>
                        )}
                        <pre className="max-h-52 overflow-auto rounded-[var(--radius)] bg-sage-100/40 p-3 text-xs text-charcoal-700">
                          {formatMetadataSafe(item.metadata)}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {status === 'ready' && items.length > 0 && (
        <AdminPagination
          total={total}
          page={Math.floor(offset / PAGE_LIMIT) + 1}
          pageSize={PAGE_LIMIT}
          noun="entri"
          onPageChange={(next) =>
            load((next - 1) * PAGE_LIMIT, actionFilter, targetTypeFilter)
          }
        />
      )}
    </div>
  );
}
