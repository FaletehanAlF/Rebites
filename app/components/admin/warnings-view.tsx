'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { cn } from '@/lib/utils';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER, } from './admin-page-header';
import { AdminEmptyState, AdminErrorState, AdminForbiddenState, AdminInlineError, AdminInlineLoading, AdminInlineMessage, AdminLoadingState, } from './admin-state';
import { AdminPagination, AdminSearchInput, AdminSelect, AdminToolbar, } from './admin-controls';
import { formatTanggalWaktu } from './admin-format';
import { WarningsApiError, fetchWarningOverview, fetchWarnings, type WarningItem, type WarningOverviewUser, } from '@/lib/admin-warnings';
import { SanctionDecisionModal } from './sanction-decision-modal';
const PAGE_LIMIT = 20;
const NOTE_MS = 4000;
type LoadOutcome = 'ok' | 'error' | 'forbidden' | 'unauthorized' | 'stale';
const LEVEL_FILTERS: {
    value: string;
    label: string;
}[] = [
    { value: '', label: 'Semua tingkat' },
    { value: '1', label: 'Tingkat 1' },
    { value: '2', label: 'Tingkat 2' },
    { value: '3', label: 'Tingkat 3' },
];
function levelBadgeVariant(level: number): 'secondary' | 'warning' | 'destructive' {
    switch (level) {
        case 1:
            return 'secondary';
        case 2:
            return 'warning';
        case 3:
            return 'destructive';
        default:
            return 'secondary';
    }
}
function levelLabel(level: number): string {
    if (level >= 1 && level <= 3)
        return `Tingkat ${level}`;
    return 'Tanpa tingkat';
}
export function WarningsView() {
    const router = useRouter();
    const [overview, setOverview] = useState<WarningOverviewUser[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [q, setQ] = useState('');
    const [qApplied, setQApplied] = useState('');
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [note, setNote] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<WarningOverviewUser | null>(null);
    const [history, setHistory] = useState<WarningItem[]>([]);
    const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>('ready');
    const [levelFilter, setLevelFilter] = useState<1 | 2 | 3 | null>(null);
    const [sanctionOpen, setSanctionOpen] = useState(false);
    const requestIdRef = useRef(0);
    const historyRef = useRef<HTMLDivElement | null>(null);
    const load = useCallback(async (nextOffset: number): Promise<LoadOutcome> => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setStatus('loading');
        setErrorMsg('');
        try {
            const result = await fetchWarningOverview(PAGE_LIMIT, nextOffset, qApplied || undefined);
            if (requestId !== requestIdRef.current)
                return 'stale';
            setOverview(result.users);
            setTotal(result.total);
            setOffset(result.offset);
            setStatus('ready');
            return 'ok';
        }
        catch (err) {
            if (requestId !== requestIdRef.current)
                return 'stale';
            if (err instanceof WarningsApiError && err.status === 401) {
                router.replace('/auth/login');
                return 'unauthorized';
            }
            if (err instanceof WarningsApiError && err.status === 403) {
                setStatus('forbidden');
                return 'forbidden';
            }
            setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat peringatan.');
            setStatus('error');
            return 'error';
        }
    }, [router, qApplied]);
    useEffect(() => {
        setNote(null);
        void load(0);
    }, [load]);
    useEffect(() => {
        if (!note)
            return;
        const timer = setTimeout(() => setNote(null), NOTE_MS);
        return () => clearTimeout(timer);
    }, [note]);
    const handleReload = useCallback(async () => {
        setNote(null);
        const outcome = await load(offset);
        if (outcome === 'ok')
            setNote('Daftar peringatan diperbarui.');
    }, [load, offset]);
    const loadHistory = useCallback(async (user: WarningOverviewUser, level: 1 | 2 | 3 | null) => {
        setHistoryStatus('loading');
        try {
            const result = await fetchWarnings(50, 0, level ?? undefined, { userId: user.userId });
            setHistory(result.warnings);
            setHistoryStatus('ready');
        }
        catch {
            setHistoryStatus('error');
        }
    }, []);
    const selectUser = (user: WarningOverviewUser) => {
        setSelectedUser(user);
        setLevelFilter(null);
        loadHistory(user, null);
    };
    useEffect(() => {
        if (!selectedUser)
            return;
        historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [selectedUser]);
    return (<div className={ADMIN_PAGE_WRAPPER}>

      <AdminPageHeader title="Peringatan" description="Ringkasan peringatan per pengguna dan riwayatnya." actions={<>

            <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">

              {total} pengguna

            </Badge>

            <Button type="button" variant="outline" onClick={() => void handleReload()} disabled={status === 'loading'}>

              <RefreshCw aria-hidden className="h-4 w-4"/>

              Muat ulang

            </Button>

          </>}/>



      <AdminToolbar className="mb-6">

        <form className="flex min-w-0 flex-1 flex-wrap items-end gap-2" onSubmit={(e) => {
            e.preventDefault();
            setQApplied(q.trim());
        }}>

          <AdminSearchInput value={q} onChange={setQ} label="Cari pengguna pada halaman ini" labelVisible placeholder="Cari nama atau email (halaman ini)…"/>

          <Button type="submit" className="shrink-0">

            Cari

          </Button>

        </form>

      </AdminToolbar>



      {note && (<p role="status" className="mb-6 flex items-center gap-1.5 text-xs font-semibold text-success">

          <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0"/>

          {note}

        </p>)}



      {status === 'loading' && <AdminLoadingState label="Memuat peringatan"/>}



      {status === 'forbidden' && (<AdminForbiddenState message="Halaman ini hanya untuk admin."/>)}



      {status === 'error' && (<AdminErrorState title="Gagal memuat peringatan" message={errorMsg} onRetry={() => void load(offset)}/>)}



      {status === 'ready' && overview.length === 0 && (<AdminEmptyState icon={<TriangleAlert aria-hidden className="h-10 w-10 text-primary"/>} title={qApplied ? 'Pengguna tidak ditemukan di halaman ini' : 'Belum ada peringatan'} description={qApplied
                ? 'Tidak ada pengguna pada halaman ini yang cocok dengan pencarian. Pencarian hanya menyaring data halaman yang sedang ditampilkan.'
                : 'Peringatan yang diberikan admin akan muncul di sini.'} action={qApplied ? (<Button type="button" variant="outline" onClick={() => {
                    setQ('');
                    setQApplied('');
                }}>

                <RefreshCw aria-hidden className="h-4 w-4"/>

                Atur ulang pencarian

              </Button>) : undefined}/>)}



      {status === 'ready' && overview.length > 0 && (<>

          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">

            {overview.map((user) => {
                const isSelected = selectedUser?.userId === user.userId;
                return (<div key={user.userId} className="relative">

                  <Card className={isSelected ? 'ring-2 ring-primary/40' : undefined}>

                    <CardContent className="p-4">

                      <div className="flex items-start justify-between gap-4">

                        <div className="min-w-0">

                          <p className="truncate text-sm font-semibold text-charcoal-900" title={user.userName}>

                            {user.userName}

                          </p>

                          {user.userEmail && (<p className="truncate text-xs text-charcoal-500" title={user.userEmail}>

                              {user.userEmail}

                            </p>)}

                        </div>

                        

                        <Badge variant="secondary" className="shrink-0">

                          {user.warningCount} peringatan

                        </Badge>

                      </div>



                      <div className="mt-3 flex flex-wrap items-center gap-2">

                        

                        <Badge variant={levelBadgeVariant(Math.min(user.maxLevel, 3))}>

                          Level tertinggi: {levelLabel(user.maxLevel)}

                        </Badge>

                        <span className="text-xs text-charcoal-500">

                          Terakhir {formatTanggalWaktu(user.lastWarningAt)}

                        </span>

                      </div>



                      {user.warningCount >= 3 && (<p className="mt-3 rounded-[var(--radius)] bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">

                          Pengguna telah mencapai ambang 3 peringatan. Admin perlu meninjau

                          tindakan berikutnya.

                        </p>)}

                    </CardContent>

                  </Card>

                  <button type="button" onClick={() => selectUser(user)} aria-pressed={isSelected} aria-label={`Lihat riwayat peringatan ${user.userName}`} className="absolute inset-0 rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"/>

                </div>);
            })}

          </div>



          {qApplied && (<p className="mt-4 text-xs leading-relaxed text-charcoal-500">

              Pencarian menyaring hanya pengguna pada halaman ini; jumlah dan pagination

              mengikuti data halaman, bukan seluruh basis data.

            </p>)}



          {selectedUser && (<div ref={historyRef} className="scroll-mt-24">

              <Card className="mt-6">

                <CardContent className="p-5">

                  

                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-4">

                    <div className="min-w-0">

                      <p className="text-xs font-bold uppercase tracking-[0.06em] text-charcoal-500">

                        Riwayat peringatan

                      </p>

                      <h2 className="mt-1 break-words font-display text-lg font-semibold text-charcoal-900">

                        {selectedUser.userName}

                      </h2>

                      {selectedUser.userEmail && (<p className="mt-0.5 break-words text-sm text-charcoal-500">

                          {selectedUser.userEmail}

                        </p>)}

                      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-charcoal-700">

                        <Badge variant="secondary">

                          {selectedUser.warningCount} peringatan

                        </Badge>

                        <Badge variant={levelBadgeVariant(Math.min(selectedUser.maxLevel, 3))}>

                          Level tertinggi: {levelLabel(selectedUser.maxLevel)}

                        </Badge>

                      </p>

                    </div>

                    <Button type="button" variant="outline" size="sm" onClick={() => setSelectedUser(null)} aria-label="Tutup riwayat peringatan">

                      <X aria-hidden className="h-3.5 w-3.5"/>

                      Tutup

                    </Button>

                  </div>



                  <div className="mt-4 flex flex-wrap items-end justify-between gap-4">

                    <AdminSelect value={String(levelFilter ?? '')} onChange={(value) => {
                    const next = (Number(value) || null) as 1 | 2 | 3 | null;
                    setLevelFilter(next);
                    void loadHistory(selectedUser, next);
                }} label="Saring tingkat" options={LEVEL_FILTERS}/>

                    <Button variant="outline" onClick={() => setSanctionOpen(true)}>

                      Tinjau Pengguna

                    </Button>

                  </div>



                  {historyStatus === 'loading' && <AdminInlineLoading label="Memuat riwayat"/>}



                  {historyStatus === 'error' && (<div className="mt-4 flex flex-wrap items-center gap-2">

                      <AdminInlineError message="Gagal memuat riwayat peringatan."/>

                      <Button variant="outline" onClick={() => void loadHistory(selectedUser, levelFilter)}>

                        <RefreshCw aria-hidden className="h-4 w-4"/>

                        Coba lagi

                      </Button>

                    </div>)}

                  {historyStatus === 'ready' && history.length === 0 && (<div className="mt-4">

                      <AdminInlineMessage>Belum ada riwayat untuk filter ini.</AdminInlineMessage>

                    </div>)}



                  {historyStatus === 'ready' && history.length > 0 && (<>

                      <p className="mt-4 text-xs text-charcoal-500">

                        {history.length} peringatan, terbaru di atas.

                      </p>

                      <ol className="mt-3 space-y-3">

                        {history.map((w, index) => {
                        const isLast = index === history.length - 1;
                        return (<li key={w.id} className="flex gap-4">

                              <div aria-hidden className="mt-1 flex flex-col items-center">

                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary"/>

                                

                                {!isLast && <span className="mt-1 w-px flex-1 bg-border"/>}

                              </div>

                              

                              <div className="mb-1 min-w-0 flex-1 rounded-[var(--radius)] border border-border/70 bg-admin-surface p-3.5">

                                <div className="flex flex-wrap items-center gap-2">

                                  <Badge variant={levelBadgeVariant(w.warningLevel)}>

                                    {levelLabel(w.warningLevel)}

                                  </Badge>

                                  <span className="text-sm font-semibold text-charcoal-900">

                                    {w.category}

                                  </span>

                                </div>

                                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-charcoal-700">

                                  {w.reason}

                                </p>

                                <dl className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-2 text-xs text-charcoal-500">

                                  <div className="flex items-center gap-1">

                                    <dt className="font-semibold">Diberikan oleh</dt>

                                    <dd>{w.issuerName}</dd>

                                  </div>

                                  <div className="flex items-center gap-1">

                                    <dt className="font-semibold">Tanggal</dt>

                                    <dd>{formatTanggalWaktu(w.createdAt)}</dd>

                                  </div>

                                  {w.reportId && (<div className="flex items-center gap-1">

                                      <dt className="font-semibold">Laporan</dt>

                                      <dd>

                                        <Link href={`/dashboard/admin/monitoring/laporan/${w.reportId}`} className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">

                                          Buka laporan

                                        </Link>

                                      </dd>

                                    </div>)}

                                </dl>

                              </div>

                            </li>);
                    })}

                      </ol>

                    </>)}

                </CardContent>

              </Card>

            </div>)}



          <AdminPagination total={total} page={Math.floor(offset / PAGE_LIMIT) + 1} pageSize={PAGE_LIMIT} noun="pengguna" className="mt-6" onPageChange={(next) => void load((next - 1) * PAGE_LIMIT)}/>

        </>)}



      <SanctionDecisionModal open={sanctionOpen} onOpenChange={setSanctionOpen} userId={selectedUser?.userId ?? null} userName={selectedUser?.userName ?? ''} onSuccess={() => {
            setNote('Sanksi diterapkan. Daftar peringatan dimuat ulang.');
            void load(offset);
        }}/>

    </div>);
}
