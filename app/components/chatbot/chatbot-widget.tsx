'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bot, Check, Loader2, Send, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { getValidAuthHeader } from '@/lib/auth-token';
import type { ChatMessageView, PendingAction } from '@/lib/chatbot/types';
import { ChatMarkdown } from './chat-markdown';

/**
 * Panel asisten ReBites.
 *
 * Kenapa dimuat lewat `dynamic(..., { ssr: false })` di chatbot-mount.tsx:
 * widget menyentuh `sessionStorage` saat mount, dan server tidak memilikinya.
 * Merender di server akan menghasilkan markup awal yang berbeda dari klien
 * (hydration mismatch) — persis jenis galat yang sulit dilacak.
 *
 * Animasi hanya memakai transform + opacity. Panel ini sering dibuka-tutup
 * berulang saat pengguna membaca langkah demi langkah, jadi biayanya harus
 * nol setelah transisi selesai.
 */

const PANEL_EASE = [0.23, 1, 0.32, 1] as const;

const STORAGE_KEY = 'rebites-chatbot-transcript';

/** Saran pembuka berbeda per profil; admin butuh pintasan yang berbeda. */
const SUGGESTIONS_PUBLIC = [
  'Apa itu ReBites?',
  'Bagaimana cara memesan makanan?',
  'Bagaimana cara mulai berjualan?',
];

const SUGGESTIONS_MEMBER = [
  'Di mana tombol riwayat pesanan?',
  'Bagaimana cara mengunggah produk?',
  'Berapa harga paket langganan?',
];

const SUGGESTIONS_ADMIN = [
  'Bagaimana kondisi hari ini?',
  'Produk apa yang menunggu moderasi?',
  'Ada laporan yang belum ditangani?',
];

function suggestionsFor(isAdmin: boolean, loggedIn: boolean): string[] {
  if (isAdmin) return SUGGESTIONS_ADMIN;
  if (loggedIn) return SUGGESTIONS_MEMBER;
  return SUGGESTIONS_PUBLIC;
}

interface WireReply {
  reply?: string;
  profile?: 'publik' | 'anggota' | 'admin';
  pendingActions?: PendingAction[];
  toolsUnavailable?: boolean;
  sessionId?: string | null;
  blocked?: boolean;
  error?: string;
  retryAfterSeconds?: number;
}

