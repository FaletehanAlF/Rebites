/**
 * Token usulan aksi chatbot: tanda tangan + verifikasi.
 *
 * Modul MURNI (hanya `node:crypto`, tanpa impor aplikasi) supaya aturan
 * keamanannya dapat diuji langsung dengan `node --test`.
 *
 * MENGAPA TOKEN, BUKAN LANGSUNG EKSEKUSI
 * Model bahasa tidak boleh memegang wewenang menulis. Kalau tool tulis
 * dieksekusi begitu dipanggil model, satu salah tafsir kalimat ("tolak semua
 * produk yang stoknya kosong") langsung mengubah data produksi tanpa ada
 * manusia yang sempat melihat targetnya.
 *
 * Karena itu model hanya menghasilkan USULAN. Usulan ditandatangani server,
 * lalu dikirim ke klien sebagai kartu konfirmasi. Eksekusi hanya terjadi ketika
 * admin menekan tombol, dan server memverifikasi ulang tanda tangan + peran
 * admin saat itu juga.
 *
 * Apa yang dijaga tanda tangan:
 *   - isi usulan tidak bisa diubah klien (target, alasan, jenis aksi);
 *   - usulan tidak bisa dipakai ulang di luar masa berlaku;
 *   - usulan admin A tidak bisa dieksekusi oleh admin B.
 *
 * Token TIDAK membuktikan bahwa admin masih berhak saat eksekusi — itu selalu
 * diperiksa ulang lewat getAdminUser() di route. Token hanya menjamin isi
 * usulan belum diubah sejak dibuat.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** Masa berlaku usulan aksi. Cukup lama untuk membaca, cukup singkat untuk aman. */
export const ACTION_TOKEN_TTL_MS = 10 * 60 * 1000;

/** Label algoritma di awal token, agar token format lama bisa ditolak dengan jelas. */
const TOKEN_PREFIX = 'v1';

export interface ActionPayload {
  /** Admin yang berhak mengeksekusi usulan ini. */
  adminId: string;
  /** Nama aksi, mis. `setujui_produk`. */
  action: string;
  /** Argumen aksi, sudah divalidasi sebelum ditandatangani. */
  payload: Record<string, string | number | boolean | null>;
  /** Alasan yang akan tercatat di jejak audit. */
  reason: string;
  /** Kedaluwarsa dalam epoch milidetik. */
  exp: number;
  /** Nonce acak: dua usulan identik menghasilkan token berbeda. */
  nonce: string;
}

export class ActionTokenError extends Error {
  code: 'missing-secret' | 'malformed' | 'bad-signature' | 'expired' | 'wrong-admin';

