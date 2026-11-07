import { NextRequest, NextResponse } from 'next/server';
import { createAnonServerClient, createServiceClient, getSiteUrl, getUserFromBearer } from '@/lib/server/supabase';
import { REBITES_COURIER_CODE as REBITES_COURIER_CODE_LOCAL, REBITES_SERVICE_CODE as REBITES_SERVICE_CODE_LOCAL, REBITES_SERVICE_NAME as REBITES_SERVICE_NAME_LOCAL, haversineKm as haversineKmLocal, calculateDeliveryFee as calculateDeliveryFeeLocal, estimateRoadDistanceKm as estimateRoadDistanceKmLocal, isValidCoordinatePair as isValidCoordinatePairLocal, } from '@/lib/shipping-tariff';
import { createXenditInvoice, getXenditInvoice } from '@/lib/server/xendit';
import { canTransitionInvoiceState, classifyCompensationRpcResult, classifyInvoiceError, classifyOrderWriteError, classifyReplay, classifyReserveOutcome, normalizeIdempotencyKey, planAbandonDeletion, planKeyedFailureCompensation, type InvoiceState, type KeyedFailurePhase, } from '@/lib/server/checkout-idempotency';
import { calculatePricing } from '@/lib/server/pricing';
import { estimateOrderMinutes } from '@/lib/delivery-estimate';
import { parseDistanceKm, sanitizeAddressSnapshot, buildAddressSnapshot } from '@/lib/location-validation';
import { resolvePackageWeightGram } from '@/lib/package-weight';
import { resolveOriginPoint } from '@/lib/store-origin-point';
import { isMenuScheduleVisible } from '@/lib/menu-schedule';
export const runtime = 'nodejs';
const POSTAL_CODE_RE = /^[0-9]{5}$/;
function getWibMinutesNow(now = new Date()): number | null {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(now);
        const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
        const h = Number(get('hour')) % 24;
        const m = Number(get('minute'));
        if (!Number.isFinite(h) || !Number.isFinite(m))
            return null;
        return h * 60 + m;
    }
    catch {
        return null;
    }
}
function isOpenHoursNowWib(openHours: string | null | undefined, now = new Date()): boolean {
    if (openHours == null || typeof openHours !== 'string')
        return true;
    const trimmed = openHours.trim();
    if (!trimmed)
        return true;
    const match = trimmed.match(/(\d{1,2})\.(\d{2})\s*[–-]\s*(\d{1,2})\.(\d{2})/);
    if (!match)
        return true;
    const open = Number(match[1]) * 60 + Number(match[2]);
    const close = Number(match[3]) * 60 + Number(match[4]);
    if (!Number.isFinite(open) || !Number.isFinite(close))
        return true;
    const minutes = getWibMinutesNow(now);
    if (minutes == null)
        return true;
    if (open <= close) {
        return minutes >= open && minutes < close;
    }
    return minutes >= open || minutes < close;
}
function toPackageInt(value: unknown): number | null {
    if (value == null)
        return null;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num) || num <= 0)
        return null;
    const int = Math.floor(num);
    return int >= 1 ? int : null;
}
function toOriginCoordinate(value: unknown, min: number, max: number): number | null {
    if (value == null)
        return null;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num) || num < min || num > max)
        return null;
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
        const idempotencyKey = normalizeIdempotencyKey(req.headers.get('idempotency-key'));
        const checkoutBuyerId: string = user.id;
        if (body.fulfillment !== 'delivery' && body.fulfillment !== 'pickup') {
            return NextResponse.json({ error: 'fulfillment harus delivery atau pickup.' }, { status: 400 });
        }
        if (body.fulfillment === 'delivery' && !body.addressSnapshot) {
            return NextResponse.json({ error: 'Alamat pengiriman wajib untuk delivery.' }, { status: 400 });
        }
        let addressSnapshot: Record<string, unknown> | null = null;
        if (body.fulfillment === 'delivery') {
            const { snapshot, error } = sanitizeAddressSnapshot(body.addressSnapshot);
            if (error || !snapshot) {
                return NextResponse.json({ error: error ?? 'Alamat pengiriman tidak valid.' }, { status: 400 });
            }
            if (!snapshot.addressId) {
                return NextResponse.json({ error: 'Alamat pengiriman tidak valid (addressId wajib).' }, { status: 400 });
            }
            const addressService = createServiceClient();
            const { data: addressRow } = await addressService
                .from('addresses')
                .select('id, user_id, label, receiver_name, phone, province, city, district, full_address, note, postal_code, latitude, longitude')
                .eq('id', snapshot.addressId)
                .eq('user_id', user.id)
                .maybeSingle();
            if (!addressRow) {
                return NextResponse.json({ error: 'Alamat pengiriman tidak ditemukan untuk akun Anda.' }, { status: 403 });
            }
            const addr = addressRow as Record<string, unknown>;
            addressSnapshot = buildAddressSnapshot({
                id: addr.id as string | null,
                label: addr.label,
                receiverName: addr.receiver_name,
                phone: addr.phone,
                province: addr.province,
                city: addr.city,
                district: addr.district,
                fullAddress: addr.full_address,
                note: addr.note,
                postalCode: addr.postal_code,
                latitude: addr.latitude,
                longitude: addr.longitude,
            }) as unknown as Record<string, unknown>;
        }
        const anon = createAnonServerClient();
        const { data: product, error: prodErr } = await anon
            .from('products')
            .select('id, umkm_id, slug, name, category, surplus_price, original_price, stock, status, verification_status, flash_sale_price, flash_sale_start, flash_sale_end, image_url, distance_km, is_delivery, is_pickup, weight_gram, length_cm, width_cm, height_cm, scheduled_start, scheduled_end')
            .eq('slug', body.productSlug)
            .maybeSingle();
        if (prodErr) {
            console.error('[checkout/xendit] fetch product error', prodErr.message);
            return NextResponse.json({ error: 'Gagal mengambil data produk.' }, { status: 500 });
        }
        if (!product) {
            return NextResponse.json({ error: 'Produk tidak tersedia untuk dipesan.' }, { status: 404 });
        }
        if ((product.stock ?? 0) < quantity) {
            return NextResponse.json({ error: 'Stok tidak mencukupi.' }, { status: 400 });
        }
        if (product.status === 'sold_out' || product.status === 'hidden') {
            return NextResponse.json({ error: 'Produk sedang tidak tersedia.' }, { status: 400 });
        }
        if ((product as Record<string, unknown>).verification_status !== 'approved') {
            return NextResponse.json({ error: 'Produk sedang tidak tersedia untuk dipesan.' }, { status: 400 });
        }
        if (!isMenuScheduleVisible({
            scheduledStart: ((product as Record<string, unknown>).scheduled_start as string | null) ?? null,
            scheduledEnd: ((product as Record<string, unknown>).scheduled_end as string | null) ?? null,
        })) {
            return NextResponse.json({ error: 'Menu ini belum tayang atau jadwalnya sudah berakhir.' }, { status: 400 });
        }
        const productIsDelivery = (product as Record<string, unknown>).is_delivery === true;
        const productIsPickup = (product as Record<string, unknown>).is_pickup === true;
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
        if (product.flash_sale_price != null &&
            product.flash_sale_start &&
            product.flash_sale_end) {
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
        let promoMaxUses: number | null = null;
        let promoUsedCount = 0;
        if (body.promoCode) {
            const code = String(body.promoCode).trim().toUpperCase();
            if (code) {
                const { data: promoRow, error: promoErr } = await anon
                    .from('promo_codes')
                    .select('code, percent_off, is_valid, expires_at, max_uses, used_count')
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
                const maxUsesRaw = promoAny.max_uses as number | null;
                if (maxUsesRaw != null && Number.isFinite(Number(maxUsesRaw))) {
                    promoMaxUses = Number(maxUsesRaw);
                    promoUsedCount = Number(promoAny.used_count ?? 0);
                    if (promoUsedCount >= promoMaxUses) {
                        return NextResponse.json({ error: 'Kode promo sudah mencapai batas pemakaian.' }, { status: 400 });
                    }
                }
                const pct = promoAny.percent_off as number | undefined;
                if (pct != null && Number.isFinite(Number(pct)) && Number(pct) > 0) {
                    promoPercentOff = Math.min(100, Math.max(1, Math.floor(Number(pct))));
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
                for (const row of txs as Array<{
                    amount: number;
                    type: string;
                }>) {
                    const amt = Number(row.amount) || 0;
                    if (row.type === 'earned' || row.type === 'refund')
                        earned += amt;
                    else if (row.type === 'spent')
                        spent += amt;
                }
                coinBalance = Math.max(0, earned - spent);
            }
        }
        let vendorName = 'Toko';
        let vendorAddress: string | null = null;
        let vendorOpenHours: string | null = null;
        let vendorIsOpen: boolean | null = null;
        let vendorIsActive: boolean | null = null;
        let vendorCity: string | null = null;
        let vendorPostalCode: string | null = null;
        let vendorPhone: string | null = null;
        let vendorLatitude: number | null = null;
        let vendorLongitude: number | null = null;
        let vendorSlug = (product as Record<string, unknown>).vendor_slug as string | undefined ?? '';
        if (product.umkm_id) {
            const { data: vendor } = await anon
                .from('umkm_profiles')
                .select('business_name, address, city, postal_code, phone, latitude, longitude, open_hours, is_open, is_active, slug')
                .eq('id', product.umkm_id)
                .maybeSingle();
            if (vendor) {
                const vendorInfo = vendor as Record<string, unknown>;
                vendorName = vendorInfo.business_name as string ?? vendorName;
                vendorAddress = vendorInfo.address as string | null;
                vendorOpenHours = vendorInfo.open_hours as string | null;
                if (typeof vendorInfo.is_open === 'boolean')
                    vendorIsOpen = vendorInfo.is_open;
                if (typeof vendorInfo.is_active === 'boolean')
                    vendorIsActive = vendorInfo.is_active;
                vendorSlug = (vendorInfo.slug as string | undefined) ?? vendorSlug;
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
        let originEstimated = false;
        if (vendorSlug && (!isValidCoordinatePairLocal(vendorLatitude, vendorLongitude))) {
            const fallback = resolveOriginPoint(vendorLatitude, vendorLongitude, vendorCity);
            if (fallback.point) {
                vendorLatitude = fallback.point.latitude;
                vendorLongitude = fallback.point.longitude;
                originEstimated = fallback.source === 'city';
            }
        }
        const originShipping = {
            businessName: vendorName,
            address: vendorAddress,
            city: vendorCity,
            postalCode: vendorPostalCode,
            phone: vendorPhone,
            latitude: vendorLatitude,
            longitude: vendorLongitude,
            slug: vendorSlug,
            estimated: originEstimated,
        };
        if (process.env.NODE_ENV !== 'production') {
            console.log('[checkout/xendit] origin dari DB', {
                productSlug: body.productSlug,
                ...originShipping,
            });
        }
        if (vendorIsActive === false) {
            return NextResponse.json({
                error: `Toko ${vendorName} sedang tidak aktif. Silakan pilih produk dari toko lain.`,
                code: 'STORE_INACTIVE',
            }, { status: 409 });
        }
        if (vendorIsOpen === false) {
            return NextResponse.json({ error: `Toko ${vendorName} sedang tutup. Silakan coba lagi saat toko buka.`, code: 'STORE_CLOSED' }, { status: 409 });
        }
        if (!isOpenHoursNowWib(vendorOpenHours)) {
            const hours = vendorOpenHours?.trim()
                ? ` (${vendorOpenHours.trim()})`
                : '';
            return NextResponse.json({ error: `Toko ${vendorName} sedang tutup di luar jam operasional${hours}. Silakan kembali pada jam operasional.`, code: 'STORE_CLOSED' }, { status: 409 });
        }
        const productName = (product as Record<string, unknown>).name as string ?? 'Produk';
        const imageUrl = (product as Record<string, unknown>).image_url as string ?? '';
        const stamp = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        const orderCode = `RB-${stamp}${rand}`;
        const nowIso = new Date().toISOString();
        const distanceKm = parseDistanceKm(body.distanceKm) ??
            parseDistanceKm((product as Record<string, unknown>).distance_km) ??
            null;
        const productRow = product as Record<string, unknown>;
        const rawPackageWeight = toPackageInt(productRow.weight_gram);
        const packageWeightGram = rawPackageWeight ?? resolvePackageWeightGram(null, productRow.category as string | null);
        const packageWeightEstimated = rawPackageWeight == null;
        const packageLengthCm = toPackageInt(productRow.length_cm);
        const packageWidthCm = toPackageInt(productRow.width_cm);
        const packageHeightCm = toPackageInt(productRow.height_cm);
        const totalPackageWeightGram = packageWeightGram != null ? packageWeightGram * quantity : null;
        if (process.env.NODE_ENV !== 'production') {
            console.log('[checkout/xendit] package dari DB', {
                productSlug: body.productSlug,
                quantity,
                packageWeightGram,
                totalPackageWeightGram,
                packageWeightEstimated,
                packageLengthCm,
                packageWidthCm,
                packageHeightCm,
            });
        }
        const shippingSnapshot = {
            origin: { ...originShipping },
            package: {
                quantity,
                weightGram: packageWeightGram,
                totalWeightGram: totalPackageWeightGram,
                weightEstimated: packageWeightEstimated,
                lengthCm: packageLengthCm,
                widthCm: packageWidthCm,
                heightCm: packageHeightCm,
            },
        };
        let validatedCourierCode: string | null = null;
        let validatedCourierServiceCode: string | null = null;
        let validatedCourierServiceName: string | null = null;
        let validatedShippingRate: number | null = null;
        let serverRoadKm: number | null = null;
        if (body.fulfillment === 'delivery') {
            const reqCourierCode = typeof body.courierCode === 'string' ? body.courierCode.trim() : '';
            const reqServiceCode = typeof body.courierServiceCode === 'string' ? body.courierServiceCode.trim() : '';
            if (!reqCourierCode || !reqServiceCode) {
                return NextResponse.json({ error: 'Silakan pilih layanan pengiriman terlebih dahulu.' }, { status: 400 });
            }
            if (!isValidCoordinatePairLocal(vendorLatitude, vendorLongitude)) {
                return NextResponse.json({ error: 'Koordinat toko belum tersedia, ongkir belum dapat dihitung.' }, { status: 400 });
            }
            const destLat = addressSnapshot?.latitude;
            const destLng = addressSnapshot?.longitude;
            if (!isValidCoordinatePairLocal(destLat, destLng)) {
                return NextResponse.json({ error: 'Koordinat alamat tujuan belum tersedia, ongkir belum dapat dihitung. Lengkapi koordinat alamat dulu.' }, { status: 400 });
            }
            const straightKm = haversineKmLocal({ latitude: Number(vendorLatitude), longitude: Number(vendorLongitude) }, { latitude: Number(destLat), longitude: Number(destLng) });
            const roadKm = estimateRoadDistanceKmLocal(straightKm);
            const expectedFee = calculateDeliveryFeeLocal(roadKm);
            if (reqCourierCode !== REBITES_COURIER_CODE_LOCAL || reqServiceCode !== REBITES_SERVICE_CODE_LOCAL) {
                return NextResponse.json({ error: 'Layanan pengiriman yang dipilih sudah tidak tersedia. Silakan pilih layanan lain.' }, { status: 400 });
            }
            validatedCourierCode = REBITES_COURIER_CODE_LOCAL;
            validatedCourierServiceCode = REBITES_SERVICE_CODE_LOCAL;
            validatedCourierServiceName = REBITES_SERVICE_NAME_LOCAL;
            validatedShippingRate = expectedFee;
            serverRoadKm = roadKm;
        }
        const pricing = calculatePricing({
            unitPrice,
            quantity,
            fulfillment: body.fulfillment as 'delivery' | 'pickup',
            promoPercentOff,
            useCoins: !!body.useCoins,
            coinBalance,
            deliveryFeeOverride: body.fulfillment === 'delivery' && validatedShippingRate != null ? validatedShippingRate : undefined,
        });
        const estimateVendorSlug = vendorSlug || body.productSlug;
        const estimateDistanceKm = body.fulfillment === 'delivery' && serverRoadKm != null
            ? serverRoadKm
            : (distanceKm ?? 0);
        const estimate = estimateOrderMinutes({
            fulfillment: body.fulfillment as 'delivery' | 'pickup',
            distanceKm: estimateDistanceKm,
            vendorSlug: estimateVendorSlug,
        });
        const estimatedMinutes = estimate.estimatedMinutes;
        const estimatedCompletionAt = new Date(Date.now() + estimatedMinutes * 60000).toISOString();
        const storedDistanceKm = body.fulfillment === 'delivery' && serverRoadKm != null ? serverRoadKm : distanceKm;
        const serviceClient = createServiceClient();
        const checkoutUserId: string = user.id;
        const checkoutProductSlug: string = body.productSlug;
        const checkoutPromoCode: string | null = typeof body.promoCode === 'string' && body.promoCode.trim()
            ? body.promoCode.trim().toUpperCase()
            : null;
        const runCompensationRpc = async (orderCode: string, operation: string, params: Record<string, unknown>, opts?: {
            requireSuccessData?: boolean;
        }): Promise<boolean> => {
            try {
                const { data, error } = await serviceClient.rpc(operation, params);
                const verdict = classifyCompensationRpcResult({
                    data,
                    error,
                    requireSuccessData: opts?.requireSuccessData === true,
                });
                if (!verdict.ok) {
                    console.error('[checkout/xendit] kompensasi gagal', operation, {
                        orderCode,
                        reason: verdict.reason,
                        detail: error?.message ?? null,
                    });
                    return false;
                }
                return true;
            }
            catch (e) {
                console.error('[checkout/xendit] kompensasi melempar', operation, {
                    orderCode,
                    detail: e instanceof Error ? e.message : 'unknown error',
                });
                return false;
            }
        };
        const abandonCheckoutOrder = async (orderCode: string, phase: KeyedFailurePhase, opts: {
            compensationSettled: boolean;
            logLabel: string;
        }): Promise<{
            confirmed: boolean;
            stockReleased: boolean | null;
        }> => {
            type MarkerRow = {
                stock_reserved_at?: string | null;
                stock_released_at?: string | null;
                payment_status?: string | null;
                order_status?: string | null;
            };
            const patch: Record<string, unknown> = {
                payment_status: 'failed',
                order_status: 'cancelled',
            };
            if (planKeyedFailureCompensation(phase, false).clearCoinSnapshot) {
                patch.coin_used = 0;
                patch.coin_earned = 0;
            }
            const { data: updated, error: updErr } = await serviceClient
                .from('orders')
                .update(patch)
                .eq('order_code', orderCode)
                .eq('buyer_id', checkoutBuyerId)
                .eq('payment_status', 'unpaid')
                .is('xendit_invoice_id', null)
                .select('order_code, stock_reserved_at, stock_released_at');
            let markerRow: MarkerRow | null = null;
            let confirmed = false;
            if (!updErr && updated && updated.length === 1) {
                confirmed = true;
                markerRow = updated[0] as MarkerRow;
            }
            else {
                if (updErr) {
                    console.error('[checkout/xendit] transisi terminal gagal', updErr.message, {
                        orderCode,
                        logLabel: opts.logLabel,
                    });
                }
                const { data: reread, error: rereadErr } = await serviceClient
                    .from('orders')
                    .select('order_code, payment_status, order_status, stock_reserved_at, stock_released_at')
                    .eq('order_code', orderCode)
                    .eq('buyer_id', checkoutBuyerId)
                    .maybeSingle();
                if (rereadErr) {
                    console.error('[checkout/xendit] CRITICAL: status pesanan tak terbaca saat rollback; TANPA tindakan lanjutan (rekonsiliasi manual)', { orderCode, detail: rereadErr.message });
                    return { confirmed: false, stockReleased: null };
                }
                const rereadRow = (reread ?? null) as MarkerRow | null;
                if (!rereadRow) {
                    console.error('[checkout/xendit] CRITICAL: baris pesanan TIDAK ditemukan saat rollback; status stok tidak pasti (rekonsiliasi manual)', { orderCode });
                    return { confirmed: false, stockReleased: null };
                }
                const terminal = rereadRow.payment_status === 'failed' ||
                    rereadRow.payment_status === 'refunded' ||
                    rereadRow.order_status === 'cancelled' ||
                    rereadRow.order_status === 'refunded' ||
                    rereadRow.order_status === 'failed';
                if (rereadRow.payment_status === 'paid') {
                    return { confirmed: true, stockReleased: true };
                }
                if (!terminal) {
                    console.error('[checkout/xendit] CRITICAL: transisi terminal TIDAK terkonfirmasi; pesanan dibiarkan apa adanya (rekonsiliasi manual)', { orderCode, logLabel: opts.logLabel });
                    return { confirmed: false, stockReleased: null };
                }
                confirmed = true;
                markerRow = rereadRow;
            }
            const plan = planAbandonDeletion({
                transitionConfirmed: confirmed,
                stockReservedAt: markerRow?.stock_reserved_at ?? null,
                stockReleasedAt: markerRow?.stock_released_at ?? null,
                compensationSettled: opts.compensationSettled,
            });
            if (plan.hold === 'stock_not_released') {
                console.error('[checkout/xendit] CRITICAL: marker pelepasan stok belum terisi; pesanan DIPERTAHANKAN untuk rekonsiliasi', { orderCode });
                return { confirmed, stockReleased: plan.stockReleased };
            }
            if (plan.hold === 'compensation_pending') {
                console.error('[checkout/xendit] kompensasi belum sukses: pesanan dibiarkan terminal, baris DIPERTAHANKAN untuk rekonsiliasi', { orderCode });
                return { confirmed, stockReleased: plan.stockReleased };
            }
            console.log('[checkout/xendit] rollback: pesanan terminal DIPERTAHANKAN untuk rekonsiliasi (I1: tanpa hard delete)', {
                orderCode,
            });
            return { confirmed, stockReleased: plan.stockReleased };
        };
        const rollbackCheckoutOrder = async (orderCode: string, opts: {
            promoClaimed: boolean;
            refundCoins: boolean;
            phase: KeyedFailurePhase;
        }): Promise<{
            confirmed: boolean;
            stockReleased: boolean | null;
        }> => {
            let refundOk = true;
            let promoOk = true;
            if (opts.refundCoins) {
                refundOk = await runCompensationRpc(orderCode, 'refund_order_coins', {
                    p_user_id: checkoutUserId,
                    p_order_code: orderCode,
                });
            }
            if (opts.promoClaimed && checkoutPromoCode) {
                promoOk = await runCompensationRpc(orderCode, 'release_promo', {
                    p_code: checkoutPromoCode,
                });
            }
            const abandonResult = await abandonCheckoutOrder(orderCode, opts.phase, {
                compensationSettled: refundOk && promoOk,
                logLabel: 'rollback',
            });
            if (!abandonResult.confirmed) {
                console.error('[checkout/xendit] CRITICAL: rollback belum terkonfirmasi penuh; baris dibiarkan apa adanya (rekonsiliasi manual)', {
                    orderCode,
                    confirmed: abandonResult.confirmed,
                    stockReleased: abandonResult.stockReleased,
                });
            }
            else {
                console.log('[checkout/xendit] rollback selesai (I1: baris dipertahankan, tanpa hard delete)', {
                    orderCode,
                    confirmed: abandonResult.confirmed,
                    stockReleased: abandonResult.stockReleased,
                });
            }
            return abandonResult;
        };
        const handleLegacyInsertFailure = async (orderCode: string, insertErr: {
            code?: string | null;
            message?: string | null;
        }, logLabel: string): Promise<void> => {
            console.error(`[checkout/xendit] ${logLabel}`, insertErr.message ?? 'unknown error', { orderCode });
            if (classifyOrderWriteError(insertErr) === 'definitive') {
                await runCompensationRpc(orderCode, 'release_stock', {
                    p_slug: checkoutProductSlug,
                    p_quantity: quantity,
                }, { requireSuccessData: true });
                return;
            }
            const { data: reread, error: rereadErr } = await serviceClient
                .from('orders')
                .select('order_code')
                .eq('order_code', orderCode)
                .eq('buyer_id', checkoutBuyerId)
                .maybeSingle();
            if (rereadErr) {
                console.error('[checkout/xendit] CRITICAL: insert gagal ambigu & baris tak terbaca; TANPA pelepasan stok (rekonsiliasi manual)', { orderCode, detail: rereadErr.message });
                return;
            }
            if (!reread?.order_code) {
                await runCompensationRpc(orderCode, 'release_stock', {
                    p_slug: checkoutProductSlug,
                    p_quantity: quantity,
                }, { requireSuccessData: true });
                return;
            }
            await rollbackCheckoutOrder(orderCode, {
                promoClaimed: false,
                refundCoins: false,
                phase: 'pre_gate',
            });
        };
        const claimPromoAndSpendCoins = async (orderCode: string, coinUsed: number, mode: 'legacy' | 'keyed' = 'legacy'): Promise<{
            ok: true;
        } | {
            ok: false;
            status: number;
            error: string;
        }> => {
            let promoClaimed = false;
            const compensate = async () => {
                if (mode === 'keyed') {
                    const failed = await failKeyedOrder(orderCode, { releasePromo: promoClaimed, clearCoinSnapshot: true });
                    if (!failed) {
                        console.error('[checkout/xendit] CRITICAL: pembatalan order keyed (klaim promo gagal) tidak terkonfirmasi', { orderCode });
                    }
                }
                else {
                    await rollbackCheckoutOrder(orderCode, { promoClaimed: false, refundCoins: false, phase: 'pre_gate' });
                }
            };
            const compensateWithPromo = async () => {
                if (mode === 'keyed') {
                    const failed = await failKeyedOrder(orderCode, { releasePromo: promoClaimed, clearCoinSnapshot: true });
                    if (!failed) {
                        console.error('[checkout/xendit] CRITICAL: pembatalan order keyed (spend gagal) tidak terkonfirmasi', { orderCode });
                    }
                }
                else {
                    await rollbackCheckoutOrder(orderCode, { promoClaimed, refundCoins: false, phase: 'pre_gate' });
                }
            };
            if (checkoutPromoCode && promoPercentOff != null) {
                const { data: claimedPct, error: claimErr } = await serviceClient.rpc('consume_promo', {
                    p_code: checkoutPromoCode,
                });
                if (claimErr || claimedPct == null || Number(claimedPct) !== promoPercentOff) {
                    await compensate();
                    return {
                        ok: false,
                        status: 400,
                        error: 'Kode promo tidak valid, kadaluarsa, atau sudah mencapai batas pemakaian.',
                    };
                }
                promoClaimed = true;
            }
            if (coinUsed > 0) {
                const { data: spent, error: spendErr } = await serviceClient.rpc('spend_order_coins', {
                    p_user_id: checkoutUserId,
                    p_order_code: orderCode,
                    p_amount: coinUsed,
                });
                if (spendErr || spent !== true) {
                    await compensateWithPromo();
                    return {
                        ok: false,
                        status: 409,
                        error: 'Saldo ReBites Coin tidak mencukupi (kemungkinan dipakai di pesanan lain). Silakan coba lagi.',
                    };
                }
            }
            return { ok: true };
        };
        type KeyedRow = Record<string, unknown>;
        let keyedFlow = false;
        const fetchKeyedRow = async (key: string): Promise<KeyedRow | null> => {
            const { data } = await serviceClient
                .from('orders')
                .select('order_code, buyer_id, payment_status, order_status, xendit_invoice_id, invoice_state, total_price')
                .eq('buyer_id', checkoutBuyerId)
                .eq('idempotency_key', key)
                .maybeSingle();
            return (data as KeyedRow | null) ?? null;
        };
        const transitionInvoiceState = async (orderCode: string, from: InvoiceState[], to: InvoiceState, extra?: Record<string, unknown>): Promise<boolean> => {
            for (const f of from) {
                if (!canTransitionInvoiceState(f, to)) {
                    console.error('[checkout/xendit] transisi invoice_state ilegal', { orderCode, from: f, to });
                    return false;
                }
            }
            let query = serviceClient
                .from('orders')
                .update({ invoice_state: to, ...(extra ?? {}) } as Record<string, unknown>)
                .eq('order_code', orderCode)
                .eq('buyer_id', checkoutBuyerId)
                .in('invoice_state', from);
            if (to === 'failed')
                query = query.eq('payment_status', 'unpaid');
            const { data, error } = await query.select('order_code');
            if (error) {
                console.error('[checkout/xendit] transisi invoice_state gagal', error.message, { orderCode, to });
                return false;
            }
            return (data ?? []).length === 1;
        };
        const failKeyedOrder = async (orderCode: string, opts: {
            releasePromo: boolean;
            clearCoinSnapshot: boolean;
        }): Promise<boolean> => {
            const patch: Record<string, unknown> = {
                payment_status: 'failed',
                order_status: 'cancelled',
                invoice_state: 'failed',
            };
            if (opts.clearCoinSnapshot) {
                patch.coin_used = 0;
                patch.coin_earned = 0;
            }
            const { data, error } = await serviceClient
                .from('orders')
                .update(patch)
                .eq('order_code', orderCode)
                .eq('buyer_id', checkoutBuyerId)
                .eq('payment_status', 'unpaid')
                .in('invoice_state', ['not_started', 'inflight', 'unknown'] as InvoiceState[])
                .select('order_code');
            if (error || !data || data.length !== 1)
                return false;
            if (opts.releasePromo && checkoutPromoCode) {
                await runCompensationRpc(orderCode, 'release_promo', { p_code: checkoutPromoCode });
            }
            return true;
        };
        const respondForKeyedRow = async (row: KeyedRow) => {
            const kind = classifyReplay({
                payment_status: row.payment_status as string | null,
                order_status: row.order_status as string | null,
                invoice_state: (row.invoice_state as InvoiceState | null) ?? null,
                xendit_invoice_id: row.xendit_invoice_id as string | null,
            });
            const code = row.order_code as string;
            const state = (row.invoice_state as InvoiceState | null) ?? null;
            if (kind === 'success') {
                return NextResponse.json({ orderCode: code, paymentStatus: 'paid', invoiceState: state });
            }
            if (kind === 'failed_final') {
                return NextResponse.json({ error: 'Pesanan ini sudah dibatalkan/gagal. Silakan buat pesanan baru.', final: true, orderCode: code }, { status: 400 });
            }
            if (kind === 'attached_unpaid') {
                try {
                    const inv = await getXenditInvoice(row.xendit_invoice_id as string);
                    return NextResponse.json({
                        orderCode: code,
                        invoiceUrl: inv.invoice_url,
                        invoiceId: row.xendit_invoice_id,
                        amount: Number(row.total_price ?? 0),
                        invoiceState: 'attached' as InvoiceState,
                    });
                }
                catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : 'Gagal mengambil invoice.';
                    console.error('[checkout/xendit] replay invoice lookup gagal', msg, { orderCode: code });
                    return NextResponse.json({ error: 'Pesanan sedang diproses. Cek status pembayaran berkala.', retryable: true, orderCode: code, invoiceState: state }, { status: 409 });
                }
            }
            return NextResponse.json({ error: 'Pesanan sedang diproses. Jangan submit ulang; cek status pembayaran berkala.', retryable: true, orderCode: code, invoiceState: state }, { status: 409 });
        };
        const handleKeyedMismatch = async (orderCode: string, phase: KeyedFailurePhase, promoClaimed: boolean) => {
            let row: KeyedRow | null = null;
            try {
                row = await fetchKeyedRow(idempotencyKey as string);
            }
            catch {
                row = null;
            }
            if (!row || !row.order_code) {
                console.error('[checkout/xendit] mismatch tanpa baris terbaca; tanpa kompensasi', { orderCode });
                return NextResponse.json({ error: 'Gagal membuat pesanan.' }, { status: 500 });
            }
            const kind = classifyReplay({
                payment_status: row.payment_status as string | null,
                order_status: row.order_status as string | null,
                invoice_state: (row.invoice_state as InvoiceState | null) ?? null,
                xendit_invoice_id: row.xendit_invoice_id as string | null,
            });
            if (kind !== 'checking') {
                return respondForKeyedRow(row);
            }
            const plan = planKeyedFailureCompensation(phase, promoClaimed);
            const failed = await failKeyedOrder(orderCode, {
                releasePromo: plan.releasePromo,
                clearCoinSnapshot: plan.clearCoinSnapshot,
            });
            const after = await fetchKeyedRow(idempotencyKey as string).catch(() => null);
            if (after && after.order_code)
                return respondForKeyedRow(after);
            if (failed) {
                return NextResponse.json({ error: 'Pesanan dibatalkan. Silakan buat pesanan baru.', final: true, orderCode }, { status: 400 });
            }
            console.error('[checkout/xendit] CRITICAL: transisi gagal terminal tidak terkonfirmasi', {
                orderCode,
            });
            return NextResponse.json({
                error: 'Status pesanan belum dapat dipastikan. Cek riwayat pesanan sebelum mencoba lagi.',
                orderCode,
            }, { status: 500 });
        };
        const handleLegacyFreePaidMarkFailure = async (orderCode: string) => {
            const { data: reread, error: rereadErr } = await serviceClient
                .from('orders')
                .select('order_code, payment_status, order_status')
                .eq('order_code', orderCode)
                .eq('buyer_id', checkoutBuyerId)
                .maybeSingle();
            const row = (reread ?? null) as KeyedRow | null;
            if (rereadErr || !row?.order_code) {
                console.error('[checkout/xendit] CRITICAL: paid-mark free legacy tidak terkonfirmasi & baris tak terbaca; tanpa kompensasi (rekonsiliasi manual)', { orderCode, detail: rereadErr?.message ?? null });
                return NextResponse.json({
                    error: 'Status pesanan belum dapat dipastikan. Cek riwayat pesanan sebelum mencoba lagi.',
                    orderCode,
                }, { status: 500 });
            }
            const payment = row.payment_status as string | null;
            const order = row.order_status as string | null;
            if (payment === 'paid') {
                console.error('[checkout/xendit] paid-mark free legacy: pesanan sudah lunas; dibiarkan apa adanya (tanpa downgrade status)', { orderCode });
                return NextResponse.json({
                    error: 'Pesanan sedang diproses. Cek status pembayaran berkala.',
                    retryable: true,
                    orderCode,
                }, { status: 409 });
            }
            const terminal = payment === 'failed' ||
                payment === 'refunded' ||
                order === 'cancelled' ||
                order === 'refunded' ||
                order === 'failed';
            if (terminal) {
                return NextResponse.json({ error: 'Pesanan ini sudah dibatalkan/gagal. Silakan buat pesanan baru.', final: true, orderCode }, { status: 400 });
            }
            const result = await rollbackCheckoutOrder(orderCode, {
                promoClaimed: checkoutPromoCode != null && promoPercentOff != null,
                refundCoins: pricing.coinUsed > 0,
                phase: 'post_gate',
            });
            if (!result.confirmed) {
                console.error('[checkout/xendit] CRITICAL: kompensasi free legacy (paid-mark gagal) belum terkonfirmasi; baris dipertahankan untuk rekonsiliasi', { orderCode, confirmed: result.confirmed, stockReleased: result.stockReleased });
                return NextResponse.json({
                    error: 'Status pesanan belum dapat dipastikan. Cek riwayat pesanan sebelum mencoba lagi.',
                    orderCode,
                }, { status: 500 });
            }
            return NextResponse.json({ error: 'Pesanan dibatalkan. Silakan buat pesanan baru.', final: true, orderCode }, { status: 400 });
        };
        if (idempotencyKey) {
            const { error: claimErr } = await serviceClient.from('orders').insert({
                order_code: orderCode,
                buyer_id: checkoutBuyerId,
                umkm_id: product.umkm_id ?? null,
                product_id: product.id ?? null,
                product_slug: body.productSlug,
                quantity,
                idempotency_key: idempotencyKey,
                invoice_state: 'not_started' as InvoiceState,
                payment_status: 'unpaid',
                order_status: 'pending',
                lifecycle_status: 'ongoing',
                progress_status: 'disiapkan',
            } as Record<string, unknown>);
            if (!claimErr) {
                keyedFlow = true;
            }
            else if (claimErr.code === '23505') {
                const existing = await fetchKeyedRow(idempotencyKey);
                if (existing && existing.order_code)
                    return respondForKeyedRow(existing);
                console.error('[checkout/xendit] konflik kunci tanpa baris', claimErr.message);
                return NextResponse.json({ error: 'Gagal membuat pesanan.' }, { status: 500 });
            }
            else if (claimErr.code === '42703' ||
                /idempotency_key|invoice_state/i.test(claimErr.message ?? '')) {
                console.warn('[checkout/xendit] kolom idempotensi belum ada, memakai jalur legacy');
            }
            else {
                console.error('[checkout/xendit] klaim idempotensi gagal', claimErr.message);
                return NextResponse.json({ error: 'Gagal membuat pesanan.' }, { status: 500 });
            }
        }
        if (keyedFlow) {
            const { data: reserved, error: reserveErr } = await serviceClient.rpc('reserve_stock_for_order', {
                p_order_code: orderCode,
                p_buyer_id: checkoutBuyerId,
                p_slug: body.productSlug,
                p_quantity: quantity,
            });
            let reservedOk = !reserveErr && reserved === true;
            if (reserveErr) {
                console.error('[checkout/xendit] reserve_stock_for_order error', reserveErr.message, { orderCode });
            }
            if (!reservedOk) {
                const { data: reread, error: rereadErr } = await serviceClient
                    .from('orders')
                    .select('order_code, payment_status, order_status, xendit_invoice_id, invoice_state, stock_reserved_at')
                    .eq('order_code', orderCode)
                    .eq('buyer_id', checkoutBuyerId)
                    .maybeSingle();
                const rereadRow = (reread ?? null) as (KeyedRow & {
                    stock_reserved_at?: string | null;
                }) | null;
                if (rereadErr || !rereadRow?.order_code) {
                    console.error('[checkout/xendit] reserve tanpa baris terbaca; tanpa kompensasi', {
                        orderCode,
                        detail: rereadErr?.message ?? null,
                    });
                    return NextResponse.json({ error: 'Gagal mengunci stok. Coba lagi.' }, { status: 500 });
                }
                const kind = classifyReplay({
                    payment_status: rereadRow.payment_status as string | null,
                    order_status: rereadRow.order_status as string | null,
                    invoice_state: (rereadRow.invoice_state as InvoiceState | null) ?? null,
                    xendit_invoice_id: rereadRow.xendit_invoice_id as string | null,
                });
                if (kind !== 'checking')
                    return respondForKeyedRow(rereadRow);
                const outcome = classifyReserveOutcome({
                    reserved,
                    error: reserveErr,
                    markerSet: rereadRow.stock_reserved_at != null,
                });
                if (outcome === 'reserved') {
                    reservedOk = true;
                }
                else {
                    const failed = await failKeyedOrder(orderCode, { releasePromo: false, clearCoinSnapshot: false });
                    if (!failed) {
                        const after = await fetchKeyedRow(idempotencyKey as string).catch(() => null);
                        if (after && after.order_code)
                            return respondForKeyedRow(after);
                        console.error('[checkout/xendit] CRITICAL: transisi gagal-reservasi tidak terkonfirmasi', {
                            orderCode,
                            outcome,
                        });
                        return NextResponse.json({
                            error: 'Status pesanan belum dapat dipastikan. Cek riwayat pesanan sebelum mencoba lagi.',
                            orderCode,
                        }, { status: 500 });
                    }
                    if (outcome === 'insufficient_stock') {
                        return NextResponse.json({ error: 'Stok tidak mencukupi, pesanan dibatalkan.' }, { status: 400 });
                    }
                    return NextResponse.json({ error: 'Gagal mengunci stok. Coba lagi.' }, { status: 500 });
                }
            }
        }
        else {
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
                distance_km: storedDistanceKm,
                preparation_minutes: estimate.preparationMinutes,
                vendor_address: vendorAddress,
                vendor_open_hours: vendorOpenHours,
                payment_status: 'unpaid',
                order_status: 'pending',
                co2e_saved_kg: null,
                shipping_snapshot: shippingSnapshot,
                courier_code: validatedCourierCode,
                courier_service_code: validatedCourierServiceCode,
                courier_service_name: validatedCourierServiceName,
                shipping_rate: validatedShippingRate,
                stock_reserved_at: new Date().toISOString(),
            };
            if (keyedFlow) {
                const { data: keyedUpd, error: keyedUpdErr } = await serviceClient
                    .from('orders')
                    .update({ ...freeInsertPayload, payment_status: 'unpaid', order_status: 'pending', invoice_state: 'not_started' } as Record<string, unknown>)
                    .eq('order_code', orderCode)
                    .eq('buyer_id', checkoutBuyerId)
                    .in('invoice_state', ['not_started'] as InvoiceState[])
                    .select('order_code');
                if (keyedUpdErr || !keyedUpd || keyedUpd.length !== 1) {
                    if (keyedUpdErr)
                        console.error('[checkout/xendit] keyed free update error', keyedUpdErr.message, { orderCode });
                    return handleKeyedMismatch(orderCode, 'pre_gate', false);
                }
            }
            else {
                let { error: insertErr } = await serviceClient.from('orders').insert(freeInsertPayload);
                if (insertErr &&
                    classifyOrderWriteError(insertErr) === 'definitive' &&
                    (insertErr.message.includes('shipping_snapshot') || insertErr.message.includes('courier_code') || insertErr.message.includes('shipping_rate'))) {
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
                    await handleLegacyInsertFailure(orderCode, insertErr, 'insert free order error');
                    return NextResponse.json({ error: 'Gagal membuat pesanan.' }, { status: 500 });
                }
            }
            if (pricing.coinUsed > 0 || pricing.coinEarned > 0) {
                const gate = await claimPromoAndSpendCoins(orderCode, pricing.coinUsed, keyedFlow ? 'keyed' : 'legacy');
                if (!gate.ok) {
                    return NextResponse.json({ error: gate.error }, { status: gate.status });
                }
                if (pricing.coinEarned > 0) {
                    const { data: existing } = await serviceClient
                        .from('coin_transactions')
                        .select('type')
                        .eq('user_id', user.id)
                        .eq('order_code', orderCode);
                    const existingTypes = new Set(((existing ?? []) as Array<{
                        type: string;
                    }>).map((r) => r.type));
                    if (!existingTypes.has('earned')) {
                        const { error: earnErr } = await serviceClient.from('coin_transactions').insert({
                            user_id: user.id,
                            order_code: orderCode,
                            type: 'earned',
                            amount: pricing.coinEarned,
                            description: 'Reward pembelian',
                        });
                        if (earnErr)
                            console.error('[checkout/xendit] coin earn error', earnErr.message, { orderCode });
                    }
                }
            }
            else if (body.promoCode && promoPercentOff != null) {
                const gate = await claimPromoAndSpendCoins(orderCode, 0, keyedFlow ? 'keyed' : 'legacy');
                if (!gate.ok) {
                    return NextResponse.json({ error: gate.error }, { status: gate.status });
                }
            }
            let paidMarkQuery = serviceClient
                .from('orders')
                .update({ payment_status: 'paid', order_status: 'paid' } as Record<string, unknown>)
                .eq('order_code', orderCode)
                .eq('buyer_id', checkoutBuyerId)
                .eq('payment_status', 'unpaid');
            if (keyedFlow) {
                paidMarkQuery = paidMarkQuery.in('invoice_state', ['not_started'] as InvoiceState[]);
            }
            const { data: paidMark, error: paidMarkErr } = await paidMarkQuery.select('order_code');
            if (paidMarkErr || !paidMark || paidMark.length !== 1) {
                if (paidMarkErr)
                    console.error('[checkout/xendit] free paid-mark error', paidMarkErr.message, { orderCode });
                if (keyedFlow) {
                    return handleKeyedMismatch(orderCode, 'post_gate', checkoutPromoCode != null && promoPercentOff != null);
                }
                return handleLegacyFreePaidMarkFailure(orderCode);
            }
            const siteUrl = getSiteUrl(req);
            const deepHref = `/riwayatPesanan?orderId=${encodeURIComponent(orderCode)}`;
            const { data: existingFreeNotifs } = await serviceClient
                .from('notifications')
                .select('type')
                .eq('user_id', user.id)
                .eq('reference_id', orderCode)
                .in('type', ['payment_success', 'order_created']);
            const existingFreeTypes = new Set(((existingFreeNotifs ?? []) as Array<{
                type: string;
            }>).map((r) => r.type));
            const freeNotifs: Record<string, unknown>[] = [];
            if (!existingFreeTypes.has('payment_success')) {
                freeNotifs.push({
                    user_id: user.id,
                    role: 'buyer',
                    type: 'payment_success',
                    title: 'Pembayaran Berhasil',
                    message: `Pesanan ${productName} lunas sepenuhnya dengan ReBites Coin. Estimasi selesai ${estimatedMinutes} menit.`,
                    reference_id: orderCode,
                    href: deepHref,
                });
            }
            if (!existingFreeTypes.has('order_created')) {
                freeNotifs.push({
                    user_id: user.id,
                    role: 'buyer',
                    type: 'order_created',
                    title: 'Pesanan Sedang Disiapkan',
                    message: `Pesanan #${orderCode} dari ${vendorName} sedang disiapkan. Estimasi ${estimatedMinutes} menit (${estimate.preparationMinutes} menit persiapan${estimate.travelMinutes > 0 ? ` + ${estimate.travelMinutes} menit pengantaran` : ''}).`,
                    reference_id: orderCode,
                    href: deepHref,
                });
            }
            let notifErr: {
                message: string;
            } | null = null;
            if (freeNotifs.length > 0) {
                const { error } = await serviceClient.from('notifications').insert(freeNotifs);
                notifErr = error as {
                    message: string;
                } | null;
            }
            if (notifErr)
                console.error('[checkout/xendit] notif free error', notifErr.message);
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
        const siteUrl = getSiteUrl(req);
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
            distance_km: storedDistanceKm,
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
            stock_reserved_at: new Date().toISOString(),
        };
        if (keyedFlow) {
            const { data: keyedUpd, error: keyedUpdErr } = await serviceClient
                .from('orders')
                .update({ ...insertPayload, invoice_state: 'not_started' } as Record<string, unknown>)
                .eq('order_code', orderCode)
                .eq('buyer_id', checkoutBuyerId)
                .in('invoice_state', ['not_started'] as InvoiceState[])
                .select('order_code');
            if (keyedUpdErr || !keyedUpd || keyedUpd.length !== 1) {
                if (keyedUpdErr)
                    console.error('[checkout/xendit] keyed update error', keyedUpdErr.message, { orderCode });
                return handleKeyedMismatch(orderCode, 'pre_gate', false);
            }
        }
        else {
            const { error: insertErr } = await serviceClient.from('orders').insert(insertPayload);
            if (insertErr) {
                console.error('[checkout/xendit] insert order error', insertErr.message);
                const insertDefinitive = classifyOrderWriteError(insertErr) === 'definitive';
                if (insertDefinitive && (insertErr.message.includes('shipping_snapshot') || insertErr.message.includes('courier_code') || insertErr.message.includes('shipping_rate'))) {
                    const retrySnapshot = { ...insertPayload };
                    delete retrySnapshot.shipping_snapshot;
                    delete retrySnapshot.courier_code;
                    delete retrySnapshot.courier_service_code;
                    delete retrySnapshot.courier_service_name;
                    delete retrySnapshot.shipping_rate;
                    const { error: retrySnapshotErr } = await serviceClient.from('orders').insert(retrySnapshot);
                    if (retrySnapshotErr) {
                        await handleLegacyInsertFailure(orderCode, retrySnapshotErr, 'retry insert error');
                        return NextResponse.json({ error: 'Gagal membuat pesanan (DB).' }, { status: 500 });
                    }
                }
                else if (insertDefinitive && (insertErr.message.includes('umkm_id') || insertErr.message.includes('product_id'))) {
                    const retry = { ...insertPayload };
                    delete (retry as Record<string, unknown>).umkm_id;
                    delete (retry as Record<string, unknown>).product_id;
                    const { error: retryErr } = await serviceClient.from('orders').insert(retry);
                    if (retryErr) {
                        await handleLegacyInsertFailure(orderCode, retryErr, 'retry insert error');
                        return NextResponse.json({ error: 'Gagal membuat pesanan (DB).' }, { status: 500 });
                    }
                }
                else {
                    await handleLegacyInsertFailure(orderCode, insertErr, 'insert order error');
                    return NextResponse.json({ error: 'Gagal membuat pesanan.' }, { status: 500 });
                }
            }
        }
        {
            const gate = await claimPromoAndSpendCoins(orderCode, pricing.coinUsed, keyedFlow ? 'keyed' : 'legacy');
            if (!gate.ok) {
                return NextResponse.json({ error: gate.error }, { status: gate.status });
            }
        }
        if (keyedFlow) {
            const claimed = await transitionInvoiceState(orderCode, ['not_started'], 'inflight');
            if (!claimed) {
                const existing = await fetchKeyedRow(idempotencyKey as string);
                if (existing && existing.order_code) {
                    const kind = classifyReplay({
                        payment_status: existing.payment_status as string | null,
                        order_status: existing.order_status as string | null,
                        invoice_state: (existing.invoice_state as InvoiceState | null) ?? null,
                        xendit_invoice_id: existing.xendit_invoice_id as string | null,
                    });
                    if (kind !== 'checking')
                        return respondForKeyedRow(existing);
                    const claimState = (existing.invoice_state as InvoiceState | null) ?? null;
                    if (claimState === 'not_started') {
                        return handleKeyedMismatch(orderCode, 'post_gate', checkoutPromoCode != null && promoPercentOff != null);
                    }
                    return respondForKeyedRow(existing);
                }
                console.error('[checkout/xendit] CRITICAL: klaim inflight gagal & baris tidak terbaca; tanpa kompensasi (rekonsiliasi manual)', { orderCode });
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
        }
        catch (e: unknown) {
            if (keyedFlow) {
                const cls = classifyInvoiceError(e);
                const msg = e instanceof Error ? e.message : 'Gagal membuat invoice Xendit.';
                console.error('[checkout/xendit] xendit error', msg, { orderCode, cls });
                if (cls === 'unknown') {
                    const unknownMarked = await transitionInvoiceState(orderCode, ['inflight'], 'unknown');
                    if (!unknownMarked) {
                        console.error('[checkout/xendit] CRITICAL: state invoice unknown tidak tersimpan; order tetap non-attached untuk rekonsiliasi', { orderCode });
                    }
                    return NextResponse.json({
                        error: 'Status pembayaran belum diketahui. Pesanan disimpan; cek status pembayaran berkala, jangan submit ulang.',
                        retryable: true,
                        orderCode,
                        invoiceState: 'unknown' as InvoiceState,
                    }, { status: 409 });
                }
                const failed = await failKeyedOrder(orderCode, {
                    releasePromo: body.promoCode != null && promoPercentOff != null,
                    clearCoinSnapshot: false,
                });
                if (!failed) {
                    const after = await fetchKeyedRow(idempotencyKey as string).catch(() => null);
                    console.error('[checkout/xendit] CRITICAL: pembatalan order keyed (invoice definitif gagal) tidak terkonfirmasi', { orderCode, invoiceState: after?.invoice_state ?? null });
                }
                return NextResponse.json({ error: 'Gagal membuat invoice pembayaran. Silakan coba lagi.' }, { status: 502 });
            }
            const cls = classifyInvoiceError(e);
            const msg = e instanceof Error ? e.message : 'Gagal membuat invoice Xendit.';
            console.error('[checkout/xendit] xendit error', msg, { orderCode, cls });
            if (cls === 'unknown') {
                return NextResponse.json({
                    error: 'Status pembayaran belum diketahui. Pesanan disimpan; cek status pembayaran berkala, jangan submit ulang.',
                    retryable: true,
                    orderCode,
                }, { status: 409 });
            }
            await rollbackCheckoutOrder(orderCode, {
                promoClaimed: body.promoCode != null && promoPercentOff != null,
                refundCoins: pricing.coinUsed > 0,
                phase: 'post_gate',
            });
            return NextResponse.json({ error: 'Gagal membuat invoice pembayaran. Silakan coba lagi.' }, { status: 502 });
        }
        if (keyedFlow) {
            const attached = await transitionInvoiceState(orderCode, ['inflight'], 'attached', {
                xendit_invoice_id: invoice.id,
            });
            if (!attached) {
                const existing = await fetchKeyedRow(idempotencyKey as string);
                if (existing && existing.order_code) {
                    const kind = classifyReplay({
                        payment_status: existing.payment_status as string | null,
                        order_status: existing.order_status as string | null,
                        invoice_state: (existing.invoice_state as InvoiceState | null) ?? null,
                        xendit_invoice_id: existing.xendit_invoice_id as string | null,
                    });
                    if (kind === 'success' || kind === 'failed_final') {
                        return respondForKeyedRow(existing);
                    }
                }
                console.error('[checkout/xendit] CRITICAL: invoice terbuat tetapi state attached tidak tersimpan; URL invoice dikembalikan (rekonsiliasi via webhook external_id)', { orderCode, invoiceId: invoice.id });
                return NextResponse.json({
                    orderCode,
                    invoiceUrl: invoice.invoice_url,
                    invoiceId: invoice.id,
                    amount: pricing.total,
                });
            }
        }
        else {
            const { error: invoiceIdErr } = await serviceClient
                .from('orders')
                .update({ xendit_invoice_id: invoice.id })
                .eq('order_code', orderCode);
            if (invoiceIdErr) {
                console.error('[checkout/xendit] CRITICAL: gagal menyimpan xendit_invoice_id (legacy); webhook external_id tetap jalur utama', invoiceIdErr.message, { orderCode, invoiceId: invoice.id });
            }
        }
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
        if (notifErr)
            console.error('[checkout/xendit] notif order_created error', notifErr.message);
        return NextResponse.json({
            orderCode,
            invoiceUrl: invoice.invoice_url,
            invoiceId: invoice.id,
            amount: pricing.total,
        });
    }
    catch (err: unknown) {
        console.error('[checkout/xendit] unexpected', err);
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
