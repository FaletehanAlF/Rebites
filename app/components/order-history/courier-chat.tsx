'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, TriangleAlert, Info, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/auth-token';
import { cn } from '@/lib/utils';
import {
  courierSenderLabel,
  normalizeCourierSenderKind,
} from '@/lib/courier-sender-kind';

/**
 * Penomoran langganan kanal.
 *
 * `supabase.channel(topic)` mengembalikan kanal yang topiknya sama bila masih
 * terdaftar, dan `.on()` pada kanal yang sudah `subscribe()` melempar
 * "cannot add `postgres_changes` callbacks ... after `subscribe()`". Chat ini
 * dipasang di halaman detail pesanan yang juga memasang hook posisi kurir;
 * topik berbasis order id saja membuat pemasangan kedua (dan pemasangan ulang
 * StrictMode sebelum `removeChannel` selesai) bertabrakan. Nomor unik per
 * langganan memisahkannya.
 */
let channelCounter = 0;

/**
 * Percakapan pembeli <-> kurir untuk satu pesanan.
 *
 * YANG BOLEH BERBICARA
 * - Pembeli pesanan itu, dan kurir yang DITUGASKAN pada pesanan itu.
 * - Penjual boleh MEMBACA (memantau), tapi tidak boleh menulis: dia bukan
 *   pihak yang mengantar. `canSend` menentukan tombol kirim.
 *
 * SUMBER DATA
 * - Tabel `courier_messages`, dibaca lewat Realtime Postgres Changes.
 *   RLS menentukan siapa yang menerima baris.
 * - Polling 10 detik sebagai fallback bila Realtime terputus.
 *
 * KEJUJURAN
 * - Pesan yang gagal terkirim TIDAK boleh hilang dari layar. Yang gagal
 *   ditandai dan bisa dikirim ulang.
 * - Tidak ada timestamp karangan: waktu pesan berasal dari server.
 */
export interface CourierMessage {
  id: string;
  senderUserId: string | null;
  /** `demo_courier` = Kurir Demo; `ai_courier` = Kurir AI (Gemini); keduanya balasan otomatis. */
  senderKind?: 'user' | 'demo_courier' | 'ai_courier';
  body: string;
  createdAt: string | null;
  isMine: boolean;
}

