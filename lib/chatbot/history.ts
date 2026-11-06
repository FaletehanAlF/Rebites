/**
 * Penyimpanan riwayat percakapan chatbot.
 *
 * Server-only. Selalu memakai `createServiceClient()` (service_role) kerana
 * migrasi 20261030100000 sengaja memberi `authenticated` hak SELECT saja.
 * Penolakan INSERT terjadi di level GRANT, jadi klien tidak akan pernah bisa
 * menanam pesan `assistant` palsu ke konteks model.
 *
 * Semua fungsi di sini bersifat BEST-EFFORT kecuali `ensureSession`: bila
 * penyimpanan gagal, percakapan tetap berjalan. Riwayat adalah kenyamanan,
 * bukan syarat agar asisten bisa menjawab — kegagalan menulis riwayat tidak
 * boleh membuat pengguna kehilangan jawaban yang sudah dibayar tokennya.
 */

import { createServiceClient } from '@/lib/server/supabase';
import type { ChatProfile, PendingAction } from './types';
import { CHAT_CONTEXT_MESSAGES } from './types';

const DB_TIMEOUT_MS = 12_000;

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  pendingActions?: PendingAction[];
}

export class ChatHistoryUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatHistoryUnavailableError';
  }
}

/** Profil yang boleh disimpan. `publik` (anonim) tidak pernah disimpan. */
function storableProfile(profile: ChatProfile): 'anggota' | 'admin' | null {
  if (profile === 'anggota') return 'anggota';
  if (profile === 'admin') return 'admin';
  return null;
}

/**
 * Pastikan ada sesi yang bisa dipakai.
 *
 * `sessionId` dari klien SELALU diverifikasi kepemilikannya. Tanpa pemeriksaan
 * itu, pengguna dapat mengirim id sesi orang lain dan menyisipkan pesan ke
 * percakapan mereka — server memakai service_role, sehingga RLS tidak akan
 * menahannya.
 */
export async function ensureSession(
  userId: string,
  profile: ChatProfile,
  sessionId?: string | null
): Promise<string | null> {
  const stored = storableProfile(profile);
  if (!stored) return null;

  const db = createServiceClient(DB_TIMEOUT_MS);

  if (sessionId) {
    const { data: existing, error } = await db
      .from('chat_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) throw new ChatHistoryUnavailableError(error.message);
    if (existing && existing.user_id === userId) {
      await db
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
      return sessionId;
    }
    // Sesi milik orang lain: JANGAN dipakai. Buat sesi baru alih-alih menolak,
    // supaya pengguna tetap bisa chat (id lama diabaikan, bukan dipercaya).
  }

  const { data, error } = await db
    .from('chat_sessions')
    .insert({ user_id: userId, profile: stored })
    .select('id')
    .single();

  if (error) throw new ChatHistoryUnavailableError(error.message);
  return (data?.id as string) ?? null;
}

/** Simpan satu pesan. Mengembalikan false bila gagal, tanpa melempar. */
export async function appendMessage(
  sessionId: string,
  message: StoredMessage
): Promise<boolean> {
  const db = createServiceClient(DB_TIMEOUT_MS);

  const { error } = await db.from('chat_messages').insert({
    session_id: sessionId,
    role: message.role,
    content: message.content,
    pending_actions: message.pendingActions?.length ? message.pendingActions : null,
  });

  if (error) return false;

  await db
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  return true;
}

/**
 * Ambil pesan terakhir untuk konteks model.
 *
 * Diambil TERBARU lalu dibalik urutannya: query `order desc limit N` memakai
 * index (session_id, created_at) dan hanya membaca N baris, sedangkan
 * `order asc limit N` akan mengambil N pesan PALING AWAL dan membuat asisten
 * melupakan percakapan yang baru saja terjadi.
 */
export async function loadRecentMessages(sessionId: string): Promise<StoredMessage[]> {
  const db = createServiceClient(DB_TIMEOUT_MS);

  const { data, error } = await db
    .from('chat_messages')
    .select('role, content, pending_actions, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(CHAT_CONTEXT_MESSAGES);

  if (error) return [];

  return (data ?? [])
    .slice()
    .reverse()
    .map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: String(row.content ?? ''),
      pendingActions: Array.isArray(row.pending_actions)
        ? (row.pending_actions as PendingAction[])
        : undefined,
    }));
}
