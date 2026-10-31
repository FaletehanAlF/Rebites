import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';

export const runtime = 'nodejs';

const MAX_BODY_LENGTH = 1000;

/**
 * GET  /api/courier/messages?orderId=... — daftar pesan percakapan.
 * POST /api/courier/messages — kirim pesan.
 *
 * PESERTA percakapan: pembeli pesanan itu, dan kurir yang DITUGASKAN pada
 * pesanan itu. Penjual boleh MEMBACA (memantau percakapan) tapi tidak
 * boleh menulis — dia bukan pihak yang mengantar.
 *
 * RLS di database sudah membatasi itu; server juga memeriksanya supaya
 * penolakan terjadi lebih awal dan pesannya jelas.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Silakan login ulang.' },
        { status: 401 }
      );
    }

    const orderId = req.nextUrl.searchParams.get('orderId')?.trim() ?? '';
    if (!orderId) {
      return NextResponse.json({ error: 'orderId wajib diisi.' }, { status: 400 });
    }

    const supabase = createAuthedServerClient(authHeader as string);

    const { data, error } = await supabase
      .from('courier_messages')
      .select('id, sender_user_id, body, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('[courier/messages] gagal membaca pesan:', error.message);
      return NextResponse.json({ error: 'Gagal memuat pesan.' }, { status: 500 });
    }

    return NextResponse.json({
      messages: ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        senderUserId: String(row.sender_user_id),
        body: String(row.body ?? ''),
        createdAt: row.created_at ? String(row.created_at) : null,
        isMine: row.sender_user_id === user.id,
      })),
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[courier/messages] unexpected', err);
    return NextResponse.json({ error: 'Gagal memuat pesan.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Silakan login ulang.' },
        { status: 401 }
      );
    }

    let body: { orderId?: unknown; message?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
    }

    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!orderId) {
      return NextResponse.json({ error: 'orderId wajib diisi.' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: 'Pesan tidak boleh kosong.' }, { status: 400 });
    }
    if (message.length > MAX_BODY_LENGTH) {
      return NextResponse.json(
        { error: `Pesan maksimal ${MAX_BODY_LENGTH} karakter.` },
        { status: 400 }
      );
    }

    const supabase = createAuthedServerClient(authHeader as string);

    // Pesan hanya boleh dikirim oleh pembeli pesanan itu atau kurirnya.
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, buyer_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr) {
      console.error('[courier/messages] gagal membaca pesanan:', orderErr.message);
      return NextResponse.json({ error: 'Gagal memuat pesanan.' }, { status: 500 });
    }
    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    const isBuyer = order.buyer_id === user.id;
    let isCourier = false;
    if (!isBuyer) {
      const { data: assignment } = await supabase
        .from('delivery_assignments')
        .select('courier_user_id')
        .eq('order_id', orderId)
        .maybeSingle();
      isCourier = assignment?.courier_user_id === user.id;
    }

    if (!isBuyer && !isCourier) {
      return NextResponse.json(
        { error: 'Anda bukan peserta percakapan pesanan ini.' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('courier_messages')
      .insert({
        order_id: orderId,
        sender_user_id: user.id,
        body: message,
      })
      .select('id, sender_user_id, body, created_at')
      .maybeSingle();

    if (error) {
      console.error('[courier/messages] gagal mengirim pesan:', error.message);
      return NextResponse.json({ error: 'Gagal mengirim pesan.' }, { status: 500 });
    }

    const row = data as Record<string, unknown> | null;
    return NextResponse.json({
      message: {
        id: String(row?.id ?? ''),
        senderUserId: user.id,
        body: message,
        createdAt: row?.created_at ? String(row.created_at) : new Date().toISOString(),
        isMine: true,
      },
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[courier/messages] unexpected', err);
    return NextResponse.json({ error: 'Gagal mengirim pesan.' }, { status: 500 });
  }
}
