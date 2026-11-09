'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Check, Loader2, LockOpen, RefreshCw, Send, ShieldAlert, X, } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { AdminAvatar } from './admin-avatar';
import { SupportConversationList } from './support-conversation-list';
import { AdminSupportApiError, decideAdminSupportAppeal, fetchAdminSupportThread, markAdminSupportRead, sendAdminSupportReply, setAdminSupportThreadStatus, type AdminSupportAppeal, type AdminSupportThreadDetail, } from '@/lib/admin-support';
import { revokeAllActiveBlocks } from '@/lib/admin-sanctions';
import { SUPPORT_MESSAGE_MAX, appealStatusMeta, supportSenderLabel } from '@/lib/support';
import { AdminErrorState, AdminForbiddenState, AdminInlineError, AdminInlineLoading, AdminLoadingState, } from './admin-state';
import { formatTanggalWaktu, labelPeran, labelStatusAkun } from './admin-format';
import { redirectIfSessionExpired } from './admin-session';
import { SUPPORT_UPDATED_EVENT } from '@/hooks/use-support-badge';
import { subscribeSupportRealtime } from '@/lib/support-realtime';
import { cn } from '@/lib/utils';
export function SupportThreadView({ id }: {
    id: string;
}) {
    const router = useRouter();
    const [detail, setDetail] = useState<AdminSupportThreadDetail | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState('');
    const [busyAction, setBusyAction] = useState(false);
    const [actionNote, setActionNote] = useState('');
    const [actionError, setActionError] = useState('');
    const [appealNote, setAppealNote] = useState('');
    const requestIdRef = useRef(0);
    const listRef = useRef<HTMLDivElement | null>(null);
    const load = useCallback(async (options?: {
        silent?: boolean;
    }) => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        if (!options?.silent)
            setStatus('loading');
        setErrorMsg('');
        try {
            const result = await fetchAdminSupportThread(id);
            if (requestId !== requestIdRef.current)
                return;
            setDetail(result);
            setStatus('ready');
        }
        catch (err) {
            if (requestId !== requestIdRef.current)
                return;
            if (await redirectIfSessionExpired((err as {
                status?: number;
            }).status ?? 0, router, () => {
                setErrorMsg('Tidak dapat menghubungi server data. Coba lagi.');
                setStatus('error');
            }))
                return;
            if (requestId !== requestIdRef.current)
                return;
            if (err instanceof AdminSupportApiError && err.status === 403) {
                setStatus('forbidden');
                return;
            }
            setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat percakapan.');
            setStatus('error');
        }
    }, [id, router]);
    useEffect(() => {
        void load();
    }, [load]);
    useEffect(() => {
        if (status !== 'ready' || !detail || detail.thread.adminUnreadCount === 0)
            return;
        let cancelled = false;
        (async () => {
            try {
                await markAdminSupportRead(id);
                if (cancelled)
                    return;
                setDetail((current) => current
                    ? { ...current, thread: { ...current.thread, adminUnreadCount: 0 } }
                    : current);
                window.dispatchEvent(new Event(SUPPORT_UPDATED_EVENT));
            }
            catch {
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [status, id, detail]);
    useEffect(() => {
        const el = listRef.current;
        if (el)
            el.scrollTo({ top: el.scrollHeight });
    }, [detail?.messages.length]);
    useEffect(() => subscribeSupportRealtime({
        label: 'admin-thread',
        onChange: () => void load({ silent: true }),
    }), [load]);
    const handleReply = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const body = draft.trim();
        if (!body || sending)
            return;
        setSending(true);
        setSendError('');
        try {
            const message = await sendAdminSupportReply(id, body);
            setDraft('');
            setDetail((current) => current ? { ...current, messages: [...current.messages, message] } : current);
            window.dispatchEvent(new Event(SUPPORT_UPDATED_EVENT));
        }
        catch (err) {
            setSendError(err instanceof Error ? err.message : 'Gagal mengirim balasan.');
        }
        finally {
            setSending(false);
        }
    };
    const toggleThreadStatus = async (action: 'close' | 'reopen') => {
        if (busyAction)
            return;
        setBusyAction(true);
        setActionError('');
        try {
            await setAdminSupportThreadStatus(id, action);
            await load({ silent: true });
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : 'Gagal mengubah status percakapan.');
        }
        finally {
            setBusyAction(false);
        }
    };
    const decideAppeal = async (appeal: AdminSupportAppeal, decision: 'reviewing' | 'approved' | 'rejected') => {
        if (busyAction)
            return;
        setBusyAction(true);
        setActionError('');
        setActionNote('');
        try {
            await decideAdminSupportAppeal(id, {
                appealId: appeal.id,
                status: decision,
                note: appealNote.trim(),
            });
            if (decision === 'approved' && detail && detail.activeBlocks.length > 0) {
                const { failed } = await revokeAllActiveBlocks(detail.activeBlocks);
                if (failed.length > 0) {
                    setActionError(`Keputusan banding tersimpan, tetapi blokir BELUM terbuka: ${failed[0].message}`);
                }
                else {
                    setActionNote('Banding disetujui dan blokir akun sudah dibuka. Pengguna dapat login.');
                }
            }
            else if (decision === 'approved') {
                setActionNote('Banding disetujui. Tidak ada blokir aktif pada akun ini.');
            }
            else {
                setActionNote('Keputusan banding tersimpan.');
            }
            setAppealNote('');
            await load({ silent: true });
            window.dispatchEvent(new Event(SUPPORT_UPDATED_EVENT));
        }
        catch (err) {
            setActionError(err instanceof Error ? err.message : 'Gagal menyimpan keputusan banding.');
        }
        finally {
            setBusyAction(false);
        }
    };
    if (status === 'loading') {
        return (<div className="px-4 py-6 sm:px-6 lg:px-8">
        <AdminLoadingState label="Memuat percakapan"/>
      </div>);
    }
    if (status === 'forbidden') {
        return (<div className="px-4 py-6 sm:px-6 lg:px-8">
        <AdminForbiddenState message="Halaman ini hanya untuk admin."/>
      </div>);
    }
    if (status === 'error' || !detail) {
        return (<div className="px-4 py-6 sm:px-6 lg:px-8">
        <AdminErrorState title="Gagal memuat percakapan" message={errorMsg} onRetry={() => load()}/>
      </div>);
    }
    const { thread, profile, messages, appeals, activeBlocks } = detail;
    const displayName = profile?.fullName?.trim() || thread.email || 'Pengguna';
    const statusAkun = labelStatusAkun(profile?.accountStatus);
    const latestAppeal = appeals[0] ?? null;
    const latestAppealMeta = latestAppeal ? appealStatusMeta(latestAppeal.status) : null;
    const blocked = activeBlocks.length > 0 ||
        profile?.accountStatus === 'banned' ||
        profile?.accountStatus === 'suspended';
    const ditutup = thread.status === 'closed';
    return (<div className="flex flex-col gap-4 px-4 pb-8 pt-5 sm:px-6 lg:h-[clamp(32rem,calc(100dvh-4rem),52rem)] lg:flex-row lg:items-stretch lg:px-8">
      
      <SupportConversationList activeThreadId={id} className="hidden w-[300px] shrink-0 lg:flex"/>

      <section aria-label="Isi percakapan" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-admin-line bg-admin-panel shadow-admin-card">
        <header className="flex shrink-0 flex-wrap items-center gap-4 border-b border-admin-line px-4 py-3 sm:px-5">
          <Link href="/dashboard/admin/chat" aria-label="Kembali ke daftar percakapan" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sage-500 transition-colors hover:bg-admin-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden">
            <ArrowLeft aria-hidden className="h-4 w-4"/>
          </Link>

          <AdminAvatar src={profile?.avatarUrl ?? null} name={displayName} email={thread.email} size="md" className="shrink-0"/>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-bold tracking-tight text-charcoal-900">
              {displayName}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-sage-500">
              <span className="truncate">{thread.email}</span>
              <span aria-hidden>·</span>
              <span className={cn('inline-flex items-center gap-1 font-semibold', ditutup ? 'text-sage-500' : 'text-success')}>
                <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', ditutup ? 'bg-sage-500' : 'bg-success')}/>
                {ditutup ? 'Ditutup' : 'Terbuka'}
              </span>
              {thread.origin === 'banding' && (<>
                  <span aria-hidden>·</span>
                  <span className="font-semibold text-warning-strong">Dari banding</span>
                </>)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => void load()} disabled={busyAction} aria-label="Muat ulang percakapan" className="flex h-9 w-9 items-center justify-center rounded-full text-sage-500 transition-colors hover:bg-admin-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50">
              <RefreshCw aria-hidden className="h-4 w-4"/>
            </button>
            <button type="button" onClick={() => toggleThreadStatus(ditutup ? 'reopen' : 'close')} disabled={busyAction} className="rounded-full border border-admin-line px-3 py-1.5 text-[11px] font-semibold text-charcoal-700 transition-colors hover:bg-admin-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50">
              {ditutup ? 'Buka kembali' : 'Tutup'}
            </button>
          </div>
        </header>

        <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-admin-surface/40 px-4 py-4 sm:px-5" aria-live="polite">
          {messages.length === 0 ? (<p className="text-sm text-sage-500">Belum ada pesan pada percakapan ini.</p>) : (messages.map((message) => {
            const fromSystem = message.senderKind === 'system';
            const fromAdmin = message.senderKind === 'admin';
            return (<div key={message.id} className={cn('flex', fromAdmin ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] px-3.5 py-2.5 sm:max-w-[75%]', fromSystem
                    ? 'rounded-xl border border-dashed border-sage-500/50 bg-sage-100/70'
                    : fromAdmin
                        ? 'rounded-2xl rounded-br-md bg-primary'
                        : 'rounded-2xl rounded-bl-md border border-admin-line bg-white')}>
                    <p className={cn('text-[10px] font-semibold uppercase tracking-[0.1em]', fromAdmin ? 'text-white/70' : 'text-sage-500')}>
                      {supportSenderLabel(message.senderKind)}
                      {message.createdAt ? ` · ${formatTanggalWaktu(message.createdAt)}` : ''}
                    </p>
                    <p className={cn('mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed', fromAdmin ? 'text-white' : 'text-charcoal-900')}>
                      {message.body}
                    </p>
                  </div>
                </div>);
        }))}
        </div>

        <form onSubmit={handleReply} className="shrink-0 border-t border-admin-line px-4 py-3 sm:px-5">
          <AdminInlineError message={sendError}/>
          <label htmlFor="admin-support-reply" className="sr-only">
            Balas sebagai admin
          </label>
          <div className="mt-1 flex items-center gap-2 rounded-full border border-admin-line bg-admin-surface py-1.5 pl-4 pr-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <input id="admin-support-reply" type="text" value={draft} onChange={(event) => setDraft(event.target.value.slice(0, SUPPORT_MESSAGE_MAX))} maxLength={SUPPORT_MESSAGE_MAX} placeholder="Tulis balasan untuk pengguna…" autoComplete="off" className="h-8 min-w-0 flex-1 bg-transparent text-sm text-charcoal-900 outline-none placeholder:text-sage-500"/>
            <button type="submit" disabled={sending || !draft.trim()} aria-label={sending ? 'Mengirim balasan' : 'Kirim balasan'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40">
              {sending ? (<Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none"/>) : (<Send aria-hidden className="h-4 w-4"/>)}
            </button>
          </div>
          <p className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-sage-500">
            <span>Dibalas sebagai Admin ReBites.</span>
            <span className="tabular-nums">
              {draft.trim().length}/{SUPPORT_MESSAGE_MAX}
            </span>
          </p>
        </form>
      </section>

      <aside aria-label="Keterangan akun" className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto lg:w-[300px]">
        <div className="rounded-xl border border-admin-line bg-admin-panel p-4 shadow-admin-card">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sage-500">
            Akun
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {statusAkun ? (<span className="rounded-full bg-destructive/[0.15] px-2.5 py-0.5 text-[11px] font-semibold text-destructive">
                {statusAkun}
              </span>) : (<span className="rounded-full bg-success/[0.15] px-2.5 py-0.5 text-[11px] font-semibold text-success">
                Aktif
              </span>)}
            {profile?.role && (<span className="rounded-full bg-admin-surface px-2.5 py-0.5 text-[11px] font-semibold text-charcoal-700">
                {labelPeran(profile.role)}
              </span>)}
            {profile?.deletedAt && (<span className="rounded-full bg-destructive/[0.15] px-2.5 py-0.5 text-[11px] font-semibold text-destructive">
                Akun dihapus
              </span>)}
          </div>
          <div className="mt-3 space-y-1 text-sm text-charcoal-700">
            <p className="break-words">{profile?.email || thread.email}</p>
            {profile?.phone?.trim() && (<p className="break-words">
                <span className="text-sage-500">Telepon </span>
                {profile.phone.trim()}
              </p>)}
          </div>
          {profile?.id && (<Link href={`/dashboard/admin/pengguna/${profile.id}`} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              Buka detail pengguna
              <ArrowUpRight aria-hidden className="h-3.5 w-3.5"/>
            </Link>)}
          {blocked && (<p className="mt-3 rounded-[var(--radius)] border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive">
              Akun ini {activeBlocks.length > 0 ? 'masih diblokir/ditangguhkan' : 'berstatus tidak aktif'}.
              {activeBlocks.length > 0
                ? ' Buka blokir lewat tombol di panel banding, atau dari halaman detail pengguna.'
                : ''}
            </p>)}
          {activeBlocks.length > 0 && (<ul className="mt-3 grid gap-1.5">
              {activeBlocks.map((block) => (<li key={block.id} className="rounded-[var(--radius)] bg-admin-surface px-3 py-2 text-xs">
                  <p className="font-semibold text-charcoal-900">
                    {block.sanctionType.toLowerCase() === 'ban' ? 'Diblokir' : 'Ditangguhkan'}
                    {' · '}
                    {block.endAt ? `sampai ${formatTanggalWaktu(block.endAt)}` : 'tanpa batas waktu'}
                  </p>
                  <p className="mt-0.5 leading-relaxed text-sage-500">
                    {block.reason.trim() || 'Tanpa alasan tercatat'}
                  </p>
                </li>))}
            </ul>)}
        </div>

        {latestAppeal && latestAppealMeta && (<div className="rounded-xl border border-warning/30 bg-admin-panel p-4 shadow-admin-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-warning-strong">
                <ShieldAlert aria-hidden className="h-3.5 w-3.5"/>
                Banding
              </p>
              <span className="rounded-full bg-admin-surface px-2.5 py-0.5 text-[11px] font-semibold text-charcoal-700">
                {latestAppealMeta.label}
              </span>
            </div>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-sage-500">
              Dikirim {formatTanggalWaktu(latestAppeal.createdAt)}
            </p>
            <p className="mt-1.5 whitespace-pre-wrap break-words rounded-[var(--radius)] bg-admin-surface px-3 py-2 text-[13px] leading-relaxed text-charcoal-700">
              {latestAppeal.message}
            </p>
            {latestAppeal.decisionNote && (<p className="mt-2 text-xs leading-relaxed text-charcoal-700">
                <span className="font-semibold">Catatan keputusan: </span>
                {latestAppeal.decisionNote}
              </p>)}

            <label htmlFor="appeal-decision-note" className="mt-3 block text-xs font-semibold text-charcoal-900">
              Catatan untuk pengguna (opsional)
            </label>
            <textarea id="appeal-decision-note" value={appealNote} onChange={(event) => setAppealNote(event.target.value.slice(0, 1000))} rows={2} maxLength={1000} placeholder="Mis. blokir dibuka setelah verifikasi bukti." className="mt-1 w-full rounded-[var(--radius)] border border-admin-line bg-white px-3 py-2 text-sm leading-relaxed outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"/>

            <AdminInlineError message={actionError}/>
            {actionNote && (<p role="status" className="mt-2 rounded-[var(--radius)] border border-success/25 bg-success/5 px-3 py-2 text-xs font-medium leading-relaxed text-success">
                {actionNote}
              </p>)}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={busyAction} onClick={() => void decideAppeal(latestAppeal, 'approved')}>
                <LockOpen aria-hidden className="h-3.5 w-3.5"/>
                Setujui &amp; buka blokir
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busyAction} onClick={() => void decideAppeal(latestAppeal, 'reviewing')}>
                Tandai ditinjau
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busyAction} onClick={() => void decideAppeal(latestAppeal, 'rejected')}>
                <X aria-hidden className="h-3.5 w-3.5"/>
                Tolak
              </Button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-sage-500">
              Menyetujui akan mencabut SEMUA sanksi blokir/penangguhan yang masih
              berlaku, supaya akun benar-benar dapat login lagi.
            </p>
          </div>)}

        {appeals.length > 1 && (<div className="rounded-xl border border-admin-line bg-admin-panel p-4 shadow-admin-card">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sage-500">
              Riwayat banding
            </p>
            <ul className="mt-2 grid gap-1.5">
              {appeals.slice(1).map((appeal) => {
                const meta = appealStatusMeta(appeal.status);
                return (<li key={appeal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] bg-admin-surface px-3 py-2">
                    <span className="text-xs text-charcoal-700">
                      {formatTanggalWaktu(appeal.createdAt)}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-charcoal-700">
                      {meta.label}
                    </span>
                  </li>);
            })}
            </ul>
          </div>)}

        {latestAppeal && (<p className="flex items-center gap-1.5 px-1 text-[11px] text-sage-500">
            <Check aria-hidden className="h-3 w-3"/>
            ID banding {latestAppeal.id.slice(0, 8)} — kode banding dipegang pengguna dan
            tidak ditampilkan kepada admin.
          </p>)}

        {status === 'ready' && detail.messages.length === 0 && (<AdminInlineLoading label="Belum ada pesan"/>)}
      </aside>
    </div>);
}