export function ChatbotWidget() {
  const prefersReducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  // Pulihkan percakapan selama tab masih terbuka. Disimpan di sessionStorage,
  // bukan localStorage: riwayat permanen ada di database untuk pengguna login,
  // dan pengunjung anonim memang tidak disimpan (keputusan produk).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { messages?: ChatMessageView[]; sessionId?: string | null };
      if (Array.isArray(parsed.messages)) setMessages(parsed.messages.slice(-40));
      if (typeof parsed.sessionId === 'string') sessionIdRef.current = parsed.sessionId;
    } catch {
      // Penyimpanan tidak tersedia atau isinya rusak: mulai percakapan baru.
    }
  }, []);

  const persist = useCallback((next: ChatMessageView[], sessionId: string | null) => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ messages: next.slice(-40), sessionId })
      );
    } catch {
      // Penuh atau diblokir: percakapan tetap jalan di memori.
    }
  }, []);

  // Cek sesi sekali saat panel pertama kali dibuka, bukan saat halaman dimuat:
  // memeriksa sesi pada setiap halaman menambah satu query yang tidak dipakai
  // kalau pengguna tidak pernah membuka asisten.
  useEffect(() => {
    if (!open || wasOpenRef.current) return;
    wasOpenRef.current = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        setLoggedIn(Boolean(session));
        if (!session) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();
        setIsAdmin(profile?.role === 'admin');
      } catch {
        // Gagal membaca profil: tampilkan sebagai pengunjung biasa. Tidak
        // mungkin menaikkan hak karena server tetap memutuskan sendiri.
      }
    })();
  }, [open]);

  // Fokus pindah ke kolom input saat panel dibuka.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Escape menutup panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Gulir ke bawah hanya bila pengguna sudah berada di dasar daftar.
  // Tanpa syarat ini, jawaban baru akan merenggut posisi baca orang yang
  // sedang menelusuri pesan lama.
  const scrollToBottomIfNear = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < 120) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottomIfNear();
  }, [messages, sending, scrollToBottomIfNear]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setError(null);
      setSending(true);
      const nextMessages: ChatMessageView[] = [...messages, { role: 'user', content: trimmed }];
      setMessages(nextMessages);
      setDraft('');

      try {
        // Header hanya dikirim bila ada sesi. Untuk pengunjung anonim, request
        // tetap dikirim tanpa Authorization dan server memperlakukannya sebagai
        // profil publik.
        let authHeader: string | null = null;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          try {
            authHeader = await getValidAuthHeader();
          } catch {
            authHeader = null;
          }
        }

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify({
            message: trimmed,
            sessionId: sessionIdRef.current,
          }),
        });

        const json = (await res.json().catch(() => null)) as WireReply | null;

        if (!res.ok) {
          const retry = json?.retryAfterSeconds;
          setError(
            json?.error ??
              `Asisten tidak dapat dihubungi (${res.status}).${retry ? ` Coba lagi dalam ${retry} detik.` : ''}`
          );
          setMessages(nextMessages);
          return;
        }

        if (json?.profile === 'admin') setIsAdmin(true);
        if (typeof json?.sessionId === 'string') sessionIdRef.current = json.sessionId;

        const withReply: ChatMessageView[] = [
          ...nextMessages,
          {
            role: 'assistant',
            content: json?.reply ?? 'Maaf, saya belum bisa menjawab itu.',
            pendingActions: json?.pendingActions,
            blocked: json?.blocked,
          },
        ];
        setMessages(withReply);
        persist(withReply, sessionIdRef.current);

        if (json?.toolsUnavailable) {
          setError(
            'Asisten sedang berjalan tanpa akses data, jadi jawabannya tidak memakai angka terbaru.'
          );
        }
      } catch {
        setError('Tidak dapat menghubungi asisten. Periksa koneksi lalu coba lagi.');
      } finally {
        setSending(false);
      }
    },
    [messages, persist, sending]
  );

  /**
   * Jalankan usulan aksi setelah admin menekan konfirmasi.
   * Token dikirim apa adanya; server memverifikasi ulang tanda tangan, masa
   * berlaku, dan peran admin. Klien tidak pernah dipercaya soal isi aksi.
   */
  const confirmAction = useCallback(
    async (action: PendingAction) => {
      setBusyAction(action.token);
      setError(null);
      try {
        const authHeader = await getValidAuthHeader();
        const res = await fetch('/api/chat/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: JSON.stringify({ token: action.token }),
        });
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; message?: string; error?: string }
          | null;

        const outcome: ChatMessageView = {
          role: 'assistant',
          content: res.ok
            ? json?.message ?? 'Aksi dijalankan.'
            : json?.error ?? 'Aksi gagal dijalankan.',
        };

        // Kartu konfirmasi diganti hasil, agar tidak bisa ditekan dua kali.
        setMessages((current) => {
          const updated = current.map((message) => ({
            ...message,
            pendingActions: message.pendingActions?.filter(
              (item) => item.token !== action.token
            ),
          }));
          const next = [...updated, outcome];
          persist(next, sessionIdRef.current);
          return next;
        });
      } catch {
        setError('Aksi tidak dapat dijalankan. Coba lagi.');
      } finally {
        setBusyAction(null);
      }
    },
    [persist]
  );

  const suggestions = suggestionsFor(isAdmin, loggedIn);

  return (
    <>
      {/* Tombol bulat. `bottom-20` di ponsel agar tidak menutupi bottom nav
          yang menempel di dasar layar. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Tutup asisten ReBites' : 'Buka asisten ReBites'}
        aria-expanded={open}
        className={cn(
          'fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center lg:bottom-6 lg:right-6',
          'rounded-full bg-primary text-primary-foreground shadow-admin-pop',
          'transition-transform duration-150 hover:scale-105 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
        )}
      >
        {open ? <X className="h-6 w-6" aria-hidden /> : <Bot className="h-6 w-6" aria-hidden />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Asisten ReBites"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.24, ease: PANEL_EASE }}
            className={cn(
              'fixed bottom-36 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-[400px] flex-col',
              'h-[70vh] max-h-[560px] overflow-hidden rounded-2xl border border-border bg-white shadow-admin-pop',
              'lg:bottom-24 lg:right-6'
            )}
          >
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">Asisten ReBites</p>
                <p className="text-[11px] text-muted-foreground">
                  {isAdmin ? 'Mode admin — bisa membaca data' : 'Panduan memakai ReBites'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup asisten"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] text-muted-foreground">
                    Halo! Saya bisa menjelaskan cara memakai ReBites, letak menu, sampai paket
                    langganan. Mau mulai dari mana?
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => void send(item)}
                        className="rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div aria-live="polite" className="space-y-3">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className="space-y-2">
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed',
                        message.role === 'user'
                          ? 'ml-auto whitespace-pre-wrap bg-primary text-primary-foreground'
                          : message.blocked
                            ? 'border border-border bg-muted text-foreground'
                            : 'bg-secondary text-foreground'
                      )}
                    >
                      {message.role === 'user' ? (
                        message.content
                      ) : (
                        <ChatMarkdown text={message.content} />
                      )}
                    </div>

                    {message.pendingActions?.map((action) => (
                      <div
                        key={action.token}
                        className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12px]"
                      >
                        <p className="flex items-center gap-1.5 font-semibold text-amber-900">
                          <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                          {action.label} — menunggu konfirmasi
                        </p>
                        <p className="mt-1 text-amber-900/80">{action.summary}</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={busyAction === action.token}
                            onClick={() => void confirmAction(action)}
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-60"
                          >
                            {busyAction === action.token ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            ) : (
                              <Check className="h-3 w-3" aria-hidden />
                            )}
                            Setujui
                          </button>
                          <button
                            type="button"
                            disabled={busyAction === action.token}
                            onClick={() =>
                              setMessages((current) =>
                                current.map((item) => ({
                                  ...item,
                                  pendingActions: item.pendingActions?.filter(
                                    (candidate) => candidate.token !== action.token
                                  ),
                                }))
                              )
                            }
                            className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-foreground disabled:opacity-60"
                          >
                            Batalkan
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {sending && (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Asisten sedang menulis…
                  </div>
                )}
              </div>
            </div>

            {error && (
              <p className="mx-3 mb-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
                {error}
              </p>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(draft);
              }}
              className="flex items-end gap-2 border-t border-border p-3"
            >
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Tanya soal ReBites…"
                className="max-h-24 min-h-9 flex-1 resize-none rounded-xl border border-border px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="Kirim pesan"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ChatbotWidget;
