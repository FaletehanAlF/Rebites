import { NextRequest, NextResponse } from 'next/server';
import { createAnonServerClient, createServiceClient, getSiteUrl, getUserFromBearer } from '@/lib/server/supabase';
import { createXenditInvoice } from '@/lib/server/xendit';
import { calculatePricing } from '@/lib/server/pricing';
import { getBiteshipRates, getConfiguredCouriers, type BiteshipRateItem } from '@/lib/server/biteship';
import { estimateOrderMinutes } from '@/lib/delivery-estimate';
import { parseDistanceKm, sanitizeAddressSnapshot } from '@/lib/location-validation';

export const runtime = 'nodejs';

const POSTAL_CODE_RE = /^[0-9]{5}$/;

/**
 * 7B-2D-1: mapping berat/dimensi dari DB. NULL = belum diketahui
 * (produk legacy / seller belum mengisi). Tanpa default/fallback.
 */
function toPackageInt(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  const int = Math.floor(num);
  return int >= 1 ? int : null;
}

/**
 * 7B-2D-2: mapping koordinat origin dari DB. NULL = belum diketahui
 * (tanpa map-picker/geocoding). Tidak pernah mengarang koordinat.
 */
function toOriginCoordinate(value: unknown, min: number, max: number): number | null {
  if (value == null) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

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
      // 7C-2C: identifier pilihan kurir (bukan harga/nama). Harga selalu revalidasi server.
      courierCode?: string | null;
      courierServiceCode?: string | null;
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

    // 7B-1: sanitasi snapshot (additive: addressId + postal + lat/lng).
    // pickup -> NULL (behavior lama). delivery -> snapshot tervalidasi.
    // Legacy NULL boleh; isi non-kosong harus valid. Tanpa provider shipping.
    let addressSnapshot: Record<string, unknown> | null = null;
    if (body.fulfillment === 'delivery') {
      const { snapshot, error } = sanitizeAddressSnapshot(body.addressSnapshot);
      if (error || !snapshot) {
        return NextResponse.json({ error: error ?? 'Alamat pengiriman tidak valid.' }, { status: 400 });
      }
      addressSnapshot = snapshot as unknown as Record<string, unknown>;
    }

    const anon = createAnonServerClient();
    const { data: product, error: prodErr } = await anon
      .from('products')
      // 7B-2D-1: kolom shipping ikut dibaca (sumber kebenaran package).
      .select('id, umkm_id, slug, name, surplus_price, original_price, stock, status, verification_status, flash_sale_price, flash_sale_start, flash_sale_end, image_url, distance_km, is_delivery, is_pickup, weight_gram, length_cm, width_cm, height_cm')
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
    // Produk pending/rejected tidak boleh di-checkout walau ID/slug diketahui.
    // Cek server-side (jangan andalkan frontend); products.status tidak diubah.
    if ((product as Record<string, unknown>).verification_status !== 'approved') {
      return NextResponse.json({ error: 'Produk belum diverifikasi admin dan tidak dapat dipesan.' }, { status: 400 });
    }
    // 7B-2B: tegakkan kapabilitas fulfillment dari database.
    // Jangan percaya flag is_delivery/is_pickup dari request body —
    // server membaca langsung kolom products. Client yang memaksa
    // fulfillment di luar kapabilitas tetap ditolak di sini.
    const productIsDelivery =
      (product as Record<string, unknown>).is_delivery === true;
    const productIsPickup =
      (product as Record<string, unknown>).is_pickup === true;
    if (!productIsDelivery && !productIsPickup) {
      return NextResponse.json({ error: 'Produk ini sedang tidak tersedia untuk dipesan.' }, { status: 400 });
    }
    if (body.fulfillment === 'delivery' && !productIsDelivery) {
      return NextResponse.json({ error: 'Produk ini tidak tersedia untuk diantar. Silakan pilih Ambil Sendiri.' }, { status: 400 });
    }
    if (body.fulfillment === 'pickup' && !productIsPickup) {
      return NextResponse.json({ error: 'Produk ini tidak tersedia untuk diambil sendiri. Silakan pilih Diantar.' }, { status: 400 });
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
        // Kolom kanonis sesuai skema DB (migrasi 0003 + seed 0004):
        // promo_codes(code, percent_off, is_valid, expires_at, ...).
        // Jangan select nama kolom lain (discount_percent/is_active) —
        // PostgREST error untuk kolom tak dikenal dan semua promo valid
        // akan tertolak 400.
        const { data: promoRow, error: promoErr } = await anon
          .from('promo_codes')
          .select('code, percent_off, is_valid, expires_at')
          .eq('code', code)
          .maybeSingle();

        const promoAny = promoRow as Record<string, unknown> | null;
        if (promoErr || !promoAny) {
          return NextResponse.json({ error: 'Kode promo tidak ditemukan.' }, { status: 400 });
        }
        const isActive = promoAny.is_valid !== false;
        const expiresAt = promoAny.expires_at as string | null;
        const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
        if (!isActive || expired) {
          return NextResponse.json({ error: 'Kode promo tidak valid atau sudah kadaluarsa.' }, { status: 400 });
        }
        const pct = promoAny.percent_off as number | undefined;
        if (pct != null && Number.isFinite(Number(pct)) && Number(pct) > 0) {
          promoPercentOff = Number(pct);
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

    // 7C-2C: calculatePricing dipanggil SETELAH revalidasi Biteship di bawah,
    // supaya deliveryFee delivery berasal dari rate ter-validasi.

    // Vendor info untuk snapshot
    let vendorName = 'Toko';
    let vendorAddress: string | null = null;
    let vendorOpenHours: string | null = null;
    // 7B-2D-2: origin shipping tambahan (NULL = seller belum mengisi).
    let vendorCity: string | null = null;
    let vendorPostalCode: string | null = null;
    let vendorPhone: string | null = null;
    let vendorLatitude: number | null = null;
    let vendorLongitude: number | null = null;
    // products tidak punya kolom vendor_slug - slug toko wajib diambil dari
    // umkm_profiles agar pesanan tercatat ke penjual yang tepat dan muncul
    // di dashboard "Pesanan Masuk" miliknya.
    let vendorSlug = (product as Record<string, unknown>).vendor_slug as string | undefined ?? '';
    if (product.umkm_id) {
      const { data: vendor } = await anon
        .from('umkm_profiles')
        // 7B-2D-2: kolom origin shipping ikut dibaca (server-authoritative).
        .select('business_name, address, city, postal_code, phone, latitude, longitude, open_hours, slug')
        .eq('id', product.umkm_id)
        .maybeSingle();
      if (vendor) {
        const vendorInfo = vendor as Record<string, unknown>;
        vendorName = vendorInfo.business_name as string ?? vendorName;
        vendorAddress = vendorInfo.address as string | null;
        vendorOpenHours = vendorInfo.open_hours as string | null;
        vendorSlug = (vendorInfo.slug as string | undefined) ?? vendorSlug;
        // 7B-2D-2: origin tambahan dari DB. NULL = seller belum mengisi.
        // String kosong diperlakukan sebagai NULL (tanpa fallback palsu).
        const cityRaw = vendorInfo.city;
        vendorCity = typeof cityRaw === 'string' && cityRaw.trim() ? cityRaw.trim() : null;
        const postalRaw = vendorInfo.postal_code;
        vendorPostalCode = typeof postalRaw === 'string' && postalRaw.trim() ? postalRaw.trim() : null;
        const phoneRaw = vendorInfo.phone;
        vendorPhone = typeof phoneRaw === 'string' && phoneRaw.trim() ? phoneRaw.trim() : null;
        vendorLatitude = toOriginCoordinate(vendorInfo.latitude, -90, 90);
        vendorLongitude = toOriginCoordinate(vendorInfo.longitude, -180, 180);
      }
    }
    // 7B-2D-2: origin shipping internal (server-authoritative, dari DB saja).
    // Tidak ada nilai origin yang dibaca dari body client.
    const originShipping = {
      businessName: vendorName,
      address: vendorAddress,
      city: vendorCity,
      postalCode: vendorPostalCode,
      phone: vendorPhone,
      latitude: vendorLatitude,
      longitude: vendorLongitude,
      slug: vendorSlug,
    };
    // PII (nama/alamat/telepon toko) hanya di-log di development.
    if (process.env.NODE_ENV !== 'production') {
      console.log('[checkout/xendit] origin dari DB', {
        productSlug: body.productSlug,
        ...originShipping,
      });
    }

    const productName = (product as Record<string, unknown>).name as string ?? 'Produk';
    const imageUrl = (product as Record<string, unknown>).image_url as string ?? '';

    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const orderCode = `RB-${stamp}${rand}`;
    const nowIso = new Date().toISOString();

    // 7B-1: distance client BUKAN sumber kebenaran shipping.
    // NULL = belum diketahui (jangan karang 1 km). Estimasi waktu memakai 0
    // saat unknown (bukan angka yang disimpan). Tanpa routing/ongkir provider.
    const distanceKm =
      parseDistanceKm(body.distanceKm) ??
      parseDistanceKm((product as Record<string, unknown>).distance_km) ??
      null;
    // 7B-2D-1: package shipping HANYA dari database (sumber kebenaran).
    // Nilai weightGram/lengthCm/widthCm/heightCm yang dikirim client
    // (jika ada) SENGAJA diabaikan — tidak dipercaya, tidak dibaca.
    // weight_gram = BERAT PER UNIT (satu kemasan); maknanya tidak diubah.
    // totalPackageWeightGram = turunan jelas (per-unit x quantity) untuk
    // kebutuhan shipping nanti; dimensi diteruskan apa adanya (tanpa scaling).
    const productRow = product as Record<string, unknown>;
    const packageWeightGram = toPackageInt(productRow.weight_gram);
    const packageLengthCm = toPackageInt(productRow.length_cm);
    const packageWidthCm = toPackageInt(productRow.width_cm);
    const packageHeightCm = toPackageInt(productRow.height_cm);
    const totalPackageWeightGram =
      packageWeightGram != null ? packageWeightGram * quantity : null;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[checkout/xendit] package dari DB', {
        productSlug: body.productSlug,
        quantity,
        packageWeightGram,
        totalPackageWeightGram,
        packageLengthCm,
        packageWidthCm,
        packageHeightCm,
      });
    }
    // 7B-2D-5: shipping snapshot imut, dibangun server-side dari DB
    // (originShipping + package di atas). Destination tidak diduplikasi
    // (tetap di address_snapshot). Tanpa courier/service/tracking.
    // Nilai opsional yang null tetap null (tanpa dummy/fallback).
    const shippingSnapshot = {
      origin: { ...originShipping },
      package: {
        quantity,
        weightGram: packageWeightGram,
        totalWeightGram: totalPackageWeightGram,
        lengthCm: packageLengthCm,
        widthCm: packageWidthCm,
        heightCm: packageHeightCm,
      },
    };
    // 7C-2C: revalidasi ongkir Biteship untuk delivery.
    // Client hanya mengirim identifier (courierCode/courierServiceCode);
    // harga/nama/berat/postal SELALU dari DB + response Biteship.
    // Tanpa fallback Rp8.000 bila revalidasi gagal.
    let validatedCourierCode: string | null = null;
    let validatedCourierServiceCode: string | null = null;
    let validatedCourierServiceName: string | null = null;
    let validatedShippingRate: number | null = null;
    if (body.fulfillment === 'delivery') {
      const reqCourierCode = typeof body.courierCode === 'string' ? body.courierCode.trim() : '';
      const reqServiceCode = typeof body.courierServiceCode === 'string' ? body.courierServiceCode.trim() : '';
      if (!reqCourierCode || !reqServiceCode) {
        return NextResponse.json({ error: 'Silakan pilih layanan pengiriman terlebih dahulu.' }, { status: 400 });
      }
      if (packageWeightGram == null) {
        return NextResponse.json(
          { error: 'Data berat produk belum tersedia, ongkir delivery belum dapat dihitung.' },
          { status: 400 }
        );
      }
      if (!vendorPostalCode || !POSTAL_CODE_RE.test(vendorPostalCode)) {
        return NextResponse.json({ error: 'Kode pos toko belum tersedia, ongkir belum dapat dihitung.' }, { status: 400 });
      }
      const destPostalRaw = addressSnapshot?.postalCode;
      const destPostal = typeof destPostalRaw === 'string' ? destPostalRaw.trim() : '';
      if (!POSTAL_CODE_RE.test(destPostal)) {
        return NextResponse.json(
          { error: 'Kode pos alamat tujuan belum tersedia, ongkir belum dapat dihitung. Lengkapi kode pos alamat dulu.' },
          { status: 400 }
        );
      }
      const couriers = getConfiguredCouriers();
      if (couriers.length === 0) {
        console.error('[checkout/xendit] BITESHIP_COURIERS belum dikonfigurasi');
        return NextResponse.json({ error: 'Layanan pengiriman belum dikonfigurasi.' }, { status: 500 });
      }
      const rateItem: BiteshipRateItem = {
        name: productName,
        category: 'food_and_drink',
        value: Math.round(unitPrice),
        quantity,
        weight: packageWeightGram,
      };
      if (packageLengthCm != null) rateItem.length = packageLengthCm;
      if (packageWidthCm != null) rateItem.width = packageWidthCm;
      if (packageHeightCm != null) rateItem.height = packageHeightCm;
      let entries;
      try {
        entries = await getBiteshipRates({
          origin_postal_code: Number(vendorPostalCode),
          destination_postal_code: Number(destPostal),
          couriers: couriers.join(','),
          items: [rateItem],
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Gagal menghitung ongkir.';
        console.error('[checkout/xendit] biteship revalidation error', msg);
        return NextResponse.json({ error: msg }, { status: 502 });
      }
      const match = entries.find(
        (e) => e.courier_code === reqCourierCode && e.courier_service_code === reqServiceCode
      );
      const matchedRate = match ? Number(match.price) : NaN;
      if (!match || !Number.isFinite(matchedRate) || matchedRate < 0) {
        return NextResponse.json(
          { error: 'Layanan pengiriman yang dipilih sudah tidak tersedia. Silakan pilih layanan lain.' },
          { status: 400 }
        );
      }
      validatedCourierCode = match.courier_code;
      validatedCourierServiceCode = match.courier_service_code;
      const matchedName = match.courier_service_name;
      validatedCourierServiceName =
        typeof matchedName === 'string' && matchedName.trim() ? matchedName.trim() : match.courier_service_code;
      validatedShippingRate = Math.round(matchedRate);
    }
    // Pickup: validated* tetap null, deliveryFee 0 (behavior lama).
    const pricing = calculatePricing({
      unitPrice,
      quantity,
      fulfillment: body.fulfillment as 'delivery' | 'pickup',
      promoPercentOff,
      useCoins: !!body.useCoins,
      coinBalance,
      deliveryFeeOverride:
        body.fulfillment === 'delivery' && validatedShippingRate != null ? validatedShippingRate : undefined,
    });
    // vendorSlug untuk preparation time; fallback ke product slug
    const estimateVendorSlug = vendorSlug || body.productSlug;
    const estimate = estimateOrderMinutes({
      fulfillment: body.fulfillment as 'delivery' | 'pickup',
      distanceKm: distanceKm ?? 0,
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
      const freeInsertPayload: Record<string, unknown> = {
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
        address_snapshot: body.fulfillment === 'delivery' ? addressSnapshot : null,
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
        shipping_snapshot: shippingSnapshot,
        courier_code: validatedCourierCode,
        courier_service_code: validatedCourierServiceCode,
        courier_service_name: validatedCourierServiceName,
        shipping_rate: validatedShippingRate,
      };
      let { error: insertErr } = await serviceClient.from('orders').insert(freeInsertPayload);
      if (insertErr && (insertErr.message.includes('shipping_snapshot') || insertErr.message.includes('courier_code') || insertErr.message.includes('shipping_rate'))) {
        // Skema DB lama tanpa kolom snapshot/kurir - coba ulang tanpa field tersebut
        // (pola yang sama dengan fallback umkm_id/product_id di bawah).
        const retryFree = { ...freeInsertPayload };
        delete retryFree.shipping_snapshot;
        delete retryFree.courier_code;
        delete retryFree.courier_service_code;
        delete retryFree.courier_service_name;
        delete retryFree.shipping_rate;
        const retryRes = await serviceClient.from('orders').insert(retryFree);
        insertErr = retryRes.error;
      }
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

      console.log('[checkout/xendit] free order created', { orderCode, total: 0, coinUsed: pricing.coinUsed });

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
        addressSnapshot: body.fulfillment === 'delivery' ? addressSnapshot : null,
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
        shippingSnapshot,
        courierCode: validatedCourierCode,
        courierServiceCode: validatedCourierServiceCode,
        courierServiceName: validatedCourierServiceName,
        shippingRate: validatedShippingRate,
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
      address_snapshot: body.fulfillment === 'delivery' ? addressSnapshot : null,
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
      shipping_snapshot: shippingSnapshot,
      courier_code: validatedCourierCode,
      courier_service_code: validatedCourierServiceCode,
      courier_service_name: validatedCourierServiceName,
      shipping_rate: validatedShippingRate,
    };

    const { error: insertErr } = await serviceClient.from('orders').insert(insertPayload);
    if (insertErr) {
      console.error('[checkout/xendit] insert order error', insertErr.message);

      if (insertErr.message.includes('shipping_snapshot') || insertErr.message.includes('courier_code') || insertErr.message.includes('shipping_rate')) {
        // Skema DB lama tanpa kolom snapshot/kurir - coba ulang tanpa field tersebut.
        const retrySnapshot = { ...insertPayload };
        delete retrySnapshot.shipping_snapshot;
        delete retrySnapshot.courier_code;
        delete retrySnapshot.courier_service_code;
        delete retrySnapshot.courier_service_name;
        delete retrySnapshot.shipping_rate;
        const { error: retrySnapshotErr } = await serviceClient.from('orders').insert(retrySnapshot);
        if (retrySnapshotErr) {
          await serviceClient.rpc('release_stock', { p_slug: body.productSlug, p_quantity: quantity });
          console.error('[checkout/xendit] retry insert error', retrySnapshotErr.message);
          return NextResponse.json({ error: 'Gagal membuat pesanan (DB).' }, { status: 500 });
        }
      } else if (insertErr.message.includes('umkm_id') || insertErr.message.includes('product_id')) {
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
      
      await serviceClient.from('orders').delete().eq('order_code', orderCode);
      await serviceClient.rpc('release_stock', { p_slug: body.productSlug, p_quantity: quantity });
      const msg = e instanceof Error ? e.message : 'Gagal membuat invoice Xendit.';
      console.error('[checkout/xendit] xendit error', msg);
      return NextResponse.json({ error: `Gagal membuat invoice: ${msg}` }, { status: 502 });
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
