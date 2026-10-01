import { NextRequest, NextResponse } from 'next/server';
import { createAnonServerClient, createServiceClient, getSiteUrl, getUserFromBearer } from '@/lib/server/supabase';
import { createXenditInvoice } from '@/lib/server/xendit';
import { calculatePricing } from '@/lib/server/pricing';
import { estimateOrderMinutes } from '@/lib/delivery-estimate';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as {
      productSlug?: string;
      quantity?: number;
      fulfillment?: string;
      addressSnapshot?: Record<string, unknown> | null;
      promoCode?: string | null;
      useCoins?: boolean;
      distanceKm?: number | null;
    } | null;

    if (!body?.productSlug || !body.quantity || !body.fulfillment) {
      return NextResponse.json({ error: 'Payload tidak lengkap (productSlug, quantity, fulfillment wajib).' }, { status: 400 });
    }

    const quantity = Math.floor(body.quantity);
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
      return NextResponse.json({ error: 'Quantity tidak valid.' }, { status: 400 });
    }

    if (body.fulfillment !== 'delivery' && body.fulfillment !== 'pickup') {
      return NextResponse.json({ error: 'fulfillment harus delivery atau pickup.' }, { status: 400 });
    }

    if (body.fulfillment === 'delivery' && !body.addressSnapshot) {
      return NextResponse.json({ error: 'Alamat pengiriman wajib untuk delivery.' }, { status: 400 });
    }

    const anon = createAnonServerClient();
    const { data: product, error: prodErr } = await anon
      .from('products')
      .select('id, umkm_id, slug, name, surplus_price, original_price, stock, status, flash_sale_price, flash_sale_start, flash_sale_end, image_url, distance_km')
      .eq('slug', body.productSlug)
      .maybeSingle();

    if (prodErr) {
      console.error('[checkout/xendit] fetch product error', prodErr.message);
      return NextResponse.json({ error: 'Gagal mengambil data produk.' }, { status: 500 });
    }
    if (!product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    }

    if ((product.stock ?? 0) < quantity) {
      return NextResponse.json({ error: 'Stok tidak mencukupi.' }, { status: 400 });
    }
    if (product.status === 'sold_out' || product.status === 'hidden') {
      return NextResponse.json({ error: 'Produk sedang tidak tersedia.' }, { status: 400 });
    }

    let unitPrice = product.surplus_price ?? product.original_price ?? 0;
    if (
      product.flash_sale_price != null &&
      product.flash_sale_start &&
      product.flash_sale_end
    ) {
      const now = Date.now();
      const start = new Date(product.flash_sale_start).getTime();
      const end = new Date(product.flash_sale_end).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && now >= start && now < end) {
        unitPrice = product.flash_sale_price;
      }
    }
    if (!unitPrice || unitPrice <= 0) {
      return NextResponse.json({ error: 'Harga produk tidak valid.' }, { status: 500 });
    }

    let promoPercentOff: number | undefined;
    if (body.promoCode) {
      const code = String(body.promoCode).trim().toUpperCase();
      if (code) {
        const { data: promoRow } = await anon
          .from('promo_codes')
          .select('code, discount_percent, is_active, expires_at')
          .eq('code', code)
          .maybeSingle();
        
        const promoAny = promoRow as Record<string, unknown> | null;
        if (promoAny) {
          const isActive = promoAny.is_active !== false;
          const expiresAt = promoAny.expires_at as string | null;
          const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
          if (!isActive || expired) {
            return NextResponse.json({ error: 'Kode promo tidak valid atau sudah kadaluarsa.' }, { status: 400 });
          }
          const pct = (promoAny.discount_percent ?? promoAny.percent_off ?? promoAny.percentOff) as number | undefined;
          if (pct != null && pct > 0) promoPercentOff = pct;
        } else {
          return NextResponse.json({ error: 'Kode promo tidak ditemukan.' }, { status: 400 });
        }
      }
    }

    let coinBalance = 0;
    if (body.useCoins) {
      const service = createServiceClient();
      const { data: txs } = await service
        .from('coin_transactions')
        .select('amount, type')
        .eq('user_id', user.id);
      if (txs) {
        let earned = 0;
        let spent = 0;
        for (const row of txs as Array<{ amount: number; type: string }>) {
          const amt = Number(row.amount) || 0;
          if (row.type === 'earned') earned += amt;
          else if (row.type === 'spent') spent += amt;
        }
        coinBalance = Math.max(0, earned - spent);
      }
    }

    const pricing = calculatePricing({
      unitPrice,
      quantity,
      fulfillment: body.fulfillment as 'delivery' | 'pickup',
      promoPercentOff,
      useCoins: !!body.useCoins,
      coinBalance,
    });

    // Vendor info untuk snapshot
    let vendorName = 'Toko';
    let vendorAddress: string | null = null;
    let vendorOpenHours: string | null = null;
    // products tidak punya kolom vendor_slug - slug toko wajib diambil dari
    // umkm_profiles agar pesanan tercatat ke penjual yang tepat dan muncul
    // di dashboard "Pesanan Masuk" miliknya.
    let vendorSlug = (product as Record<string, unknown>).vendor_slug as string | undefined ?? '';
    if (product.umkm_id) {
      const { data: vendor } = await anon
        .from('umkm_profiles')
        .select('business_name, address, open_hours, slug')
        .eq('id', product.umkm_id)
        .maybeSingle();
      if (vendor) {
        const vendorInfo = vendor as Record<string, unknown>;
        vendorName = vendorInfo.business_name as string ?? vendorName;
        vendorAddress = vendorInfo.address as string | null;
        vendorOpenHours = vendorInfo.open_hours as string | null;
        vendorSlug = (vendorInfo.slug as string | undefined) ?? vendorSlug;
      }
    }

    const productName = (product as Record<string, unknown>).name as string ?? 'Produk';
    const imageUrl = (product as Record<string, unknown>).image_url as string ?? '';

    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const orderCode = `RB-${stamp}${rand}`;
    const nowIso = new Date().toISOString();

    const rawDistanceKm =
      (typeof body.distanceKm === 'number' && Number.isFinite(body.distanceKm) ? body.distanceKm : null) ??
      Number((product as Record<string, unknown>).distance_km ?? 1);
    const distanceKm = Math.max(0, Number.isFinite(rawDistanceKm) ? rawDistanceKm : 1);
    // vendorSlug untuk preparation time; fallback ke product slug
    const estimateVendorSlug = vendorSlug || body.productSlug;
    const estimate = estimateOrderMinutes({
      fulfillment: body.fulfillment as 'delivery' | 'pickup',
      distanceKm,
      vendorSlug: estimateVendorSlug,
    });
    const estimatedMinutes = estimate.estimatedMinutes;
    const estimatedCompletionAt = new Date(Date.now() + estimatedMinutes * 60_000).toISOString();

    const serviceClient = createServiceClient();
    const { data: reserved, error: reserveErr } = await serviceClient.rpc('reserve_stock', {
      p_slug: body.productSlug,
      p_quantity: quantity,
    });
    if (reserveErr) {
      console.error('[checkout/xendit] reserve_stock error', reserveErr.message);
      return NextResponse.json({ error: 'Gagal mengunci stok. Coba lagi.' }, { status: 500 });
    }
    if (reserved !== true) {
      return NextResponse.json({ error: 'Stok tidak mencukupi, pesanan dibatalkan.' }, { status: 400 });
    }

    if (pricing.total === 0) {
      const { error: insertErr } = await serviceClient.from('orders').insert({
        order_code: orderCode,
        buyer_id: user.id,
        
        umkm_id: product.umkm_id ?? null,
        product_id: product.id ?? null,
        product_slug: body.productSlug,
        product_name: productName,
        vendor_name: vendorName,
        vendor_slug: vendorSlug,
        image_url: imageUrl,
        quantity,
        delivery_option: body.fulfillment,
        address_snapshot: body.fulfillment === 'delivery' ? body.addressSnapshot : null,
        payment_method_id: 'rebites-coin',
        unit_price: unitPrice,
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        service_fee: pricing.serviceFee,
        delivery_fee: pricing.deliveryFee,
        total_before_coin: pricing.totalBeforeCoin,
        coin_used: pricing.coinUsed,
        total_price: 0,
        coin_earned: pricing.coinEarned,
        promo_code: body.promoCode?.toUpperCase() ?? null,
        lifecycle_status: 'ongoing',
        progress_status: 'disiapkan',
        estimated_minutes: estimatedMinutes,
        estimated_completion_at: estimatedCompletionAt,
        distance_km: distanceKm,
        preparation_minutes: estimate.preparationMinutes,
        vendor_address: vendorAddress,
        vendor_open_hours: vendorOpenHours,
        payment_status: 'paid',
        order_status: 'paid',
        co2e_saved_kg: null,
      });
      if (insertErr) {
        
        await serviceClient.rpc('release_stock', { p_slug: body.productSlug, p_quantity: quantity });
        console.error('[checkout/xendit] insert free order error', insertErr.message, { orderCode, productSlug: body.productSlug });
        return NextResponse.json({ error: 'Gagal membuat pesanan.' }, { status: 500 });
      }

      if (pricing.coinUsed > 0 || pricing.coinEarned > 0) {
        const pending: Record<string, unknown>[] = [];
        if (pricing.coinUsed > 0) {
          pending.push({ user_id: user.id, order_code: orderCode, type: 'spent', amount: pricing.coinUsed, description: 'Potongan pesanan' });
        }
        if (pricing.coinEarned > 0) {
          pending.push({ user_id: user.id, order_code: orderCode, type: 'earned', amount: pricing.coinEarned, description: 'Reward pembelian' });
        }
        const { error: coinErr } = await serviceClient.from('coin_transactions').insert(pending);
        if (coinErr) console.error('[checkout/xendit] coin settle error', coinErr.message, { orderCode });
      }

      const siteUrl = getSiteUrl();
      const deepHref = `/riwayatPesanan?orderId=${encodeURIComponent(orderCode)}`;
      const { error: notifErr } = await serviceClient.from('notifications').insert([
        {
          user_id: user.id,
          role: 'buyer',
          type: 'payment_success',
          title: 'Pembayaran Berhasil',
          message: `Pesanan ${productName} lunas sepenuhnya dengan ReBites Coin. Estimasi selesai ${estimatedMinutes} menit.`,
          reference_id: orderCode,
          href: deepHref,
        },
        {
          user_id: user.id,
          role: 'buyer',
          type: 'order_created',
          title: 'Pesanan Sedang Disiapkan',
          message: `Pesanan #${orderCode} dari ${vendorName} sedang disiapkan. Estimasi ${estimatedMinutes} menit (${estimate.preparationMinutes} menit persiapan${estimate.travelMinutes > 0 ? ` + ${estimate.travelMinutes} menit pengantaran` : ''}).`,
          reference_id: orderCode,
          href: deepHref,
        },
      ]);
      if (notifErr) console.error('[checkout/xendit] notif free error', notifErr.message);

      const freeStoredOrder = {
        orderId: orderCode,
        userId: user.id,
        productId: body.productSlug,
        productName,
        vendorName,
        vendorSlug,
        image: imageUrl,
        quantity,
        fulfillment: body.fulfillment,
        addressSnapshot: body.fulfillment === 'delivery' ? body.addressSnapshot : null,
        paymentMethodId: 'rebites-coin',
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        serviceFee: pricing.serviceFee,
        deliveryFee: pricing.deliveryFee,
        totalBeforeCoin: pricing.totalBeforeCoin,
        coinUsed: pricing.coinUsed,
        total: 0,
        coinEarned: pricing.coinEarned,
        createdAt: nowIso,
        unitPrice,
        promoCode: body.promoCode?.toUpperCase() ?? null,
        status: 'ongoing' as const,
        estimatedMinutes,
        estimatedCompletionAt,
        completedAt: undefined,
        distanceKm,
        preparationMinutes: estimate.preparationMinutes,
        vendorAddress,
        vendorOpenHours,
        co2eSavedKg: undefined,
      };

      return NextResponse.json({
        orderCode,
        invoiceUrl: `${siteUrl}/detail/pesanan/sukses?orderId=${encodeURIComponent(orderCode)}`,
        free: true,
        order: freeStoredOrder,
      });
    }

    const siteUrl = getSiteUrl();
    const successUrl = `${siteUrl}/detail/pesanan/sukses?orderId=${encodeURIComponent(orderCode)}`;
    const failureUrl = `${siteUrl}/riwayatPesanan?orderId=${encodeURIComponent(orderCode)}&payment=failed`;

    const insertPayload: Record<string, unknown> = {
      order_code: orderCode,
      buyer_id: user.id,
      umkm_id: product.umkm_id ?? null,
      product_id: product.id ?? null,
      product_slug: body.productSlug,
      product_name: productName,
      vendor_name: vendorName,
      vendor_slug: vendorSlug,
      image_url: imageUrl,
      quantity,
      delivery_option: body.fulfillment,
      address_snapshot: body.fulfillment === 'delivery' ? body.addressSnapshot : null,
      payment_method_id: 'xendit',
      unit_price: unitPrice,
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      service_fee: pricing.serviceFee,
      delivery_fee: pricing.deliveryFee,
      total_before_coin: pricing.totalBeforeCoin,
      coin_used: pricing.coinUsed,
      total_price: pricing.total,
      coin_earned: pricing.coinEarned,
      promo_code: body.promoCode?.toUpperCase() ?? null,
      lifecycle_status: 'ongoing',
      progress_status: 'disiapkan',
      estimated_minutes: estimatedMinutes,
      estimated_completion_at: estimatedCompletionAt,
      distance_km: distanceKm,
      preparation_minutes: estimate.preparationMinutes,
      vendor_address: vendorAddress,
      vendor_open_hours: vendorOpenHours,
      payment_status: 'unpaid',
      order_status: 'pending',
      created_at: nowIso,
    };

    const { error: insertErr } = await serviceClient.from('orders').insert(insertPayload);
    if (insertErr) {
      console.error('[checkout/xendit] insert order error', insertErr.message);

      if (insertErr.message.includes('umkm_id') || insertErr.message.includes('product_id')) {
        // Skema DB lama tanpa kolom umkm_id/product_id - coba ulang tanpa snapshot relasi.
        // PENTING: stok TIDAK dilepas dulu di sini. Jika retry berhasil, stok yang
        // sudah dikunci reserve_stock tetap terpakai (mencegah oversell).
        const retry = { ...insertPayload };
        delete (retry as Record<string, unknown>).umkm_id;
        delete (retry as Record<string, unknown>).product_id;
        const { error: retryErr } = await serviceClient.from('orders').insert(retry);
        if (retryErr) {
          await serviceClient.rpc('release_stock', { p_slug: body.productSlug, p_quantity: quantity });
          console.error('[checkout/xendit] retry insert error', retryErr.message);
          return NextResponse.json({ error: 'Gagal membuat pesanan (DB).' }, { status: 500 });
        }
      } else {
        // Insert gagal total - kembalikan stok yang sudah dikunci agar tidak bocor.
        await serviceClient.rpc('release_stock', { p_slug: body.productSlug, p_quantity: quantity });
        return NextResponse.json({ error: 'Gagal membuat pesanan.' }, { status: 500 });
      }
    }

    let invoice;
    try {
      invoice = await createXenditInvoice({
        externalId: orderCode,
        amount: pricing.total,
        payerEmail: user.email,
        description: `ReBites #${orderCode} - ${productName} x${quantity}`,
        successRedirectUrl: successUrl,
        failureRedirectUrl: failureUrl,
      });
    } catch (e: unknown) {
      // Roll back the pending order + reserved stock, then fail the request.
      await serviceClient.from('orders').delete().eq('order_code', orderCode);
      await serviceClient.rpc('release_stock', { p_slug: body.productSlug, p_quantity: quantity });
      console.error('[checkout/xendit] xendit error', e instanceof Error ? e.message : e);
      return NextResponse.json(
        { error: 'Gagal membuat invoice pembayaran. Silakan coba lagi.' },
        { status: 502 },
      );
    }

    await serviceClient
      .from('orders')
      .update({ xendit_invoice_id: invoice.id })
      .eq('order_code', orderCode);

    const deepHref = `/riwayatPesanan?orderId=${encodeURIComponent(orderCode)}`;
    const { error: notifErr } = await serviceClient.from('notifications').insert({
      user_id: user.id,
      role: 'buyer',
      type: 'order_created',
      title: 'Pesanan Dibuat',
      message: `Pesanan #${orderCode} (${productName} x${quantity}) dari ${vendorName} sudah dibuat. Selesaikan pembayaran agar pesanan segera diproses.`,
      reference_id: orderCode,
      href: deepHref,
    });
    if (notifErr) console.error('[checkout/xendit] notif order_created error', notifErr.message);

    return NextResponse.json({
      orderCode,
      invoiceUrl: invoice.invoice_url,
      invoiceId: invoice.id,
      amount: pricing.total,
    });
  } catch (err: unknown) {
    console.error('[checkout/xendit] unexpected', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
