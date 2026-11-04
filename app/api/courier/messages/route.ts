import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  createServiceClient,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';
import { buildDemoCourierReply } from '@/lib/demo-courier';
import { generateDemoCourierAiReply } from '@/lib/server/courier-ai';
import { normalizeCourierSenderKind } from '@/lib/courier-sender-kind';

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

    /**
     * Baca pesan dengan kolom demo.
     *
     * Bila migrasi kurir demo belum diterapkan, kolom `sender_kind` belum ada
     * dan query akan gagal. Tanpa fallback ini, SELURUH chat ikut rusak
     * hanya karena fitur demo belum aktif. Percobaan kedua memakai kolom
     * lama, dan semua pesan diperlakukan sebagai pesan pengguna.
     */
    let usedDemoColumns = true;
    let data: Array<Record<string, unknown>> | null = null;
    let error: { message: string } | null = null;

    {
      const first = await supabase
        .from('courier_messages')
        .select('id, sender_user_id, sender_kind, body, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })
        .limit(200);
      data = (first.data ?? null) as Array<Record<string, unknown>> | null;
      error = first.error;
    }

    if (error) {
      usedDemoColumns = false;
      const fallbackQuery = await supabase
        .from('courier_messages')
        .select('id, sender_user_id, body, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })
        .limit(200);
      data = (fallbackQuery.data ?? null) as Array<Record<string, unknown>> | null;
      error = fallbackQuery.error;
    }

    if (error) {
      console.error('[courier/messages] gagal membaca pesan:', error.message);
      return NextResponse.json({ error: 'Gagal memuat pesan.' }, { status: 500 });
    }

    return NextResponse.json({
      messages: ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        senderUserId: row.sender_user_id ? String(row.sender_user_id) : null,
        // `demo_courier` = balasan otomatis simulasi. UI WAJIB melabelinya,
        // supaya pembeli tidak mengira sedang mengobrol dengan orang.
        senderKind: usedDemoColumns
          ? normalizeCourierSenderKind(row.sender_kind)
          : 'user',
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
        sender_kind: 'user',
        body: message,
      })
      .select('id, sender_user_id, body, created_at')
      .maybeSingle();

    if (error) {
      console.error('[courier/messages] gagal mengirim pesan:', error.message);
      return NextResponse.json({ error: 'Gagal mengirim pesan.' }, { status: 500 });
    }

    /**
     * Balasan OTOMATIS HANYA untuk pesanan DEMO (`delivery_assignments.is_demo`).
     *
     * Urutan:
     * 1. Bila `GEMINI_API_KEY` diisi, pakai Gemini (Kurir AI) — baris
     *    disimpan dengan `sender_kind = 'ai_courier'`.
     * 2. Bila Gemini tidak dikonfigurasi, pakai balasan Kurir Demo
     *    deterministik seperti sebelumnya (`sender_kind = 'demo_courier'`).
     * 3. Bila Gemini gagal / kena rate limit, jangan gagalkan pengiriman
     *    pesan pembeli; respons membawa `aiReply.status = 'failed'` beserta
     *    pesan ramah yang aman (tanpa detail internal).
     *
     * Pesanan kurir sungguhan tidak pernah dibalas otomatis di jalur ini.
     */
    let aiReply: { status: string; message?: string } | undefined;
    if (isBuyer) {
      try {
        const service = createServiceClient();
        const { data: demoAssignment } = await service
          .from('delivery_assignments')
          .select('is_demo')
          .eq('order_id', orderId)
          .maybeSingle();

        if (demoAssignment?.is_demo) {
          const { data: orderRow } = await service
            .from('orders')
            .select('order_code, order_status')
            .eq('id', orderId)
            .maybeSingle();

          const orderCode = String(orderRow?.order_code ?? '');
          const orderStatus = String(orderRow?.order_status ?? 'processing');

          const outcome = await generateDemoCourierAiReply({
            userId: user.id,
            orderCode,
            orderStatus,
            message,
          });

          if (outcome.ok) {
            await service.from('courier_messages').insert({
              order_id: orderId,
              sender_user_id: null,
              sender_kind: 'ai_courier',
              body: outcome.reply,
            });
            aiReply = { status: 'sent' };
          } else if (outcome.reason === 'not_configured') {
            const reply = buildDemoCourierReply({
              message,
              stage: orderStatus,
              orderCode,
            });
            await service.from('courier_messages').insert({
              order_id: orderId,
              sender_user_id: null,
              sender_kind: 'demo_courier',
              body: reply,
            });
            aiReply = { status: 'fallback' };
          } else {
            aiReply = { status: 'failed', message: outcome.message };
          }
        }
      } catch (replyErr) {
        const safe = replyErr instanceof Error ? replyErr.message : String(replyErr);
        console.error('[courier/messages] gagal membalas sebagai Kurir AI:', safe);
        aiReply = {
          status: 'failed',
          message: 'Kurir AI sedang tidak dapat menjawab. Coba lagi sebentar.',
        };
      }
    }

    const row = data as Record<string, unknown> | null;
    return NextResponse.json({
      message: {
        id: String(row?.id ?? ''),
        senderUserId: user.id,
        senderKind: 'user',
        body: message,
        createdAt: row?.created_at ? String(row.created_at) : new Date().toISOString(),
        isMine: true,
      },
      /** Status upaya balasan AI (hanya untuk pesanan demo + pengirim pembeli). */
      aiReply,
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[courier/messages] unexpected', err);
    return NextResponse.json({ error: 'Gagal mengirim pesan.' }, { status: 500 });
  }
}
