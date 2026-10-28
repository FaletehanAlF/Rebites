'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, BellRing, CheckCheck, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchActivityLogs } from '@/lib/admin-activity-logs';
import { fetchAuditLogs } from '@/lib/admin-audit-logs';
import { useAdminRealtimeActivity } from '@/hooks/use-admin-realtime-activity';
import {
  ADMIN_NOTIF_EVENT,
  ADMIN_NOTIF_LAST_SEEN_KEY,
  ADMIN_NOTIF_READ_IDS_KEY,
} from '@/lib/admin-preferences';
import {
  labelAktivitas,
  labelAudit,
  samarkanEmail,
  waktuLalu,
} from './admin-format';
import { cn } from '@/lib/utils';

/**
 * Notifikasi aktivitas admin.
 *
 * Sumber data nyata: baris terbaru tabel `activity_logs` dan `audit_logs`
 * lewat endpoint admin. Tidak ada data buatan di sini. Realtime hanya
 * memberi sinyal "ada perubahan" (lihat use-admin-realtime-activity),
 * isi lonceng sendiri tetap di-fetch ulang dari server agar tidak
 * menampilkan data yang tidak diizinkan RLS.
 *
 * Status dibaca disimpan di localStorage perangkat, karena belum ada
 * kolom unread di backend.
 *
 * NOTIF-1: feed dimuat SAAT MOUNT, bukan hanya saat ikon diklik. Sebelumnya
 * `items` kosong sampai `handleToggle` memanggil `load()`, sehingga
 * `unreadCount` (= items.filter(isUnread).length) selalu 0 pada render awal —
 * badge baru muncul setelah klik pertama. Klik tetap berfungsi sebagai
 * pemuatan manual, tetapi bukan lagi satu-satunya pemicu.
 */

// Kunci dan event status baca dibagi dengan halaman Pengaturan agar
// tidak ada dua definisi kunci yang bisa menyimpang.
const LAST_SEEN_KEY = ADMIN_NOTIF_LAST_SEEN_KEY;
const READ_IDS_KEY = ADMIN_NOTIF_READ_IDS_KEY;
const MAX_READ_IDS = 200;
const FEED_LIMIT = 10;

interface FeedItem {
  key: string;
  kind: 'activity' | 'audit';
  title: string;
  summary: string | null;
  href: string;
  createdAt: string;
}

/**
 * Tautan tujuan untuk satu entri aktivitas.
 *
 * Urutan prioritas: target spesifik (produk/pesanan/akun) → halaman rekap.
 * Tanpa ini semua entri hanya mendarat di daftar generik, sehingga admin
 * masih harus mencari ulang objeknya di tabel.
 *
 * activity_logs.target_id untuk produk = products.id (uuid), sedangkan untuk
 * pesanan = orders.id. Halaman admin/produk membuka drawer dari id itu;
 * halaman pesanan mencari lewat order_code yang disimpan di metadata.
 */
function activityHrefFor(log: {
  targetType: string | null;
  targetId: string | null;
  userId: string | null;
  metadata: Record<string, unknown>;
}): string {
  const { targetType, targetId, userId, metadata } = log;

  if (targetType === 'product' && targetId) {
    return `/dashboard/admin/produk?produk=${encodeURIComponent(targetId)}`;
  }
  if ((targetType === 'order' || targetType === 'orders') && targetId) {
    const code =
      typeof metadata.order_code === 'string' ? metadata.order_code.trim() : '';
    return code
      ? `/dashboard/admin/pesanan?kode=${encodeURIComponent(code)}`
      : '/dashboard/admin/pesanan';
  }
  if (
    (targetType === 'store' || targetType === 'stores' || targetType === 'umkm') &&
    targetId
  ) {
    return `/dashboard/admin/umkm/${encodeURIComponent(targetId)}`;
  }
  // Login, pendaftaran, dan aktivitas tanpa target: akun pelaku adalah
  // konteks paling berguna.
  if (userId) {
    return `/dashboard/admin/pengguna/${encodeURIComponent(userId)}`;
  }
  return '/dashboard/admin/monitoring/aktivitas';
}

function readStoredIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(READ_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function readLastSeen(): string | null {
  try {
    return window.localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [hasNewEvent, setHasNewEvent] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const { newCount, reset } = useAdminRealtimeActivity(true);

  // Muat status baca saat mount, dan muat ulang ketika halaman Pengaturan
  // mengubahnya (tandai semua sudah dibaca / atur ulang) atau tab lain
  // mengubahnya, supaya badge tidak menampilkan angka basi.
  useEffect(() => {
    const sync = () => {
      setReadIds(readStoredIds());
      setLastSeen(readLastSeen());
    };
    sync();
    window.addEventListener(ADMIN_NOTIF_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(ADMIN_NOTIF_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (newCount > 0) setHasNewEvent(true);
  }, [newCount]);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const [activity, audit] = await Promise.all([
        fetchActivityLogs(FEED_LIMIT, 0),
        fetchAuditLogs(FEED_LIMIT, 0),
      ]);
      const merged: FeedItem[] = [
        ...activity.logs.map((log) => ({
          key: `activity:${log.id}`,
          kind: 'activity' as const,
          title: labelAktivitas(log.activityType),
          summary: log.description ? samarkanEmail(log.description) : null,
          href: activityHrefFor(log),
          createdAt: log.createdAt,
        })),
        ...audit.logs.map((log) => ({
          key: `audit:${log.id}`,
          kind: 'audit' as const,
          title: labelAudit(log.action),
          summary: log.reason ? samarkanEmail(log.reason) : null,
          href: '/dashboard/admin/monitoring/audit',
          createdAt: log.createdAt,
        })),
      ];
      merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setItems(merged.slice(0, 12));
      setStatus('ready');
      setHasNewEvent(false);
      reset();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat notifikasi.');
      setStatus('error');
    }
  }, [reset]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && (status === 'idle' || hasNewEvent)) void load();
  };

  // NOTIF-1: muat feed pertama kali tanpa interaksi. Ini yang mengisi
  // `items` sehingga badge unread bisa dihitung pada render awal.
  useEffect(() => {
    if (status === 'idle') void load();
  }, [status, load]);

  // NOTIF-1: sinkronkan saat ada aktivitas baru. Realtime di
  // useAdminRealtimeActivity hanya menaikkan `newCount`; isi feed tetap
  // diambil dari server (RLS tetap berlaku).
  //
  // `hasNewEvent` di-set di sini, BUKAN di effect terpisah: sebelumnya ada
  // dua effect yang sama-sama bereaksi pada `newCount` sehingga satu event
  // realtime memicu `load()` dua kali (4 permintaan API: activity + audit
  // dua kali) dan keduanya berlomba menulis `setStatus`/`setItems`.
  useEffect(() => {
    if (newCount > 0) {
      setHasNewEvent(true);
      void load();
    }
  }, [newCount, load]);

  // NOTIF-1: sinkronkan saat tab kembali aktif (mis. setelah tidur/background),
  // karena event realtime bisa terlewat saat koneksi terputus.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const isUnread = useCallback(
    (item: FeedItem) => {
      if (readIds.has(item.key)) return false;
      if (!lastSeen) return true;
      return item.createdAt > lastSeen;
    },
    [readIds, lastSeen]
  );

  const unreadCount = items.filter(isUnread).length;

  const persistReadIds = (next: Set<string>) => {
    setReadIds(next);
    try {
      window.localStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(next).slice(-MAX_READ_IDS)));
    } catch {}
  };

  const markAllRead = () => {
    const now = new Date().toISOString();
    try {
      window.localStorage.setItem(LAST_SEEN_KEY, now);
    } catch {}
    setLastSeen(now);
    persistReadIds(new Set());
  };

  const markOneRead = (key: string) => {
    const next = new Set(readIds);
    next.add(key);
    persistReadIds(next);
  };

  return (
    <div className="relative shrink-0" ref={boxRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-charcoal-900 transition-colors hover:bg-sage-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {unreadCount > 0 ? (
          <BellRing aria-hidden className="h-5 w-5" />
        ) : (
          <Bell aria-hidden className="h-5 w-5" />
        )}
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifikasi aktivitas"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius)] border border-border bg-white shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-charcoal-900">
                Notifikasi aktivitas
              </h2>
              <button
                type="button"
                onClick={() => void load()}
                disabled={status === 'loading'}
                className="flex items-center gap-1.5 rounded-[var(--radius)] px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-sage-100/50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {status === 'loading' ? (
                  <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <RefreshCw aria-hidden className="h-3.5 w-3.5" />
                )}
                Muat ulang
              </button>
            </div>
            <p className="mt-0.5 text-xs text-sage-500">
              10 aktivitas dan 10 tindakan admin terbaru.
            </p>
          </div>

          {hasNewEvent && status === 'ready' && (
            <button
              type="button"
              onClick={() => void load()}
              className="block w-full border-b border-border bg-primary/[0.06] px-4 py-2 text-center text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
            >
              Ada aktivitas baru — ketuk untuk memuat
            </button>
          )}

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {status === 'loading' && (
              <div className="space-y-3 px-4 py-4" aria-label="Memuat notifikasi">
                {[0, 1, 2].map((i) => (
                  <div key={i} aria-hidden className="flex gap-2.5">
                    <div className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-sage-100 motion-reduce:animate-none" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-2/3 animate-pulse rounded bg-sage-100 motion-reduce:animate-none" />
                      <div className="h-3 w-1/3 animate-pulse rounded bg-sage-100 motion-reduce:animate-none" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center px-6 py-8 text-center">
                <p className="font-display text-sm font-semibold text-charcoal-900">
                  Gagal memuat notifikasi
                </p>
                <p className="mt-1 break-words text-xs text-sage-500">{errorMsg}</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="mt-3 rounded-[var(--radius)] bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {status === 'ready' && items.length === 0 && (
              <div className="flex flex-col items-center px-6 py-8 text-center">
                <Bell aria-hidden className="h-7 w-7 text-sage-500" />
                <p className="mt-2 font-display text-sm font-semibold text-charcoal-900">
                  Belum ada aktivitas
                </p>
                <p className="mt-1 text-xs text-sage-500">
                  Aktivitas produk dan tindakan admin yang tercatat akan muncul di sini.
                </p>
              </div>
            )}

            {status === 'ready' && items.length > 0 && (
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const unread = isUnread(item);
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        onClick={() => {
                          markOneRead(item.key);
                          setOpen(false);
                        }}
                        className="flex gap-2.5 px-4 py-3 transition-colors hover:bg-sage-100/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                            unread ? 'bg-destructive' : 'bg-sage-100'
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span
                              className={cn(
                                'truncate text-[13px]',
                                unread
                                  ? 'font-bold text-charcoal-900'
                                  : 'font-medium text-charcoal-700'
                              )}
                            >
                              {item.title}
                            </span>
                            {unread ? (
                              <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-white">
                                Baru
                              </span>
                            ) : (
                              <span className="shrink-0 text-xs text-sage-500">
                                {waktuLalu(item.createdAt)}
                              </span>
                            )}
                          </span>
                          {item.summary && (
                            <span className="mt-0.5 line-clamp-2 break-words text-xs text-sage-500">
                              {item.summary}
                            </span>
                          )}
                          <span className="mt-1 block text-xs font-medium text-sage-500">
                            {item.kind === 'activity' ? 'Log aktivitas' : 'Log audit'}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border bg-white px-3 py-2">
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1.5 rounded-[var(--radius)] px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-sage-100/50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <CheckCheck aria-hidden className="h-3.5 w-3.5" />
              Tandai sudah dibaca
            </button>
            <Link
              href="/dashboard/admin/monitoring/aktivitas"
              onClick={() => setOpen(false)}
              className="rounded-[var(--radius)] px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-sage-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Lihat semua
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}