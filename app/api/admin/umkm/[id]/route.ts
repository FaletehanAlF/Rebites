import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';

export const runtime = 'nodejs';

/**
 * GET /api/admin/umkm/:id
 * Detail satu UMKM untuk admin (read-only).
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

const UMKM_DETAIL_SELECT = [
  'id',
  'user_id',
  'business_name',
  'description',
  'category',
  'address',
  'city',
  // origin foundation (kolom baru nullable, backward compat).
  'postal_code',
  'phone',
  'latitude',
  'longitude',
  'logo_url',
  'slug',
  'is_verified',
  'rating',
  'is_open',
  'open_hours',
  'tagline',
  'owner_name',
  'partner_tier',
  'followers',
  'member_since',
  'response_time',
  'porsi_terselamatkan',
  'co2e_saved_kg',
  'created_at',
].join(', ');

const PRODUCT_SUMMARY_LIMIT = 15;

type Row = Record<string, unknown>;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const id = params.id?.trim();
    if (!id) {
      return NextResponse.json({ error: 'ID UMKM wajib.' }, { status: 400 });
    }

    const db = createAuthedServerClient(authHeader);

    const { data: umkm, error: umkmErr } = await db
      .from('umkm_profiles')
      .select(UMKM_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (umkmErr) {
      console.error('[admin/umkm/detail] fetch error', umkmErr.message);
      return NextResponse.json({ error: 'Gagal memuat detail UMKM.' }, { status: 500 });
    }
    if (!umkm) {
      return NextResponse.json({ error: 'UMKM tidak ditemukan.' }, { status: 404 });
    }

    const row = (umkm as unknown) as Row;
    const userId = typeof row.user_id === 'string' ? row.user_id : null;

    const [ownerRes, subRes, productsRes] = await Promise.all([
      userId
        ? db
            .from('profiles')
            .select('id, full_name, email, role')
            .eq('id', userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      db
        .from('subscriptions')
        .select(
          'id, status, billing, price_paid, current_period_start, current_period_end, plans(id, slug, name, max_products, features)'
        )
        .eq('umkm_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('products')
        .select(
          'id, name, description, image_url, category, original_price, surplus_price, stock, status, verification_status, rejection_reason, reviewed_at, weight_gram, length_cm, width_cm, height_cm, is_delivery, is_pickup, created_at, updated_at'
        )
        .eq('umkm_id', id)
        .order('created_at', { ascending: false })
        .limit(PRODUCT_SUMMARY_LIMIT),
    ]);

    if (ownerRes.error) {
      console.error('[admin/umkm/detail] owner error', ownerRes.error.message);
    }
    if (subRes.error) {
      console.error('[admin/umkm/detail] subscription error', subRes.error.message);
    }
    if (productsRes.error) {
      console.error('[admin/umkm/detail] products error', productsRes.error.message);
    }

    const owner = ownerRes.data ? ((ownerRes.data as unknown) as Row) : null;
    const sub = subRes.data ? ((subRes.data as unknown) as Row) : null;
    const plan =
      sub && sub.plans && typeof sub.plans === 'object' && !Array.isArray(sub.plans)
        ? (sub.plans as Row)
        : null;
    const products = (((productsRes.data ?? []) as unknown) as Row[]).map((p) => ({
      id: p.id ?? null,
      name: p.name ?? 'Tidak diketahui',
      description: (p.description as string | null) ?? null,
      image_url: p.image_url ?? null,
      category: p.category ?? null,
      original_price: p.original_price ?? null,
      surplus_price: p.surplus_price ?? null,
      stock: p.stock ?? null,
      status: (p.status as string | null) ?? null,
      verification_status: p.verification_status ?? null,
      rejection_reason: (p.rejection_reason as string | null) ?? null,
      reviewed_at: (p.reviewed_at as string | null) ?? null,
      weight_gram: (p.weight_gram as number | null) ?? null,
      length_cm: (p.length_cm as number | null) ?? null,
      width_cm: (p.width_cm as number | null) ?? null,
      height_cm: (p.height_cm as number | null) ?? null,
      is_delivery: (p.is_delivery as boolean | null) ?? null,
      is_pickup: (p.is_pickup as boolean | null) ?? null,
      created_at: p.created_at ?? null,
      updated_at: (p.updated_at as string | null) ?? null,
    }));

    return NextResponse.json({
      umkm: {
        id: row.id ?? null,
        user_id: row.user_id ?? null,
        business_name: row.business_name ?? 'Tidak diketahui',
        description: row.description ?? null,
        category: row.category ?? null,
        address: row.address ?? null,
        city: row.city ?? null,
        postal_code: row.postal_code ?? null,
        phone: row.phone ?? null,
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        logo_url: row.logo_url ?? null,
        slug: row.slug ?? null,
        is_verified: row.is_verified ?? false,
        rating: row.rating ?? null,
        is_open: row.is_open ?? null,
        open_hours: row.open_hours ?? null,
        tagline: row.tagline ?? null,
        owner_name: row.owner_name ?? null,
        partner_tier: row.partner_tier ?? null,
        followers: row.followers ?? null,
        member_since: row.member_since ?? null,
        response_time: row.response_time ?? null,
        porsi_terselamatkan: row.porsi_terselamatkan ?? null,
        co2e_saved_kg: row.co2e_saved_kg ?? null,
        created_at: row.created_at ?? null,
      },
      owner: owner
        ? {
            id: owner.id ?? null,
            full_name: owner.full_name ?? null,
            email: owner.email ?? null,
            role: owner.role ?? null,
          }
        : null,
      subscription: sub
        ? {
            id: sub.id ?? null,
            status: sub.status ?? null,
            billing: sub.billing ?? null,
            price_paid: sub.price_paid ?? null,
            current_period_start: sub.current_period_start ?? null,
            current_period_end: sub.current_period_end ?? null,
            plan: plan
              ? {
                  id: plan.id ?? null,
                  slug: plan.slug ?? null,
                  name: plan.name ?? null,
                  max_products: plan.max_products ?? null,
                  features: plan.features ?? null,
                }
              : null,
          }
        : null,
      products,
      product_total: products.length,
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/umkm/detail] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses data UMKM." }, { status: 500 });
  }
}
