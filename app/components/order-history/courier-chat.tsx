'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bike, Bot, EyeOff, Info, Loader2, MessageSquare, RotateCcw, Send, Sparkles, TriangleAlert, X, } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/auth-token';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/app/components/ui/skeleton';
import { courierSenderLabel, normalizeCourierSenderKind, } from '@/lib/courier-sender-kind';
let channelCounter = 0;
type CourierKind = 'user' | 'demo_courier' | 'ai_courier';
function isAutomatedKind(kind: CourierKind): boolean {
    return kind === 'ai_courier' || kind === 'demo_courier';
}
function bubbleClasses(isMine: boolean, kind: CourierKind): string {
    if (isMine) {
        return 'rounded-2xl rounded-br-md bg-primary text-white';
    }
    if (kind === 'ai_courier') {
        return 'rounded-2xl rounded-bl-md border border-dashed border-sage-500/60 bg-sage-100/70 text-charcoal-900';
    }
    if (kind === 'demo_courier') {
        return 'rounded-2xl rounded-bl-md border border-dashed border-caramel/60 bg-cream-100 text-charcoal-900';
    }
    return 'rounded-2xl rounded-bl-md border border-hairline bg-white text-charcoal-900';
}
function senderBadge(kind: CourierKind): {
    title: string;
    className: string;
} {
    if (kind === 'ai_courier') {
        return {
            title: courierSenderLabel(kind),
            className: 'bg-sage-500 text-white',
        };
    }
    if (kind === 'demo_courier') {
        return {
            title: courierSenderLabel(kind),
            className: 'bg-cream-200 text-charcoal-900',
        };
    }
    return {
        title: courierSenderLabel(kind),
        className: 'bg-green-50 text-green-700',
    };
}
export interface CourierMessage {
    id: string;
    senderUserId: string | null;
    senderKind?: 'user' | 'demo_courier' | 'ai_courier';
    body: string;
    createdAt: string | null;
    isMine: boolean;
}
export function CourierChat({ orderDbId, canSend = true, className, }: {
    orderDbId: string | null | undefined;
    canSend?: boolean;
    className?: string;
}) {
    const [messages, setMessages] = useState<CourierMessage[]>([]);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [aiNotice, setAiNotice] = useState<string | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const refresh = useCallback(async () => {
        if (!orderDbId)
            return;
        try {
            const res = await fetchWithAuth(`/api/courier/messages?orderId=${encodeURIComponent(orderDbId)}`);
            if (!res.ok) {
                setError('Gagal memuat pesan.');
                return;
            }
            const json = (await res.json()) as {
                messages?: CourierMessage[];
            };
            setMessages((json.messages ?? []).map((message) => ({
                ...message,
                senderKind: normalizeCourierSenderKind(message.senderKind),
            })));
            setError(null);
        }
        catch {
            setError('Gagal memuat pesan.');
        }
        finally {
            setLoading(false);
        }
    }, [orderDbId]);
    useEffect(() => {
        if (!orderDbId)
            return;
        setLoading(true);
        void refresh();
        channelCounter += 1;
        const channel = supabase
            .channel(`rebites-courier-messages-${orderDbId}-${channelCounter}`)
            .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'courier_messages',
            filter: `order_id=eq.${orderDbId}`,
        }, () => {
            void refresh();
        })
            .subscribe();
        const intervalId = window.setInterval(() => {
            void refresh();
        }, 10000);
        return () => {
            void supabase.removeChannel(channel);
            window.clearInterval(intervalId);
        };
    }, [orderDbId, refresh]);
    useEffect(() => {
        const el = listRef.current;
        if (el) {
            el.scrollTo({ top: el.scrollHeight });
        }
    }, [messages.length, sending]);
    const autosizeInput = useCallback(() => {
        const el = inputRef.current;
        if (!el)
            return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }, []);
    useEffect(() => {
        autosizeInput();
    }, [draft, autosizeInput]);
    const hasAutomatedReplies = messages.some((m) => isAutomatedKind(m.senderKind as CourierKind));
    const latestAutomatedKind = [...messages].reverse().find((m) => isAutomatedKind(m.senderKind as CourierKind))
        ?.senderKind ?? null;
    const autoReplyTitle = latestAutomatedKind === 'demo_courier'
        ? 'Kurir Demo'
        : 'Kurir AI';
    const send = useCallback(async () => {
        const body = draft.trim();
        if (!body || !orderDbId || sending)
            return;
        setSending(true);
        try {
            const res = await fetchWithAuth('/api/courier/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: orderDbId, message: body }),
            });
            if (!res.ok) {
                const json = (await res.json().catch(() => null)) as {
                    error?: string;
                } | null;
                setError(json?.error ?? 'Gagal mengirim pesan.');
                return;
            }
            const okJson = (await res
                .json()
                .catch(() => null)) as {
                aiReply?: {
                    status?: string;
                    message?: string;
                };
            } | null;
            const aiStatus = okJson?.aiReply?.status;
            if (aiStatus === 'fallback') {
                setAiNotice(okJson?.aiReply?.message ??
                    'Kurir AI tidak tersedia; pesanmu dijawab Kurir Demo.');
            }
            else if (aiStatus === 'failed') {
                setAiNotice(okJson?.aiReply?.message ??
                    'Pesanmu terkirim, tapi Kurir AI belum bisa menjawab. Coba lagi sebentar.');
            }
            else {
                setAiNotice(null);
            }
            setDraft('');
            setError(null);
            await refresh();
        }
        catch {
            setError('Gagal mengirim pesan.');
        }
        finally {
            setSending(false);
        }
    }, [draft, orderDbId, sending, refresh]);
    if (!orderDbId)
        return null;
    return (<div className={cn('flex flex-col overflow-hidden rounded-2xl border border-hairline bg-white', className)}>
      
      
      
      <div className="flex items-start gap-3 border-b border-hairline px-4 py-3">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
          <Bike className="h-5 w-5"/>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-charcoal-900">Chat dengan Kurir</p>
            {hasAutomatedReplies && (<span title="Pesanan ini memakai kurir simulasi untuk pengujian alur" className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                <Sparkles className="h-3 w-3" aria-hidden/>
                {autoReplyTitle} aktif
              </span>)}
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-charcoal-500">
            Gunakan chat ini untuk koordinasi titik antar atau kendala di jalan.
          </p>
        </div>
      </div>

      
      
      
      <div ref={listRef} role="log" aria-live="polite" aria-busy={loading} className="min-h-[140px] max-h-[340px] flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {loading && messages.length === 0 ? (<div className="space-y-3" role="status" aria-label="Memuat pesan">
            
            {[0, 1, 2].map((i) => (<div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
                <Skeleton className={cn('h-9 rounded-2xl', i === 1 ? 'w-40' : 'w-52')}/>
              </div>))}
          </div>) : messages.length === 0 ? (<div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-100 text-charcoal-500">
              <MessageSquare className="h-4 w-4"/>
            </span>
            <p className="text-xs font-semibold text-charcoal-900">Belum ada pesan</p>
            <p className="max-w-[26ch] text-[11px] leading-relaxed text-charcoal-500">
              Kirim pesan pertama untuk koordinasi titik antar atau kendala pengantaran.
            </p>
          </div>) : (messages.map((message, index) => {
            const kind = normalizeCourierSenderKind(message.senderKind) as CourierKind;
            const prev = index > 0 ? messages[index - 1] : null;
            const sameSenderAsPrev = prev !== null && prev.isMine === message.isMine &&
                normalizeCourierSenderKind(prev.senderKind) === kind;
            const showIdentity = !sameSenderAsPrev;
            const badge = senderBadge(kind);
            const badgeIcon = kind === 'ai_courier' ? (<Sparkles className="h-3.5 w-3.5" aria-hidden/>) : kind === 'demo_courier' ? (<Bot className="h-3.5 w-3.5" aria-hidden/>) : (<Bike className="h-3.5 w-3.5" aria-hidden/>);
            return (<div key={message.id} className={cn('flex flex-col', showIdentity ? 'mt-3.5 first:mt-0' : 'mt-1.5', message.isMine ? 'items-end' : 'items-start')}>
                {!message.isMine && showIdentity && (<div className="mb-1 flex items-center gap-1.5 pl-9">
                    <span aria-hidden className={cn('flex h-5 w-5 items-center justify-center rounded-full', badge.className)}>
                      {badgeIcon}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-charcoal-600">
                      {badge.title}
                    </span>
                    {message.createdAt && (<span className="text-[10px] tabular-nums text-charcoal-500" aria-hidden>
                        ·{' '}
                        {new Date(message.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                      </span>)}
                  </div>)}
                
                <div className="flex items-end gap-2">
                  {message.isMine && message.createdAt && (<span className="text-[10px] tabular-nums text-charcoal-500" aria-hidden>
                      {new Date(message.createdAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                    </span>)}
                  <div className={cn('max-w-[85%] whitespace-pre-wrap break-words px-3.5 py-2 text-[13px] leading-relaxed sm:max-w-[75%]', bubbleClasses(message.isMine, kind))}>
                    {message.body}
                  </div>
                  {!message.isMine && showIdentity && (<span aria-hidden className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', badge.className)}>
                      {badgeIcon}
                    </span>)}
                </div>
              </div>);
        }))}

        
        {sending && hasAutomatedReplies && (<div className="mt-3 flex items-center gap-2" role="status">
            <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage-500 text-white">
              <Sparkles className="h-3.5 w-3.5"/>
            </span>
            <div className="rounded-2xl rounded-bl-md border border-dashed border-sage-500/60 bg-sage-100/70 px-3.5 py-2.5">
              <span className="flex items-center gap-1" aria-hidden>
                {[0, 150, 300].map((delay) => (<span key={delay} style={{ animationDelay: `${delay}ms` }} className="h-1.5 w-1.5 animate-bounce rounded-full bg-sage-500"/>))}
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold text-green-700">
                {autoReplyTitle} sedang menyusun balasan…
              </span>
            </div>
          </div>)}
      </div>

      
      
      
      {error && (<div role="alert" className="flex items-start gap-2 border-t border-hairline bg-cream-50 px-3 py-2 sm:px-4">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-caramel-dark" aria-hidden/>
          <p className="flex-1 text-[11px] leading-relaxed text-charcoal-600">{error}</p>
          <button type="button" onClick={() => {
                void refresh();
            }} aria-label="Coba muat ulang" className="rounded-md p-0.5 text-charcoal-500 transition-colors hover:bg-cream-200 hover:text-charcoal-900">
            <RotateCcw className="h-4 w-4" aria-hidden/>
          </button>
        </div>)}

      {aiNotice && (<div role="status" className="flex items-start gap-2 border-t border-hairline bg-gold-100/50 px-3 py-2 sm:px-4">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-caramel-dark" aria-hidden/>
          <p className="flex-1 text-[11px] leading-relaxed text-charcoal-600">
            <span className="font-semibold text-charcoal-900">Status balasan otomatis: </span>
            {aiNotice}
          </p>
          <button type="button" onClick={() => setAiNotice(null)} aria-label="Tutup pemberitahuan" className="rounded-md p-0.5 text-charcoal-500 transition-colors hover:bg-gold-100 hover:text-charcoal-900">
            <X className="h-4 w-4" aria-hidden/>
          </button>
        </div>)}

      
      {sending && !hasAutomatedReplies && (<p role="status" className="flex items-center gap-1.5 border-t border-hairline bg-cream-50 px-3 py-1.5 text-[11px] text-charcoal-500 sm:px-4">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden/>
          Mengirim pesan…
        </p>)}

      
      
      
      {canSend ? (<div className="border-t border-hairline px-3 py-2.5 sm:px-4">
          <div className="flex items-end gap-2">
            <textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send();
                }
            }} rows={1} maxLength={1000} placeholder="Tulis pesan untuk kurir…" aria-label="Pesan untuk kurir" className="min-h-[44px] w-full flex-1 resize-none rounded-2xl border border-hairline bg-cream-50 px-3.5 py-2.5 text-base leading-relaxed text-charcoal-900 outline-none transition-colors placeholder:text-charcoal-500 focus:border-primary focus:bg-white sm:text-[13px]"/>
            <button type="button" onClick={() => void send()} disabled={sending || !draft.trim()} aria-label={sending ? 'Mengirim pesan…' : 'Kirim pesan'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40">
              {sending ? (<Loader2 className="h-4 w-4 animate-spin" aria-hidden/>) : (<Send className="h-4 w-4" aria-hidden/>)}
            </button>
          </div>
          <p className="mt-1.5 hidden text-right text-[10px] text-charcoal-500 sm:block">
            Enter mengirim · Shift+Enter baris baru
          </p>
        </div>) : (<p className="flex items-center gap-2 border-t border-hairline bg-cream-50 px-4 py-2.5 text-[11px] leading-relaxed text-charcoal-500">
          <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden/>
          Mode pantau: kamu bisa membaca percakapan, tapi tidak bisa mengirim pesan.
        </p>)}
    </div>);
}
