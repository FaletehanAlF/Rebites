'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { SUPPORT_MESSAGE_MAX, appealStatusMeta, formatAppealCode, isPlausibleAppealCode, normalizeAppealCode, supportSenderLabel, } from '@/lib/support';
import { BANDING_CODE_STORAGE_KEY } from './banding-form';
interface AppealMessage {
    id: string;
    senderKind: string;
    channel: string;
    body: string;
    createdAt: string | null;
}
interface AppealDetail {
    status: string;
    decisionNote: string | null;
    createdAt: string;
    decidedAt: string | null;
}
function formatWaktu(iso: string | null): string {
    if (!iso)
        return '';
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime()))
        return '';
    try {
        return parsed.toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    catch {
        return '';
    }
}
export function BandingStatus() {
    const [code, setCode] = useState('');
    const [lookupCode, setLookupCode] = useState<string | null>(null);
    const [appeal, setAppeal] = useState<AppealDetail | null>(null);
    const [messages, setMessages] = useState<AppealMessage[]>([]);
    const [status, setStatus] = useState<'form' | 'loading' | 'ready' | 'not-found'>('form');
    const [error, setError] = useState('');
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [sendNote, setSendNote] = useState('');
    const requestIdRef = useRef(0);
    const load = useCallback(async (targetCode: string) => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setStatus('loading');
        setError('');
        try {
            const res = await fetch('/api/support/appeal/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: targetCode }),
            });
            if (requestId !== requestIdRef.current)
                return;
            if (res.status === 404) {
                setStatus('not-found');
                return;
            }
            const json = (await res.json().catch(() => null)) as {
                appeal?: AppealDetail;
                messages?: AppealMessage[];
                error?: string;
            } | null;
            if (!res.ok || !json?.appeal) {
                setStatus('form');
                setError(json?.error ?? 'Gagal memuat status banding. Coba lagi.');
                return;
            }
            setAppeal(json.appeal);
            setMessages(Array.isArray(json.messages) ? json.messages : []);
            setLookupCode(targetCode);
            setStatus('ready');
        }
        catch {
            if (requestId !== requestIdRef.current)
                return;
            setStatus('form');
            setError('Tidak dapat menghubungi server ReBites. Periksa koneksimu, lalu coba lagi.');
        }
    }, []);
    useEffect(() => {
        let stored: string | null = null;
        try {
            stored = window.sessionStorage.getItem(BANDING_CODE_STORAGE_KEY);
        }
        catch {
            stored = null;
        }
        if (stored && isPlausibleAppealCode(stored)) {
            setCode(formatAppealCode(stored));
            void load(normalizeAppealCode(stored));
        }
    }, [load]);
    const handleLookup = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const normalized = normalizeAppealCode(code);
        if (!isPlausibleAppealCode(normalized)) {
            setError('Kode banding terdiri dari 12 huruf/angka, mis. RB-A1B2-C3D4-E5F6.');
            return;
        }
        void load(normalized);
    };
    const handleFollowUp = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (sending || !lookupCode)
            return;
        const body = draft.trim();
        if (!body)
            return;
        setSending(true);
        setSendNote('');
        try {
            const res = await fetch('/api/support/appeal/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: lookupCode, message: body }),
            });
            const json = (await res.json().catch(() => null)) as {
                error?: string;
            } | null;
            if (!res.ok) {
                setSendNote(json?.error ?? 'Pesan gagal dikirim. Coba lagi sebentar lagi.');
                return;
            }
            setDraft('');
            setSendNote('Pesan terkirim ke admin.');
            await load(lookupCode);
        }
        catch {
            setSendNote('Tidak dapat menghubungi server ReBites. Coba lagi.');
        }
        finally {
            setSending(false);
        }
    };
    const meta = appeal ? appealStatusMeta(appeal.status) : null;
    return (<div>
      <Link href="/banding" className="inline-flex items-center gap-1.5 font-sans text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary">
        <ArrowLeft aria-hidden className="h-3.5 w-3.5"/>
        Kirim banding baru
      </Link>

      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
        Status banding
      </h1>
      <p className="mt-3 max-w-prose font-sans text-[15px] leading-relaxed text-muted-foreground">
        Masukkan kode banding yang kamu simpan saat mengirim banding untuk
        melihat perkembangannya dan menambah keterangan.
      </p>

      <form onSubmit={handleLookup} className="mt-6 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="banding-code" className="sr-only">
          Kode banding
        </label>
        <input id="banding-code" value={code} onChange={(event) => setCode(event.target.value.slice(0, 40))} placeholder="RB-A1B2-C3D4-E5F6" autoComplete="off" spellCheck={false} className="h-11 w-full rounded-lg border border-border bg-white px-3.5 font-sans text-[15px] tracking-[0.06em] text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 sm:max-w-xs"/>
        <button type="submit" disabled={status === 'loading'} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-sans text-[13px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-70">
          {status === 'loading' ? (<Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none"/>) : null}
          Cek status
        </button>
      </form>

      {error && (<p role="alert" className="mt-4 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 font-sans text-[13px] leading-relaxed text-destructive">
          {error}
        </p>)}

      {status === 'not-found' && (<div className="mt-4 rounded-lg border border-warning/30 bg-warning/[0.08] px-4 py-3.5">
          <p className="font-sans text-[13px] leading-relaxed text-charcoal-700">
            Kode banding tidak ditemukan. Periksa kembali kode yang kamu simpan
            — kalau kode benar-benar hilang, kirim banding baru dari halaman
            banding; kode lama tidak dapat dikembalikan.
          </p>
          <Link href="/banding" className="mt-2 inline-block font-sans text-[13px] font-semibold text-primary underline underline-offset-4">
            Kirim banding baru
          </Link>
        </div>)}

      {status === 'ready' && appeal && meta && (<div className="mt-6 rounded-2xl border border-border bg-white">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {formatAppealCode(lookupCode ?? '')}
              </span>
              <Badge variant={meta.variant}>{meta.label}</Badge>
              <button type="button" onClick={() => lookupCode && void load(lookupCode)} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 font-sans text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                <RefreshCw aria-hidden className="h-3.5 w-3.5"/>
                Muat ulang
              </button>
            </div>
            <p className="mt-2 font-sans text-[13px] leading-relaxed text-charcoal-700">
              {meta.hint}
            </p>
            <p className="mt-1 font-sans text-xs text-muted-foreground">
              Dikirim {formatWaktu(appeal.createdAt)}
              {appeal.decidedAt ? ` · Diputuskan ${formatWaktu(appeal.decidedAt)}` : ''}
            </p>
          </div>

          {(appeal.status === 'rejected' || appeal.decisionNote) && (<div className="border-b border-border bg-secondary/60 px-5 py-3.5 sm:px-6">
              <p className="font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Catatan admin
              </p>
              <p className="mt-1 font-sans text-[14px] leading-relaxed text-charcoal-900">
                {appeal.decisionNote?.trim() || 'Admin tidak menuliskan catatan tambahan.'}
              </p>
            </div>)}

          <div className="px-5 py-4 sm:px-6">
            <p className="font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Percakapan banding
            </p>
            {messages.length === 0 ? (<p className="mt-2 font-sans text-[13px] text-muted-foreground">
                Belum ada pesan.
              </p>) : (<ul className="mt-3 flex flex-col gap-3">
                {messages.map((item) => {
                    const fromUser = item.senderKind === 'user';
                    const fromSystem = item.senderKind === 'system';
                    return (<li key={item.id} className={fromUser ? 'flex justify-end' : 'flex justify-start'}>
                      <div className={fromSystem
                            ? 'max-w-[85%] rounded-xl border border-dashed border-sage-500/50 bg-sage-100/60 px-3.5 py-2.5'
                            : fromUser
                                ? 'max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5'
                                : 'max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-secondary px-3.5 py-2.5'}>
                        <p className={fromUser
                            ? 'font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-white/70'
                            : 'font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground'}>
                          {supportSenderLabel(item.senderKind)}
                          {item.createdAt ? ` · ${formatWaktu(item.createdAt)}` : ''}
                        </p>
                        <p className={fromUser
                            ? 'mt-1 whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-white'
                            : 'mt-1 whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-charcoal-900'}>
                          {item.body}
                        </p>
                      </div>
                    </li>);
                })}
              </ul>)}

            <form onSubmit={handleFollowUp} className="mt-5 border-t border-border pt-4">
              <label htmlFor="banding-followup" className="flex items-center gap-1.5 font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                <MessageSquare aria-hidden className="h-3.5 w-3.5"/>
                Tambah keterangan
              </label>
              <textarea id="banding-followup" value={draft} onChange={(event) => setDraft(event.target.value.slice(0, SUPPORT_MESSAGE_MAX))} rows={3} maxLength={SUPPORT_MESSAGE_MAX} placeholder="Keterangan tambahan untuk admin…" className="mt-2 w-full rounded-lg border border-border bg-white px-3.5 py-3 font-sans text-[14px] leading-relaxed text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"/>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button type="submit" disabled={sending || !draft.trim()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60">
                  {sending ? (<Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"/>) : (<Send aria-hidden className="h-3.5 w-3.5"/>)}
                  {sending ? 'Mengirim…' : 'Kirim pesan'}
                </button>
                {sendNote && (<p role="status" className="font-sans text-[12px] leading-relaxed text-muted-foreground">
                    {sendNote}
                  </p>)}
              </div>
            </form>
          </div>
        </div>)}
    </div>);
}
