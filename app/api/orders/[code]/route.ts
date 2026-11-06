import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getUserFromBearer } from '@/lib/server/supabase';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const code = params.code?.trim();
    if (!code) {
      return NextResponse.json({ error: 'orderCode wajib' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = createServiceClient();
    const { data: order, error } = await service
      .from('orders')
      .select('*')
      .eq('order_code', code)
      .maybeSingle();

    if (error) {
      console.error('[orders/[code]] fetch error', error.message);
      return NextResponse.json({ error: 'Gagal memuat pesanan' }, { status: 500 });
    }
    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    const isBuyer = (order as Record<string, unknown>).buyer_id === user.id;
    let isSeller = false;
    if (!isBuyer) {
      const umkmId = (order as Record<string, unknown>).umkm_id as string | null;
      if (umkmId) {
        const { data: umkm } = await service
          .from('umkm_profiles')
          .select('user_id')
          .eq('id', umkmId)
          .maybeSingle();
        isSeller = (umkm as Record<string, unknown>)?.user_id === user.id;
      }
      
      if (!isSeller && (order as Record<string, unknown>).vendor_slug) {
        const slug = (order as Record<string, unknown>).vendor_slug as string;
        const { data: umkm2 } = await service
          .from('umkm_profiles')
          .select('user_id')
          .eq('slug', slug)
          .maybeSingle();
        isSeller = (umkm2 as Record<string, unknown>)?.user_id === user.id;
      }
    }

    if (!isBuyer && !isSeller) {
      
      const { data: profile } = await service
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      const isAdmin = (profile as Record<string, unknown>)?.role === 'admin';
      if (!isAdmin) {
        return NextResponse.json({ error: 'Tidak berhak melihat pesanan ini' }, { status: 403 });
      }
    }

    return NextResponse.json({ order });
  } catch (err) {
    console.error('[orders/[code]] unexpected', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memuat pesanan' },
      { status: 500 },
    );
  }
}
