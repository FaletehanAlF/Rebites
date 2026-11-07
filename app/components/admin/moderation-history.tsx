'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Flag, History, RefreshCw } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { AuditLogsApiError, fetchAuditLogs, type AuditLogItem, } from '@/lib/admin-audit-logs';
import { AdminPagination } from './admin-controls';
import { AdminInlineError, AdminInlineLoading, AdminInlineMessage, } from './admin-state';
import { auditOutcome, formatTanggalWaktu, labelAudit, waktuLalu, } from './admin-format';
import { redirectIfSessionExpired } from './admin-session';
const PAGE_LIMIT = 10;
const LAPORAN_HREF = '/dashboard/admin/monitoring/laporan';
type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive';
function actionVariant(action: string): BadgeVariant {
    switch (action) {
        case 'issue_warning':
            return 'warning';
        case 'issue_sanction':
        case 'suspend_user':
        case 'ban_user':
            return 'destructive';
        case 'activate_user':
            return 'success';
        default:
            return 'secondary';
    }
}
function reportIdOf(item: AuditLogItem): string | null {
    const value = item.metadata.report_id;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function periodeSanksi(item: AuditLogItem): string | null {
    if (item.action !== 'issue_sanction')
        return null;
    const mulai = typeof item.metadata.start_at === 'string' ? item.metadata.start_at : null;
    const selesai = typeof item.metadata.end_at === 'string' ? item.metadata.end_at : null;
    if (!mulai && !selesai)
        return null;
    return `${mulai ? formatTanggalWaktu(mulai) : '-'} – ${selesai ? formatTanggalWaktu(selesai) : 'permanen'}`;
}
export function ModerationHistory({ userId, title = 'Riwayat Moderasi', description, emptyMessage = 'Belum ada tindakan moderasi yang tercatat untuk pengguna ini.', }: {
    userId: string | null;
    title?: string;
    description?: string;
    emptyMessage?: string;
}) {
    const router = useRouter();
    const [items, setItems] = useState<AuditLogItem[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const requestIdRef = useRef(0);
    const load = useCallback(async (nextOffset: number) => {
        if (!userId) {
            setItems([]);
            setTotal(0);
            setOffset(0);
            setStatus('ready');
            return;
        }
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setStatus('loading');
        setErrorMsg('');
        try {
            const result = await fetchAuditLogs(PAGE_LIMIT, nextOffset, {
                targetType: 'user',
                targetId: userId,
            });
            if (requestId !== requestIdRef.current)
                return;
            setItems(result.logs);
            setTotal(result.total);
            setOffset(result.offset);
            setStatus('ready');
        }
        catch (err) {
            if (requestId !== requestIdRef.current)
                return;
            if (await redirectIfSessionExpired((err as {
                status?: number;
            })?.status ?? 0, router, () => {
                setErrorMsg('Tidak dapat menghubungi server data. Coba lagi.');
                setStatus('error');
            }))
                return;
            if (requestId !== requestIdRef.current)
                return;
            if (err instanceof AuditLogsApiError && err.status === 403) {
                setStatus('forbidden');
                return;
            }
            setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat riwayat moderasi.');
            setStatus('error');
        }
    }, [router, userId]);
    useEffect(() => {
        load(0);
    }, [load]);
    return (<Card className="mt-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History aria-hidden className="h-4 w-4 text-primary"/>
          {title}
        </CardTitle>
        {description && <p className="mt-1 text-xs text-sage-500">{description}</p>}
      </CardHeader>
      <CardContent>
        {status === 'loading' && <AdminInlineLoading label="Memuat riwayat moderasi"/>}

        {status === 'forbidden' && (<AdminInlineMessage tone="danger">
            Akses ditolak. Hanya admin yang dapat melihat riwayat moderasi.
          </AdminInlineMessage>)}

        {status === 'error' && (<div className="flex flex-col items-center gap-4 py-2">
            <AdminInlineError message={errorMsg}/>
            <Button type="button" size="sm" variant="outline" onClick={() => {
                void load(offset);
            }}>
              <RefreshCw aria-hidden className="h-3.5 w-3.5"/>
              Coba Lagi
            </Button>
          </div>)}

        {status === 'ready' && items.length === 0 && (<div className="py-6 text-center">
            <AdminInlineMessage>{emptyMessage}</AdminInlineMessage>
          </div>)}

        {status === 'ready' && items.length > 0 && (<>
            <ol className="grid gap-4">
              {items.map((item, index) => {
                const outcome = auditOutcome(item);
                const reportId = reportIdOf(item);
                const periode = periodeSanksi(item);
                return (<li key={item.id || `${item.createdAt}-${index}`} className="rounded-[var(--radius)] bg-cream-50 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={actionVariant(item.action)}>
                        {labelAudit(item.action)}
                      </Badge>
                      {outcome && <Badge variant={outcome.tone}>{outcome.label}</Badge>}
                      <span className="ml-auto whitespace-nowrap text-xs text-sage-500">
                        {formatTanggalWaktu(item.createdAt)}
                      </span>
                    </div>
                    {item.reason && (<p className="mt-2 whitespace-pre-line break-words text-sm text-charcoal-700">
                        {item.reason}
                      </p>)}
                    {periode && (<p className="mt-1 text-xs text-sage-500">Masa berlaku: {periode}</p>)}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sage-500">
                      <span className="break-words">
                        oleh {item.adminName}
                        {item.adminEmail ? ` (${item.adminEmail})` : ''}
                      </span>
                      <span>{waktuLalu(item.createdAt)}</span>
                      {reportId && (<Link href={`${LAPORAN_HREF}/${reportId}`} title={`Laporan terkait: ${reportId}`} className="inline-flex items-center gap-1 font-bold text-primary underline underline-offset-2 transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                          <Flag aria-hidden className="h-3 w-3"/>
                          Laporan terkait #{reportId.slice(0, 8)}
                        </Link>)}
                    </div>
                  </li>);
            })}
            </ol>
            {total > PAGE_LIMIT && (<AdminPagination total={total} page={Math.floor(offset / PAGE_LIMIT) + 1} pageSize={PAGE_LIMIT} noun="tindakan moderasi" onPageChange={(next) => {
                    void load((next - 1) * PAGE_LIMIT);
                }}/>)}
          </>)}
      </CardContent>
    </Card>);
}
