import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';
import { sanitizeSearchTermKeepingWords } from '@/lib/filter-search';

export const runtime = 'nodejs';

/**
 * GET /api/admin/products
 * Daftar produk untuk admin (khusus admin).
 *
 * Mengapa perlu endpoint ini (kebijakan auto-approve):
 *   Auto-approve membuat produk baru langsung `approved`, jadi antrean
 *   `verification_status = 'pending'` (endpoint /products/pending) nyaris
 *   selalu kosong. Admin tetap WAJIB bisa memantau produk yang sudah live
 *   agar bisa menunda penayangan / menonaktifkan / mengaktifkan kembali.
 *   Halaman ini adalah titik masuk tunggal untuk tiga status sekaligus:
 *   approved (live), rejected (ditunda/dinonaktifkan), dan pending (sisa
 *   lama yang belum ditinjau).
 *
 * Read-only. Tindakan status tetap lewat /products/:id/approve dan
 * /products/:id/reject yang sudah menyimpan moderation_logs.
 *
 * Akses data: TIDAK memakai service_role. Memakai authed server client
 * sehingga RLS tetap berlaku (products_select_admin dari 20261011000000).
 * Bila policy tersebut belum diterapkan di database, daftar ini kosong —
 * bukan bocor. Jangan longgarkan RLS untuk membuat halaman ini tampil.
 *
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

const PRODUCT_SELECT = [
  'id',
  'umkm_id',
  'slug',
  'name',
  'category',
  'image_url',
  'original_price',
  'surplus_price',
  'stock',
  'status',
  'verification_status',
  'rejection_reason',
  'reviewed_at',
  'created_at',
  'umkm:umkm_profiles(id, business_name, city, is_verified)',
].join(', ');

const VERIFICATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
const OPERATIONAL_STATUSES = ['available', 'sold_out', 'hidden'] as const;

type Row = Record<string, unknown>;

function asRecord(value: unknown): Row | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Row;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const admin = await getAdminUser(authHeader);
    if (!admin) {
      const user = await getUserFromBearer(authHeader);
      return NextResponse.json(
        { error: user ? 'Akses ditolak. Hanya admin.' : 'Unauthorized. Silakan login ulang.' },
        { status: user ? 403 : 401 }
      );
    }
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const rawLimit = Number(params.get('limit') ?? '20');
    const rawOffset = Number(params.get('offset') ?? '0');
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;
    const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;

    const verificationStatus = (params.get('verificationStatus') ?? '').trim();
    const status = (params.get('status') ?? '').trim();
    const umkmId = (params.get('umkmId') ?? '').trim();
    const q = (params.get('q') ?? '').trim();

    const db = createAuthedServerClient(authHeader);
    let query = db
      .from('products')
      .select(PRODUCT_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (verificationStatus) {
      if (!VERIFICATION_STATUSES.includes(verificationStatus as (typeof VERIFICATION_STATUSES)[number])) {
        return NextResponse.json({ error: 'Filter status verifikasi tidak dikenal.' }, { status: 400 });
      }
      query = query.eq('verification_status', verificationStatus);
    }
    if (status) {
      if (!OPERATIONAL_STATUSES.includes(status as (typeof OPERATIONAL_STATUSES)[number])) {
        return NextResponse.json({ error: 'Filter status operasional tidak dikenal.' }, { status: 400 });
      }
      query = query.eq('status', status);
    }
    if (umkmId) query = query.eq('umkm_id', umkmId);
    if (q) {
      // Pencarian teks bebas dibatasi ke dua kolom yang Meaningful untuk admin.
      // Catatan penting: postgrest-js TIDAK meng-escape argumen or(); ia
      // hanya menempelkan `(${filters})` ke query string. Jadi koma/kurung
      // dari input pengguna akan menambah kondisi filter (manipulasi struktur
      // filter PostgREST — bukan SQL injection, karena tiap nilai tetap di
      // bawah otorisasi RLS). Sanitasi memakai helper bersama yang teruji.
      //
      // Varian "keeping words": karakter struktur diganti spasi, bukan
      // dihapus, agar "kopi,susu" tetap dicari sebagai dua kata seperti
      // perilaku route ini sebelumnya.
      const escaped = sanitizeSearchTermKeepingWords(q);
      if (escaped) {
        query = query.or(`name.ilike.%${escaped}%,category.ilike.%${escaped}%`);
      }
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[admin/products] fetch error', error.message);
      return NextResponse.json({ error: 'Gagal memuat daftar produk.' }, { status: 500 });
    }

    const products = ((data ?? []) as unknown as Row[]).map((p) => {
      const umkm = asRecord(p.umkm);
      return {
        id: asString(p.id) ?? '',
        umkmId: asString(p.umkm_id),
        slug: asString(p.slug),
        name: asString(p.name) ?? '(tanpa nama)',
        category: asString(p.category),
        imageUrl: asString(p.image_url),
        originalPrice: asNumber(p.original_price),
        surplusPrice: asNumber(p.surplus_price),
        stock: asNumber(p.stock),
        status: asString(p.status),
        verificationStatus: asString(p.verification_status),
        rejectionReason: asString(p.rejection_reason),
        reviewedAt: asString(p.reviewed_at),
        createdAt: asString(p.created_at) ?? '',
        store: umkm
          ? {
              id: asString(umkm.id),
              businessName: asString(umkm.business_name) ?? 'Toko tanpa nama',
              city: asString(umkm.city),
              isVerified: umkm.is_verified === true,
            }
          : null,
      };
    });

    return NextResponse.json({
      products,
      total: count ?? products.length,
      limit,
      offset,
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/products] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses produk." }, { status: 500 });
  }
}