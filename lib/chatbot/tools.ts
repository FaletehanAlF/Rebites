/**
 * Tools call untuk asisten admin.
 *
 * Server-only: memakai `createServiceClient()` (service_role) karena admin perlu
 * melihat baris yang tidak lolos RLS, mis. produk milik toko nonaktif.
 *
 * DUA KELAS TOOL, dan perbedaannya adalah inti keamanannya:
 *
 *   TOOL BACA  — dieksekusi langsung saat model memintanya.
 *   TOOL TULIS — TIDAK PERNAH dieksekusi di sini. Model hanya dapat MENGAJUKAN;
 *                usulan ditandatangani (lib/chatbot/actions.ts) lalu menunggu
 *                admin menekan konfirmasi.
 *
 * Model bahasa tidak memegang wewenang menulis. Satu salah tafsir kalimat
 * ("tolak semua produk yang stoknya kosong") tidak boleh langsung mengubah data
 * produksi tanpa manusia melihat targetnya lebih dulu.
 *
 * Batas keluaran: setiap tool baca mengembalikan paling banyak 20 baris dan
 * menyertakan penanda bila hasil dipotong. Tanpa batas itu, satu pertanyaan
 * "tampilkan semua pesanan" akan mengirim ribuan baris ke model — mahal, lambat,
 * dan justru membuat jawaban lebih buruk karena konteks penuh data mentah.
 */

import { createServiceClient } from '@/lib/server/supabase';
import type { AiToolDefinition } from '@/lib/server/ai-provider';

/** Batas baris per tool baca. */
export const TOOL_ROW_LIMIT = 20;

/** Batas waktu query, sama dengan pemeriksaan admin lain di repo ini. */
const QUERY_TIMEOUT_MS = 12_000;

export interface ToolContext {
  adminId: string;
}

export interface ReadToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  /** true bila hasil dipotong karena melebihi TOOL_ROW_LIMIT. */
  truncated?: boolean;
  /** Jumlah baris sesungguhnya bila diketahui. */
  total?: number;
}

// ---------------------------------------------------------------------------
// Definisi tool (format OpenAI "function")
// ---------------------------------------------------------------------------

const str = (description: string) => ({ type: 'string', description });
const num = (description: string) => ({ type: 'number', description });

