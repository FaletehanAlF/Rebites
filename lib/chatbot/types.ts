/**
 * Tipe bersama antara route, tools, dan widget chat.
 *
 * Modul murni (tanpa impor runtime) supaya bisa diimpor langsung oleh tes
 * `node --test` maupun komponen klien tanpa menyeret kode server.
 */

/** Profil perilaku ditentukan SERVER dari status autentikasi, tidak dari klien. */
export type ChatProfile = 'publik' | 'anggota' | 'admin';

/**
 * Usulan aksi yang BELUM dijalankan. `token` bertanda tangan HMAC dan hanya
 * dapat dieksekusi lewat /api/chat/actions setelah admin menekan tombol.
 */
export interface PendingAction {
  token: string;
  action: string;
  /** Judul singkat untuk kartu konfirmasi, mis. "Setujui produk". */
  label: string;
  /** Ringkasan target + alasan yang akan dicatat di audit log. */
  summary: string;
  targetType: string;
  targetId: string | null;
  /** ISO timestamp; token ditolak setelah lewat. */
  expiresAt: string;
}

export interface ChatReply {
  reply: string;
  profile: ChatProfile;
  pendingActions: PendingAction[];
  /** true bila provider menolak tools sehingga jawaban tidak memakai data nyata. */
  toolsUnavailable: boolean;
  sessionId: string | null;
  /** true bila jawaban berasal dari penjaga deterministik, bukan dari model. */
  blocked: boolean;
}

export interface ChatMessageView {
  role: 'user' | 'assistant';
  content: string;
  pendingActions?: PendingAction[];
  /** Penanda bahwa balasan ini ditolak penjaga, untuk gaya tampilan berbeda. */
  blocked?: boolean;
}

export const CHAT_MAX_INPUT_CHARS = 2_000;

/** Batas jumlah pesan yang dikirim sebagai konteks ke model. */
export const CHAT_CONTEXT_MESSAGES = 20;

/** Putaran tool maksimum per satu balasan, agar satu pertanyaan tetap satu jawaban. */
export const CHAT_MAX_TOOL_ROUNDS = 3;

export function isChatProfile(value: unknown): value is ChatProfile {
  return value === 'publik' || value === 'anggota' || value === 'admin';
}
