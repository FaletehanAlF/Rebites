/**
 * Jenis pengirim di `courier_messages.sender_kind`.
 *
 * Dipakai server (route, prompt) dan client (label, badge) — sengaja MURNI,
 * tanpa import server/client-only, supaya dapat diuji dengan `node --test`.
 */

export type CourierSenderKind = 'user' | 'demo_courier' | 'ai_courier';

/**
 * Normalisasi nilai dari database/response.
 *
 * Nilai yang tidak dikenal diperlakukan sebagai `user` (pesanan lama/asing
 * tetap tampil sebagai pesan pengguna) — JANGAN pernah melempar, karena UI
 * harus tetap menampilkan pesan alih-alih crash.
 */
export function normalizeCourierSenderKind(kind: unknown): CourierSenderKind {
  if (kind === 'demo_courier' || kind === 'ai_courier') return kind;
  return 'user';
}

export function isAutomatedSenderKind(kind: unknown): boolean {
  return normalizeCourierSenderKind(kind) !== 'user';
}

/** Label tampilan untuk setiap jenis pengirim. */
export function courierSenderLabel(kind: unknown): string {
  switch (normalizeCourierSenderKind(kind)) {
    case 'demo_courier':
      return 'Kurir Demo';
    case 'ai_courier':
      return 'Kurir AI';
    default:
      return 'Kurir';
  }
}
