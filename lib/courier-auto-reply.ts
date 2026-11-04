/**
 * Aturan siapa & kapan balasan otomatis (Kurir AI / Kurir Demo) boleh dibuat.
 *
 * MURNI — tanpa jaringan/database; dipakai route untuk memutuskan, dan tes
 * untuk mengunci aturan:
 *
 * - Hanya pembeli pesanan yang memicu balasan otomatis (kurir sungguhan &
 *   penjual tidak memicu; penjual bahkan tidak boleh menulis).
 * - Hanya untuk pesanan yang ditandai demo OLEH DATABASE (route membaca
 *   `delivery_assignments.is_demo`), tidak pernah dari body request.
 * - Jika Gemini tidak dikonfigurasi, jalur demo deterministik tetap dipilih
 *   (perilaku lama) — tidak ada kegagalan diam-diam yang diklaim "AI".
 * - Kurir nyata & non-partisipan → 'none'.
 */

export type ParticipantRole = 'buyer' | 'courier' | 'seller' | 'none';

export function resolveParticipantRole(args: {
  userId: string;
  buyerId: string | null | undefined;
  assignedCourierId: string | null | undefined;
  sellerUserIds?: ReadonlyArray<string | null | undefined>;
}): ParticipantRole {
  const { userId, buyerId, assignedCourierId, sellerUserIds = [] } = args;
  if (buyerId && buyerId === userId) return 'buyer';
  if (assignedCourierId && assignedCourierId === userId) return 'courier';
  if (sellerUserIds.some((id) => id && id === userId)) return 'seller';
  return 'none';
}

export type AutoReplyMode = 'none' | 'ai' | 'fallback';

/**
 * Putuskan jalur balasan otomatis untuk satu pesan user yang sudah masuk.
 * `isDemo` WAJIB berasal dari database (service client), bukan dari input klien.
 */
export function decideAutoReplyMode(args: {
  role: ParticipantRole;
  isDemoOrder: boolean;
  geminiConfigured: boolean;
}): AutoReplyMode {
  if (args.role !== 'buyer') return 'none';
  if (!args.isDemoOrder) return 'none';
  return args.geminiConfigured ? 'ai' : 'fallback';
}

/** Nama sender_kind balasan otomatis (tidak pernah dari input klien). */
export function autoReplySenderKind(mode: AutoReplyMode): 'ai_courier' | 'demo_courier' | null {
  if (mode === 'ai') return 'ai_courier';
  if (mode === 'fallback') return 'demo_courier';
  return null;
}