/** Tool baca: langsung dieksekusi. */
export const READ_TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'cari_produk',
      description:
        'Cari produk berdasarkan kata kunci nama, status verifikasi, atau status ketersediaan. Gunakan ini sebelum menjawab pertanyaan tentang produk tertentu atau jumlah produk.',
      parameters: {
        type: 'object',
        properties: {
          kata_kunci: str('Potongan nama produk yang dicari. Kosongkan untuk daftar terbaru.'),
          status_verifikasi: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected'],
            description: 'Filter status verifikasi produk.',
          },
          status: {
            type: 'string',
            enum: ['available', 'sold_out', 'hidden'],
            description: 'Filter status ketersediaan produk.',
          },
          hanya_terhapus: {
            type: 'boolean',
            description: 'true untuk hanya produk yang sudah dihapus penjual (soft delete).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detail_produk',
      description:
        'Ambil detail satu produk berdasarkan ID: harga, stok, status verifikasi, alasan penolakan, dan nama tokonya.',
      parameters: {
        type: 'object',
        properties: { id: str('ID produk (UUID).') },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cari_pesanan',
      description:
        'Cari pesanan berdasarkan kode pesanan, atau filter status pembayaran/pesanan. Gunakan untuk pertanyaan tentang pesanan, pendapatan, atau pesanan yang belum dibayar.',
      parameters: {
        type: 'object',
        properties: {
          kode_pesanan: str('Kode pesanan, mis. RB-XXXX.'),
          status_pembayaran: {
            type: 'string',
            enum: ['unpaid', 'paid', 'failed', 'refunded'],
          },
          status_pesanan: {
            type: 'string',
            enum: [
              'pending',
              'paid',
              'preparing',
              'ready',
              'completed',
              'cancelled',
              'refunded',
            ],
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detail_pesanan',
      description: 'Ambil detail satu pesanan berdasarkan ID atau kode pesanan.',
      parameters: {
        type: 'object',
        properties: {
          id: str('ID pesanan (UUID).'),
          kode_pesanan: str('Kode pesanan bila ID tidak diketahui.'),
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cari_pengguna',
      description:
        'Cari pengguna berdasarkan nama atau email. Email dikembalikan dalam bentuk tersamarkan; data sensitif tidak pernah dibuka lewat asisten.',
      parameters: {
        type: 'object',
        properties: {
          kata_kunci: str('Potongan nama atau email.'),
          peran: { type: 'string', enum: ['admin', 'umkm', 'buyer'] },
          status_akun: { type: 'string', enum: ['active', 'suspended', 'banned'] },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detail_pengguna',
      description: 'Ambil ringkasan satu pengguna: nama, peran, status akun, dan tanggal daftar.',
      parameters: {
        type: 'object',
        properties: { id: str('ID pengguna (UUID).') },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cari_umkm',
      description:
        'Cari toko UMKM berdasarkan nama, kota, atau status verifikasi/aktif. Gunakan untuk pertanyaan tentang toko dan penjual.',
      parameters: {
        type: 'object',
        properties: {
          kata_kunci: str('Potongan nama toko.'),
          kota: str('Nama kota, mis. Depok.'),
          status_verifikasi: { type: 'boolean', description: 'true = terverifikasi.' },
          aktif: {
            type: 'boolean',
            description: 'true = aktif (tampil ke pembeli), false = dinonaktifkan admin.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detail_umkm',
      description:
        'Ambil detail satu toko: pemilik, alamat, status verifikasi, status aktif, jam buka, dan jumlah produk.',
      parameters: {
        type: 'object',
        properties: { id: str('ID toko (UUID).') },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'daftar_laporan',
      description:
        'Daftar laporan dari pengguna, dengan filter status. Gunakan untuk pertanyaan tentang laporan dan moderasi.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'reviewing', 'resolved', 'dismissed'],
          },
          tingkat: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detail_laporan',
      description: 'Ambil detail satu laporan beserta catatan penanganannya.',
      parameters: {
        type: 'object',
        properties: { id: str('ID laporan (UUID).') },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ringkasan_dashboard',
      description:
        'Angka ringkas operasional: jumlah pengguna, toko, produk, pesanan, dan produk yang menunggu moderasi. Panggil ini dulu untuk pertanyaan "bagaimana kondisi hari ini".',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'kesehatan_sistem',
      description:
        'Status kesehatan layanan: koneksi database dan konfigurasi layanan pembayaran/pengiriman. Gunakan bila ada keluhan "situs lambat" atau "pembayaran gagal".',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'daftar_artikel',
      description: 'Daftar artikel edukasi beserta status terbitnya.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['draft', 'published', 'archived'] },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'daftar_langganan',
      description:
        'Daftar langganan penjual beserta paket dan statusnya. Gunakan untuk pertanyaan tentang pendapatan langganan atau penjual yang paketnya kedaluwarsa.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['trial', 'active', 'expired', 'cancelled'] },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'daftar_aktivitas',
      description:
        'Arus aktivitas terbaru: login, daftar akun, produk dibuat/diubah/dihapus, pesanan dibuat/dibatalkan, toko diperbarui, langganan berubah, laporan masuk, peringatan diterima. Gunakan untuk pertanyaan "apa yang dilakukan penjual/pembeli terakhir kali" atau "aktivitas terbaru".',
      parameters: {
        type: 'object',
        properties: {
          peran: {
            type: 'string',
            enum: ['admin', 'umkm', 'buyer'],
            description: 'Batasi ke pelaku dengan peran ini. umkm = penjual, buyer = pembeli.',
          },
          jenis: {
            type: 'string',
            enum: [
              'login',
              'register',
              'product_created',
              'product_updated',
              'product_deleted',
              'order_created',
              'order_cancelled',
              'store_updated',
              'subscription_changed',
              'report_received',
              'warning_received',
            ],
            description: 'Batasi ke satu jenis aktivitas.',
          },
          kata_kunci: str('Potongan teks deskripsi aktivitas.'),
          hari_terakhir: num('Hanya aktivitas dalam N hari terakhir (1-30).'),
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'daftar_peringatan',
      description:
        'Daftar peringatan yang pernah dikirim ke pengguna atau penjual, beserta tingkat dan alasannya. Gunakan untuk pertanyaan tentang peringatan atau riwayat pelanggaran.',
      parameters: {
        type: 'object',
        properties: {
          tingkat: { type: 'number', enum: [1, 2, 3], description: 'Tingkat peringatan.' },
          kata_kunci: str('Potongan alasan atau kategori peringatan.'),
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'daftar_sanksi',
      description:
        'Daftar sanksi akun (suspend, ban, delete) beserta masa berlaku dan alasannya. Pemberian sanksi TIDAK dapat dilakukan lewat asisten.',
      parameters: {
        type: 'object',
        properties: {
          jenis: { type: 'string', enum: ['suspend', 'ban', 'delete'] },
          kata_kunci: str('Potongan alasan sanksi.'),
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'daftar_audit_admin',
      description:
        'Jejak tindakan admin: siapa melakukan aksi apa, pada target apa, kapan, dan alasannya. Gunakan untuk pertanyaan tentang audit atau tindakan admin sebelumnya.',
      parameters: {
        type: 'object',
        properties: {
          aksi: str('Nama aksi, mis. setujui_produk atau tolak_produk.'),
          tipe_target: str('Tipe target, mis. product, umkm, user, report.'),
          kata_kunci: str('Potongan alasan pada jejak audit.'),
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'daftar_ulasan',
      description:
        'Ulasan dan penilaian pembeli terhadap produk atau toko. Gunakan untuk pertanyaan tentang kualitas layanan, keluhan pembeli, atau rating terendah.',
      parameters: {
        type: 'object',
        properties: {
          rating_maksimal: num('Tampilkan hanya ulasan dengan rating <= nilai ini (1-5).'),
          kata_kunci: str('Potongan isi komentar atau nama menu.'),
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'daftar_permintaan_role',
      description:
        'Permintaan perubahan peran pengguna (mis. pembeli ingin menjadi penjual) beserta status keputusannya. Keputusan hanya dapat diambil Super Admin lewat panel.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
        },
        required: [],
      },
    },
  },
];

/**
 * Tool tulis: HANYA menghasilkan usulan.
 * `handler` sengaja tidak ada di sini — eksekusi hidup di
 * app/api/chat/actions/route.ts setelah konfirmasi admin.
 */
export const WRITE_TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'ajukan_setujui_produk',
      description:
        'MENGAJUKAN persetujuan sebuah produk. Tidak langsung dijalankan: admin harus menekan tombol konfirmasi. Sebutkan alasan yang jelas.',
      parameters: {
        type: 'object',
        properties: {
          produk_id: str('ID produk (UUID).'),
          alasan: str('Alasan persetujuan, akan tercatat di jejak audit.'),
        },
        required: ['produk_id', 'alasan'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ajukan_tolak_produk',
      description:
        'MENGAJUKAN penolakan atau penurunan sebuah produk. Tidak langsung dijalankan; perlu konfirmasi admin.',
      parameters: {
        type: 'object',
        properties: {
          produk_id: str('ID produk (UUID).'),
          alasan: str('Alasan penolakan; alasan ini juga dikirim ke penjual.'),
        },
        required: ['produk_id', 'alasan'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ajukan_peringatkan_produk',
      description:
        'MENGAJUKAN pengiriman peringatan kepada penjual atas sebuah produk. Tidak langsung dijalankan; perlu konfirmasi admin.',
      parameters: {
        type: 'object',
        properties: {
          produk_id: str('ID produk (UUID).'),
          alasan: str('Isi peringatan yang akan dibaca penjual.'),
        },
        required: ['produk_id', 'alasan'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ajukan_set_umkm_aktif',
      description:
        'MENGAJUKAN penonaktifan atau pengaktifan kembali sebuah toko UMKM. Toko nonaktif hilang dari katalog pembeli. Tidak langsung dijalankan.',
      parameters: {
        type: 'object',
        properties: {
          umkm_id: str('ID toko (UUID).'),
          aktif: { type: 'boolean', description: 'false = nonaktifkan, true = aktifkan.' },
          alasan: str('Alasan perubahan status, tercatat di jejak audit.'),
        },
        required: ['umkm_id', 'aktif', 'alasan'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ajukan_verifikasi_umkm',
      description:
        'MENGAJUKAN perubahan status verifikasi sebuah toko UMKM. Tidak langsung dijalankan; perlu konfirmasi admin.',
      parameters: {
        type: 'object',
        properties: {
          umkm_id: str('ID toko (UUID).'),
          terverifikasi: { type: 'boolean', description: 'true = verifikasi.' },
          alasan: str('Alasan perubahan, tercatat di jejak audit.'),
        },
        required: ['umkm_id', 'terverifikasi', 'alasan'],
      },
    },
  },
];

export function allToolDefinitions(): AiToolDefinition[] {
  return [...READ_TOOL_DEFINITIONS, ...WRITE_TOOL_DEFINITIONS];
}

export function isWriteTool(name: string): boolean {
  return WRITE_TOOL_DEFINITIONS.some((tool) => tool.function.name === name);
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asBool(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

/** Angka dari model bisa datang sebagai number atau string. */
function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/** Argumen dari model datang sebagai JSON string; parse aman. */
export function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Sembunyikan sebagian email. Admin memang berhak melihat data, tetapi asisten
 * tidak perlu menampilkan alamat lengkap ke layar chat — percakapan bisa
 * terbaca orang lain yang lewat, dan riwayatnya tersimpan.
 */
export function maskEmail(email: string | null | undefined): string | null {
  const value = (email ?? '').trim();
  if (!value) return null;
  const at = value.indexOf('@');
  if (at <= 0) return '***';
  const name = value.slice(0, at);
  const domain = value.slice(at + 1);
  const head = name.slice(0, Math.min(2, name.length));
  return `${head}${'*'.repeat(Math.max(1, name.length - head.length))}@${domain}`;
}

/** Potong hasil query ke TOOL_ROW_LIMIT dan beri penanda. */
function limitRows<T>(rows: T[]): { rows: T[]; truncated: boolean } {
  if (rows.length <= TOOL_ROW_LIMIT) return { rows, truncated: false };
  return { rows: rows.slice(0, TOOL_ROW_LIMIT), truncated: true };
}

function truncationNote(truncated: boolean): string | undefined {
  return truncated
    ? `Hasil dipotong pada ${TOOL_ROW_LIMIT} baris pertama. Sebutkan hal ini kepada admin.`
    : undefined;
}

// ---------------------------------------------------------------------------
// Eksekusi tool baca
// ---------------------------------------------------------------------------

/**
 * Jalankan satu tool baca.
 *
 * Semua kegagalan dikembalikan sebagai `{ ok: false, error }` dan BUKAN
 * dilempar: model harus bisa memberi tahu admin "data ini tidak dapat diambil"
 * alih-alih percakapan mati. Yang tidak boleh terjadi adalah diam-diam
 * mengembalikan data kosong — itu akan dibaca model sebagai "tidak ada
 * apa-apa", padahal artinya query gagal.
 */
export async function runReadTool(
  name: string,
  args: Record<string, unknown>,
  _ctx: ToolContext
): Promise<ReadToolResult> {
  const db = createServiceClient(QUERY_TIMEOUT_MS);

  try {
    switch (name) {
      case 'cari_produk': {
        const keyword = asString(args.kata_kunci);
        const verification = asString(args.status_verifikasi);
        const status = asString(args.status);
        const onlyDeleted = asBool(args.hanya_terhapus);

        let query = db
          .from('products')
          .select(
            'id, name, category, surplus_price, original_price, stock, status, verification_status, rejection_reason, deleted_at, created_at, umkm_id, umkm_profiles(business_name)'
          )
          .order('created_at', { ascending: false })
          .limit(TOOL_ROW_LIMIT + 1);

        if (keyword) query = query.ilike('name', `%${keyword}%`);
        if (verification) query = query.eq('verification_status', verification);
        if (status) query = query.eq('status', status);
        if (onlyDeleted === true) query = query.not('deleted_at', 'is', null);
        else if (onlyDeleted === false) query = query.is('deleted_at', null);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const { rows, truncated } = limitRows(data ?? []);
        return {
          ok: true,
          data: {
            produk: rows,
            catatan: truncationNote(truncated),
          },
          truncated,
          total: rows.length,
        };
      }

      case 'detail_produk': {
        const id = asString(args.id);
        if (!id) return { ok: false, error: 'ID produk wajib diisi.' };

        const { data, error } = await db
          .from('products')
          .select(
            'id, name, description, category, original_price, surplus_price, stock, status, verification_status, rejection_reason, image_url, sell_window_start, sell_window_end, is_delivery, is_pickup, deleted_at, created_at, umkm_id, umkm_profiles(business_name, slug)'
          )
          .eq('id', id)
          .maybeSingle();

        if (error) return { ok: false, error: error.message };
        if (!data) return { ok: false, error: 'Produk dengan ID itu tidak ditemukan.' };
        return { ok: true, data };
      }

      case 'cari_pesanan': {
        const code = asString(args.kode_pesanan);
        const payment = asString(args.status_pembayaran);
        const orderStatus = asString(args.status_pesanan);

        let query = db
          .from('orders')
          .select(
            'id, order_code, product_name, quantity, total_price, payment_status, order_status, delivery_option, created_at, vendor_name'
          )
          .order('created_at', { ascending: false })
          .limit(TOOL_ROW_LIMIT + 1);

        if (code) query = query.ilike('order_code', `%${code}%`);
        if (payment) query = query.eq('payment_status', payment);
        if (orderStatus) query = query.eq('order_status', orderStatus);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const { rows, truncated } = limitRows(data ?? []);
        return { ok: true, data: { pesanan: rows, catatan: truncationNote(truncated) }, truncated };
      }

      case 'detail_pesanan': {
        const id = asString(args.id);
        const code = asString(args.kode_pesanan);
        if (!id && !code) return { ok: false, error: 'ID atau kode pesanan wajib diisi.' };

        let query = db
          .from('orders')
          .select(
            'id, order_code, product_name, quantity, subtotal, delivery_fee, service_fee, total_price, delivery_option, delivery_address, note, payment_status, order_status, progress_status, courier_code, estimated_arrival_at, created_at, vendor_name, vendor_slug, buyer_id'
          )
          .limit(1);

        query = id ? query.eq('id', id) : query.eq('order_code', code.toUpperCase());

        const { data, error } = await query.maybeSingle();
        if (error) return { ok: false, error: error.message };
        if (!data) return { ok: false, error: 'Pesanan tidak ditemukan.' };
        return { ok: true, data };
      }

      case 'cari_pengguna': {
        const keyword = asString(args.kata_kunci);
        const role = asString(args.peran);
        const accountStatus = asString(args.status_akun);

        let query = db
          .from('profiles')
          .select('id, full_name, email, role, account_status, created_at')
          .order('created_at', { ascending: false })
          .limit(TOOL_ROW_LIMIT + 1);

        if (keyword) {
          // Satu kata kunci mencari di nama ATAU email.
          query = query.or(`full_name.ilike.%${keyword}%,email.ilike.%${keyword}%`);
        }
        if (role) query = query.eq('role', role);
        if (accountStatus) query = query.eq('account_status', accountStatus);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const { rows, truncated } = limitRows(
          (data ?? []).map((row) => ({
            ...row,
            email: maskEmail(row.email as string | null),
          }))
        );
        return {
          ok: true,
          data: {
            pengguna: rows,
            catatan_email: 'Email disamarkan dengan sengaja; jangan minta yang lengkap.',
            catatan: truncationNote(truncated),
          },
          truncated,
        };
      }

      case 'detail_pengguna': {
        const id = asString(args.id);
        if (!id) return { ok: false, error: 'ID pengguna wajib diisi.' };

        const { data, error } = await db
          .from('profiles')
          .select('id, full_name, email, role, account_status, is_verified, created_at')
          .eq('id', id)
          .maybeSingle();

        if (error) return { ok: false, error: error.message };
        if (!data) return { ok: false, error: 'Pengguna tidak ditemukan.' };
        return {
          ok: true,
          data: { ...data, email: maskEmail(data.email as string | null) },
        };
      }

      case 'cari_umkm': {
        const keyword = asString(args.kata_kunci);
        const city = asString(args.kota);
        const verified = asBool(args.status_verifikasi);
        const active = asBool(args.aktif);

        let query = db
          .from('umkm_profiles')
          .select(
            'id, business_name, category, city, is_verified, is_active, is_open, rating, created_at'
          )
          .order('created_at', { ascending: false })
          .limit(TOOL_ROW_LIMIT + 1);

        if (keyword) query = query.ilike('business_name', `%${keyword}%`);
        if (city) query = query.ilike('city', `%${city}%`);
        if (verified !== undefined) query = query.eq('is_verified', verified);
        if (active !== undefined) query = query.eq('is_active', active);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const { rows, truncated } = limitRows(data ?? []);
        return { ok: true, data: { umkm: rows, catatan: truncationNote(truncated) }, truncated };
      }

      case 'detail_umkm': {
        const id = asString(args.id);
        if (!id) return { ok: false, error: 'ID toko wajib diisi.' };

        const { data, error } = await db
          .from('umkm_profiles')
          .select(
            'id, user_id, business_name, description, category, address, city, is_verified, is_active, is_open, open_hours, rating, slug, created_at'
          )
          .eq('id', id)
          .maybeSingle();

        if (error) return { ok: false, error: error.message };
        if (!data) return { ok: false, error: 'Toko tidak ditemukan.' };

        const { count } = await db
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('umkm_id', id)
          .is('deleted_at', null);

        return { ok: true, data: { ...data, jumlah_produk: count ?? 0 } };
      }

      case 'daftar_laporan': {
        const status = asString(args.status);
        const severity = asString(args.tingkat);

        let query = db
          .from('reports')
          .select(
            'id, category, description, status, severity, created_at, reported_user_id, reported_by'
          )
          .order('created_at', { ascending: false })
          .limit(TOOL_ROW_LIMIT + 1);

        if (status) query = query.eq('status', status);
        if (severity) query = query.eq('severity', severity);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const { rows, truncated } = limitRows(data ?? []);
        return { ok: true, data: { laporan: rows, catatan: truncationNote(truncated) }, truncated };
      }

      case 'detail_laporan': {
        const id = asString(args.id);
        if (!id) return { ok: false, error: 'ID laporan wajib diisi.' };

        const { data, error } = await db
          .from('reports')
          .select(
            'id, category, description, status, severity, assigned_to, resolved_at, created_at, reported_user_id, reported_by'
          )
          .eq('id', id)
          .maybeSingle();

        if (error) return { ok: false, error: error.message };
        if (!data) return { ok: false, error: 'Laporan tidak ditemukan.' };

        const { data: notes } = await db
          .from('report_notes')
          .select('id, note, created_at')
          .eq('report_id', id)
          .order('created_at', { ascending: true })
          .limit(TOOL_ROW_LIMIT);

        return { ok: true, data: { ...data, catatan_penanganan: notes ?? [] } };
      }

      case 'ringkasan_dashboard': {
        const [users, stores, products, pending, orders] = await Promise.all([
          db.from('profiles').select('id', { count: 'exact', head: true }),
          db.from('umkm_profiles').select('id', { count: 'exact', head: true }),
          db
            .from('products')
            .select('id', { count: 'exact', head: true })
            .is('deleted_at', null),
          db
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('verification_status', 'pending')
            .is('deleted_at', null),
          db.from('orders').select('id', { count: 'exact', head: true }),
        ]);

        const firstError =
          users.error ?? stores.error ?? products.error ?? pending.error ?? orders.error;
        if (firstError) return { ok: false, error: firstError.message };

        return {
          ok: true,
          data: {
            jumlah_pengguna: users.count ?? 0,
            jumlah_toko: stores.count ?? 0,
            jumlah_produk: products.count ?? 0,
            produk_menunggu_moderasi: pending.count ?? 0,
            jumlah_pesanan: orders.count ?? 0,
          },
        };
      }

      case 'kesehatan_sistem': {
        // Pemeriksaan langsung dan sederhana: apakah tabel inti dapat dibaca.
        const probe = await db.from('profiles').select('id', { head: true, count: 'exact' });
        const dbOk = !probe.error;

        return {
          ok: true,
          data: {
            database: dbOk ? 'normal' : `bermasalah: ${probe.error?.message ?? 'tidak diketahui'}`,
            layanan_pembayaran_terkonfigurasi: Boolean(process.env.XENDIT_SECRET_KEY?.trim()),
            layanan_pengiriman_terkonfigurasi: Boolean(process.env.BITESHIP_API_KEY?.trim()),
            asisten_terkonfigurasi: Boolean(
              process.env.VIBE_CODE_URL?.trim() && process.env.VIBE_CODE_KEY?.trim()
            ),
          },
        };
      }

      case 'daftar_artikel': {
        const status = asString(args.status);

        let query = db
          .from('articles')
          .select('id, title, slug, status, category, published_at, created_at')
          .order('created_at', { ascending: false })
          .limit(TOOL_ROW_LIMIT + 1);

        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const { rows, truncated } = limitRows(data ?? []);
        return { ok: true, data: { artikel: rows, catatan: truncationNote(truncated) }, truncated };
      }

      case 'daftar_langganan': {
        const status = asString(args.status);

        let query = db
          .from('subscriptions')
          .select(
            'id, status, current_period_end, created_at, umkm_id, umkm_profiles(business_name), plans(name, price_monthly)'
          )
          .order('created_at', { ascending: false })
          .limit(TOOL_ROW_LIMIT + 1);

        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const { rows, truncated } = limitRows(data ?? []);
        return { ok: true, data: { langganan: rows, catatan: truncationNote(truncated) }, truncated };
      }

      case 'daftar_aktivitas': {
        const role = asString(args.peran);
        const type = asString(args.jenis);
        const keyword = asString(args.kata_kunci);
        const days = asNumber(args.hari_terakhir);

        // Saat menyaring peran, join harus `!inner`: tanpa itu PostgREST tetap
        // mengembalikan baris yang profilnya tidak cocok. Tanpa saringan peran,
        // join biasa dipakai agar aktivitas milik akun yang sudah dihapus
        // (user_id NULL) tetap muncul alih-alih hilang diam-diam.
        const select = role
          ? 'id, user_id, activity_type, description, target_type, target_id, created_at, profiles!inner(full_name, role)'
          : 'id, user_id, activity_type, description, target_type, target_id, created_at, profiles(full_name, role)';

        let query = db
          .from('activity_logs')
          .select(select)
          .order('created_at', { ascending: false })
          .limit(TOOL_ROW_LIMIT + 1);

        if (role) query = query.eq('profiles.role', role);
        if (type) query = query.eq('activity_type', type);
        if (keyword) query = query.ilike('description', `%${keyword}%`);
        if (days !== undefined && days > 0) {
          // Dibatasi 30 hari: pertanyaan "sejak awal" akan menarik ribuan baris
          // dan jawabannya tidak berguna bagi admin.
          const span = Math.min(days, 30);
          const since = new Date(Date.now() - span * 86_400_000).toISOString();
          query = query.gte('created_at', since);
        }

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const { rows, truncated } = limitRows(data ?? []);
        return {
          ok: true,
          data: {
            aktivitas: rows,
            urutan: 'terbaru lebih dulu',
            catatan: truncationNote(truncated),
          },
          truncated,
        };
      }

      case 'daftar_peringatan': {
        const level = asNumber(args.tingkat);
        const keyword = asString(args.kata_kunci);

        let query = db
          .from('warnings')
          .select(
            'id, user_id, warning_level, category, reason, created_at, profiles!warnings_user_id_fkey(full_name, role)'
          )
          .order('created_at', { ascending: false })
          .limit(TOOL_ROW_LIMIT + 1);

        if (level !== undefined) query = query.eq('warning_level', level);
        if (keyword) query = query.ilike('reason', `%${keyword}%`);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const { rows, truncated } = limitRows(data ?? []);
        return {
          ok: true,
          data: { peringatan: rows, catatan: truncationNote(truncated) },
          truncated,
        };
      }

      case 'daftar_sanksi': {
        const type = asString(args.jenis);
        const keyword = asString(args.kata_kunci);

        let query = db
          .from('sanctions')
          .select(
            'id, user_id, sanction_type, reason, start_at, end_at, created_at, profiles!sanctions_user_id_fkey(full_name, role)'
          )
          .order('created_at', { ascending: false })
          .limit(TOOL_ROW_LIMIT + 1);

        if (type) query = query.eq('sanction_type', type);
        if (keyword) query = query.ilike('reason', `%${keyword}%`);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const { rows, truncated } = limitRows(data ?? []);
        const now = Date.now();
        return {
          ok: true,
          data: {
            sanksi: rows.map((row) => {
              const end = (row as { end_at: string | null }).end_at;
              return {
                ...row,
                // Status dihitung di sini supaya model tidak perlu menafsirkan
                // tanggal sendiri dan salah menyebut sanksi permanen sebagai aktif.
                status: end === null ? 'berlaku tanpa batas' : new Date(end).getTime() > now ? 'sedang berlaku' : 'sudah berakhir',
              };
            }),
            catatan: truncationNote(truncated),
          },
          truncated,
        };
      }

      case 'daftar_audit_admin': {
        const action = asString(args.aksi);
        const targetType = asString(args.tipe_target);
        const keyword = asString(args.kata_kunci);

        let query = db
          .from('admin_audit_logs')
          .select('id, admin_id, action, target_type, target_id, reason, created_at, profiles(full_name)')
          .order('created_at', { ascending: false })
          .limit(TOOL_ROW_LIMIT + 1);

        if (action) query = query.eq('action', action);
        if (targetType) query = query.eq('target_type', targetType);
        if (keyword) query = query.ilike('reason', `%${keyword}%`);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const { rows, truncated } = limitRows(data ?? []);
        return {
          ok: true,
          data: { audit: rows, catatan: truncationNote(truncated) },
          truncated,
        };
      }

      case 'daftar_ulasan': {
        const maxRating = asNumber(args.rating_maksimal);
        const keyword = asString(args.kata_kunci);

        let query = db
          .from('reviews')
          .select('id, author_name, menu_name, rating, comment, created_at, umkm_id, product_id')
          .order('created_at', { ascending: false })
          .limit(TOOL_ROW_LIMIT + 1);

        if (maxRating !== undefined) query = query.lte('rating', maxRating);
        if (keyword) query = query.ilike('comment', `%${keyword}%`);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const { rows, truncated } = limitRows(data ?? []);
        const ratings = (rows as Array<{ rating: number }>).map((row) => Number(row.rating));
        return {
          ok: true,
          data: {
            ulasan: rows,
            rata_rata_rating:
              ratings.length > 0
                ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10
                : null,
            catatan: truncationNote(truncated),
          },
          truncated,
        };
      }

      case 'daftar_permintaan_role': {
        const status = asString(args.status);

        let query = db
          .from('role_change_requests')
          .select(
            'id, requested_by, target_user_id, current_role, requested_role, status, reason, created_at'
          )
          .order('created_at', { ascending: false })
          .limit(TOOL_ROW_LIMIT + 1);

        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) return { ok: false, error: error.message };

        const { rows, truncated } = limitRows(data ?? []);
        return {
          ok: true,
          data: {
            permintaan_role: rows,
            catatan_keputusan:
              'Keputusan approve/reject hanya dapat diambil Super Admin lewat panel; asisten tidak dapat mengubah peran.',
            catatan: truncationNote(truncated),
          },
          truncated,
        };
      }

      default:
        return { ok: false, error: `Tool "${name}" tidak dikenal.` };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Terjadi kesalahan saat mengambil data.',
    };
  }
}

// ---------------------------------------------------------------------------
// Bentuk usulan aksi
// ---------------------------------------------------------------------------

export interface ActionProposal {
  action: string;
  payload: Record<string, string | number | boolean | null>;
  label: string;
  summary: string;
  targetType: string;
  targetId: string | null;
  reason: string;
}

/**
 * Ubah panggilan tool tulis menjadi usulan yang bisa ditandatangani.
 * Mengembalikan null bila argumen tidak lengkap — model diberi tahu bahwa
 * usulannya tidak dapat dibuat, bukan dibiarkan menebak.
 */
export function buildProposal(
  name: string,
  args: Record<string, unknown>
): ActionProposal | null {
  const reason = asString(args.alasan);
  if (!reason) return null;

  switch (name) {
    case 'ajukan_setujui_produk': {
      const id = asString(args.produk_id);
      if (!id) return null;
      return {
        action: 'setujui_produk',
        payload: { produk_id: id },
        label: 'Setujui produk',
        summary: `Produk akan disetujui dan tayang di katalog. Alasan: ${reason}`,
        targetType: 'product',
        targetId: id,
        reason,
      };
    }
    case 'ajukan_tolak_produk': {
      const id = asString(args.produk_id);
      if (!id) return null;
      return {
        action: 'tolak_produk',
        payload: { produk_id: id },
        label: 'Tolak produk',
        summary: `Produk akan ditolak dan tidak tayang. Alasan dikirim ke penjual: ${reason}`,
        targetType: 'product',
        targetId: id,
        reason,
      };
    }
    case 'ajukan_peringatkan_produk': {
      const id = asString(args.produk_id);
      if (!id) return null;
      return {
        action: 'peringatkan_produk',
        payload: { produk_id: id },
        label: 'Kirim peringatan',
        summary: `Penjual akan menerima peringatan: ${reason}`,
        targetType: 'product',
        targetId: id,
        reason,
      };
    }
    case 'ajukan_set_umkm_aktif': {
      const id = asString(args.umkm_id);
      const active = asBool(args.aktif);
      if (!id || active === undefined) return null;
      return {
        action: 'set_umkm_aktif',
        payload: { umkm_id: id, aktif: active },
        label: active ? 'Aktifkan toko' : 'Nonaktifkan toko',
        summary: active
          ? `Toko akan diaktifkan kembali dan tampil di katalog. Alasan: ${reason}`
          : `Toko akan dinonaktifkan dan hilang dari katalog pembeli. Alasan: ${reason}`,
        targetType: 'umkm',
        targetId: id,
        reason,
      };
    }
    case 'ajukan_verifikasi_umkm': {
      const id = asString(args.umkm_id);
      const verified = asBool(args.terverifikasi);
      if (!id || verified === undefined) return null;
      return {
        action: 'verifikasi_umkm',
        payload: { umkm_id: id, terverifikasi: verified },
        label: verified ? 'Verifikasi toko' : 'Cabut verifikasi toko',
        summary: verified
          ? `Toko akan ditandai terverifikasi. Alasan: ${reason}`
          : `Verifikasi toko akan dicabut. Alasan: ${reason}`,
        targetType: 'umkm',
        targetId: id,
        reason,
      };
    }
    default:
      return null;
  }
}