export function CourierChat({
  orderDbId,
  canSend = true,
  className,
}: {
  /** UUID baris `orders.id`. */
  orderDbId: string | null | undefined;
  /** Penjual membaca saja: `false` menyembunyikan kolom kirim. */
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

  const refresh = useCallback(async () => {
    if (!orderDbId) return;
    try {
      const res = await fetchWithAuth(
        `/api/courier/messages?orderId=${encodeURIComponent(orderDbId)}`
      );
      if (!res.ok) {
        setError('Gagal memuat pesan.');
        return;
      }
      const json = (await res.json()) as { messages?: CourierMessage[] };
      setMessages(
        (json.messages ?? []).map((message) => ({
          ...message,
          senderKind: normalizeCourierSenderKind(message.senderKind),
        }))
      );
      setError(null);
    } catch {
      setError('Gagal memuat pesan.');
    } finally {
      setLoading(false);
    }
  }, [orderDbId]);

  useEffect(() => {
    if (!orderDbId) return;
    setLoading(true);
    void refresh();

    channelCounter += 1;
    const channel = supabase
      .channel(`rebites-courier-messages-${orderDbId}-${channelCounter}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'courier_messages',
          filter: `order_id=eq.${orderDbId}`,
        },
        () => {
          void refresh();
        }
      )
      .subscribe();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 10_000);

    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(intervalId);
    };
  }, [orderDbId, refresh]);

  // Gulir ke pesan terbaru whenever ada pesan baru.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || !orderDbId || sending) return;
    setSending(true);
    try {
      const res = await fetchWithAuth('/api/courier/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderDbId, message: body }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(json?.error ?? 'Gagal mengirim pesan.');
        return;
      }
      const okJson = (await res
        .json()
        .catch(() => null)) as {
          aiReply?: { status?: string; message?: string };
        } | null;
      const aiStatus = okJson?.aiReply?.status;
      if (aiStatus === 'fallback') {
        setAiNotice(
          okJson?.aiReply?.message ??
            'Kurir AI tidak tersedia; pesanmu dijawab Kurir Demo.'
        );
      } else if (aiStatus === 'failed') {
        setAiNotice(
          okJson?.aiReply?.message ??
            'Pesanmu terkirim, tapi Kurir AI belum bisa menjawab. Coba lagi sebentar.'
        );
      } else {
        // sent / already_answered: tidak ada pemberitahuan.
        setAiNotice(null);
      }
      setDraft('');
      setError(null);
      await refresh();
    } catch {
      setError('Gagal mengirim pesan.');
    } finally {
      setSending(false);
    }
  }, [draft, orderDbId, sending, refresh]);

  if (!orderDbId) return null;

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-hairline bg-white',
        className
      )}
    >
      <div className="border-b border-hairline px-4 py-3">
        <p className="text-sm font-semibold text-charcoal-900">Chat dengan Kurir</p>
        <p className="mt-0.5 text-[11px] text-charcoal-500">
          Gunakan chat ini untuk koordinasi titik antar atau kendala di jalan.
        </p>
      </div>

      <div
        ref={listRef}
        className="min-h-[120px] max-h-[280px] flex-1 space-y-2 overflow-y-auto px-4 py-3"
        aria-live="polite"
        aria-busy={loading}
      >
        {loading && messages.length === 0 ? (
          <p className="text-center text-xs text-charcoal-500">Memuat pesan…</p>
        ) : messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-charcoal-500">
            Belum ada pesan. Kirim pesan pertama bila perlu menghubungi kurir.
          </p>
        ) : (
          messages.map((message) => {
            const kind = normalizeCourierSenderKind(message.senderKind);
            const automatedBubble =
              kind === 'ai_courier'
                ? 'bg-cream-100 text-charcoal-900 ring-1 ring-dashed ring-primary/50'
                : kind === 'demo_courier'
                  ? 'bg-cream-100 text-charcoal-900 ring-1 ring-dashed ring-sage-500/40'
                  : 'bg-cream-100 text-charcoal-900';
            return (
              <div
                key={message.id}
                className={cn('flex flex-col', message.isMine ? 'items-end' : 'items-start')}
              >
                {!message.isMine && (
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sage-500">
                    {courierSenderLabel(kind)}
                  </p>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
                    message.isMine ? 'bg-primary text-white' : automatedBubble
                  )}
                >
                  {message.body}
                </div>
                {/* Jam pesan: berasal dari server, bukan dari jam perangkat
                    pengirim — supaya kedua pihak melihat waktu yang sama. */}
                {message.createdAt && (
                  <p className="mt-0.5 text-[10px] tabular-nums text-charcoal-500">
                    {new Date(message.createdAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 border-t border-hairline bg-cream-50 px-4 py-2"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-caramel-dark" aria-hidden />
          <p className="text-[11px] leading-relaxed text-charcoal-600">{error}</p>
        </div>
      )}

      {aiNotice && (
        <div
          role="status"
          className="flex items-start gap-2 border-t border-hairline bg-cream-50 px-4 py-2"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-charcoal-500" aria-hidden />
          <p className="flex-1 text-[11px] leading-relaxed text-charcoal-600">{aiNotice}</p>
          <button
            type="button"
            onClick={() => setAiNotice(null)}
            aria-label="Tutup pemberitahuan"
            className="text-charcoal-500 transition-colors hover:text-charcoal-900"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {sending && (
        <p
          role="status"
          className="border-t border-hairline bg-cream-50 px-4 py-1.5 text-[11px] text-charcoal-500"
        >
          Mengirim… bila pesanan ini demo, Kurir AI sedang menjawab.
        </p>
      )}

      {canSend ? (
        <div className="flex items-end gap-2 border-t border-hairline px-3 py-2.5">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter mengirim; Shift+Enter membuat baris baru.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="Tulis pesan untuk kurir…"
            aria-label="Pesan untuk kurir"
            className="min-h-[40px] flex-1 resize-none rounded-xl border border-hairline bg-cream-50 px-3 py-2 text-[13px] leading-relaxed text-charcoal-900 outline-none transition-colors placeholder:text-charcoal-500 focus:border-primary focus:bg-white"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !draft.trim()}
            aria-label="Kirim pesan"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-caramel disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : (
        <p className="border-t border-hairline bg-cream-50 px-4 py-2 text-[11px] text-charcoal-500">
          Mode pantau: kamu bisa membaca percakapan, tapi tidak bisa mengirim pesan.
        </p>
      )}
    </div>
  );
}