  constructor(code: ActionTokenError['code'], message: string) {
    super(message);
    this.name = 'ActionTokenError';
    this.code = code;
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * Kunci HMAC.
 *
 * Urutan: `CHATBOT_ACTION_SECRET` bila ada. Bila tidak, diturunkan dari
 * `SUPABASE_SERVICE_ROLE_KEY` lewat HKDF berlabel `chatbot-actions`.
 *
 * Menurunkan (bukan memakai langsung) penting: service role key juga dipakai
 * untuk operasi database, dan memakai kunci yang sama untuk dua tujuan berbeda
 * berarti satu kebocoran merusak keduanya. HKDF memastikan kunci turunan tidak
 * dapat dipakai balik untuk menebak kunci induk.
 *
 * Tanpa keduanya: lempar `missing-secret`. Route menjawab 503, bukan membuat
 * token dengan kunci kosong — kunci kosong berarti siapa pun bisa memalsukan
 * usulan aksi.
 */
export function resolveActionSecret(env: NodeJS.ProcessEnv = process.env): Buffer {
  const explicit = env.CHATBOT_ACTION_SECRET?.trim();
  if (explicit) return Buffer.from(explicit, 'utf8');

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceKey) {
    return Buffer.from(
      createHmac('sha256', serviceKey).update('chatbot-actions').digest('hex'),
      'utf8'
    );
  }

  throw new ActionTokenError(
    'missing-secret',
    'CHATBOT_ACTION_SECRET atau SUPABASE_SERVICE_ROLE_KEY harus diisi untuk menandatangani aksi.'
  );
}

function sign(encoded: string, secret: Buffer): string {
  return createHmac('sha256', secret).update(encoded).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface SignActionArgs {
  adminId: string;
  action: string;
  payload: Record<string, string | number | boolean | null>;
  reason: string;
  /** Untuk tes: waktu sekarang dan nonce tetap. */
  now?: number;
  nonce?: string;
  env?: NodeJS.ProcessEnv;
}

/** Buat token bertanda tangan. Mengembalikan token dan waktu kedaluwarsanya. */
export function signAction(args: SignActionArgs): { token: string; exp: number } {
  const now = args.now ?? Date.now();
  const exp = now + ACTION_TOKEN_TTL_MS;

  const body: ActionPayload = {
    adminId: args.adminId,
    action: args.action,
    payload: args.payload,
    reason: args.reason,
    exp,
    nonce: args.nonce ?? createHash('sha256').update(`${now}:${Math.random()}`).digest('hex').slice(0, 16),
  };

  const encoded = base64url(JSON.stringify(body));
  const secret = resolveActionSecret(args.env);
  const token = `${TOKEN_PREFIX}.${encoded}.${sign(encoded, secret)}`;

  return { token, exp };
}

/**
 * Verifikasi token dan kembalikan isinya.
 *
 * `expectedAdminId` WAJIB diberikan oleh pemanggil: token yang sah untuk admin
 * lain tetap harus ditolak, karena hak eksekusi melekat pada orang, bukan pada
 * usulan.
 */
export function verifyAction(
  token: string,
  expectedAdminId: string,
  opts?: { now?: number; env?: NodeJS.ProcessEnv }
): ActionPayload {
  const raw = (token ?? '').trim();
  if (!raw) throw new ActionTokenError('malformed', 'Token aksi kosong.');

  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    throw new ActionTokenError('malformed', 'Token aksi tidak dikenali.');
  }
  const [, encoded, signature] = parts;

  const secret = resolveActionSecret(opts?.env);
  const expectedSignature = sign(encoded, secret);
  if (!safeEqual(signature, expectedSignature)) {
    throw new ActionTokenError('bad-signature', 'Tanda tangan token aksi tidak sah.');
  }

  let parsed: ActionPayload;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ActionPayload;
  } catch {
    throw new ActionTokenError('malformed', 'Isi token aksi tidak dapat dibaca.');
  }

  if (typeof parsed?.exp !== 'number' || typeof parsed?.action !== 'string') {
    throw new ActionTokenError('malformed', 'Isi token aksi tidak lengkap.');
  }

  const now = opts?.now ?? Date.now();
  if (now > parsed.exp) {
    throw new ActionTokenError('expired', 'Usulan aksi sudah kedaluwarsa. Minta ulang.');
  }

  if (parsed.adminId !== expectedAdminId) {
    throw new ActionTokenError(
      'wrong-admin',
      'Usulan aksi ini dibuat untuk admin lain dan tidak dapat dieksekusi.'
    );
  }

  return parsed;
}

/** Ubah kode error menjadi pesan yang aman ditampilkan ke admin. */
export function actionErrorMessage(error: unknown): string {
  if (error instanceof ActionTokenError) {
    switch (error.code) {
      case 'expired':
        return 'Usulan aksi sudah kedaluwarsa. Silakan minta ulang dari asisten.';
      case 'wrong-admin':
        return 'Usulan aksi ini bukan milik Anda. Minta ulang dari asisten.';
      case 'missing-secret':
        return 'Fitur aksi asisten belum dikonfigurasi di server.';
      default:
        return 'Usulan aksi tidak sah. Minta ulang dari asisten.';
    }
  }
  return 'Usulan aksi tidak dapat diproses.';
}
