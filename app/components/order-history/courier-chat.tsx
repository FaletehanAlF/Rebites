'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, TriangleAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/auth-token';
import { cn } from '@/lib/utils';

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
  senderUserId: string;
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
      setMessages(json.messages ?? []);
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

    const channel = supabase
      .channel(`rebites-courier-messages-${orderDbId}`)
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
          messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex', message.isMine ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
                  message.isMine
                    ? 'bg-primary text-white'
                    : 'bg-cream-100 text-charcoal-900'
                )}
              >
                {message.body}
              </div>
            </div>
          ))
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
