import { NextRequest, NextResponse } from 'next/server';
import { createAnonServerClient, createServiceClient, getUserFromBearer } from '@/lib/server/supabase';
import type { ShippingRateOption } from '@/lib/types';
import {
  getBiteshipRates,
  getConfiguredCouriers,
  type BiteshipPricingEntry,
  type BiteshipRateItem,
} from '@/lib/server/biteship';

export const runtime = 'nodejs';

const POSTAL_CODE_RE = /^[0-9]{5}$/;

function toPositiveInt(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  const int = Math.floor(num);
  return int >= 1 ? int : null;
}

function normalizeOptions(pricing: BiteshipPricingEntry[]): ShippingRateOption[] {
  const options: ShippingRateOption[] = [];
  for (const entry of pricing) {
    const courierCode = typeof entry.courier_code === 'string' ? entry.courier_code.trim() : '';
    const serviceCode = typeof entry.courier_service_code === 'string' ? entry.courier_service_code.trim() : '';
    const price = Number(entry.price);
    if (!courierCode || !serviceCode || !Number.isFinite(price) || price < 0) continue;
    options.push({
      courierCode,
      serviceCode,
      courierName:
        (typeof entry.courier_name === 'string' && entry.courier_name.trim()) ||
        (typeof entry.company === 'string' && entry.company.trim()) ||
        courierCode,
      serviceName:
        (typeof entry.courier_service_name === 'string' && entry.courier_service_name.trim()) ||
        (typeof entry.description === 'string' && entry.description.trim()) ||
        serviceCode,
      price: Math.round(price),
      duration: typeof entry.duration === 'string' ? entry.duration : '',
      serviceType: typeof entry.service_type === 'string' ? entry.service_type : '',
    });
  }
  return options;
}

/**
 * 7C-1: shipping rates (Biteship Sandbox) — server-authoritative.
 * Client hanya mengirim identifier (productSlug, quantity, addressId);
 * seluruh data penentu (berat, dimensi, postal, harga, courier set)
 * berasal dari database / konfigurasi server. Tanpa order, tanpa stok,
 * tanpa invoice. Tanpa fallback ongkir flat.
 */
export async function POST(req: NextRequest) {
  try {
    // DEBUG dev-only: korelasi browser request -> server auth (tanpa log JWT penuh).
    const debugId = req.headers.get('x-debug-request-id');
    const user = await getUserFromBearer(req.headers.get('authorization'), debugId);
    if (!user) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(
          `[shipping/rates]${debugId ? ` [${debugId}]` : ''} 401: getUserFromBearer=null`
        );
      }
      return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }
    if (process.env.NODE_ENV !== 'production') {
      console.debug(
        `[shipping/rates]${debugId ? ` [${debugId}]` : ''} auth OK user=${user.id.slice(0, 8)}...`
      );
    }
    // Dev-only: catat ALASAN tiap penolakan 400/404 agar penyebab data
    // (berat/postal/approval/courier) terbaca di log server. Pesan error
    // yang sama tetap dikembalikan ke client (tidak disembunyikan).
    const logDeny = (status: number, reason: string, detail?: Record<string, unknown>) => {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(
          `[shipping/rates]${debugId ? ` [${debugId}]` : ''} ${status}: ${reason}`,
          detail ?? ''
        );
      }
    };

    const body = (await req.json().catch(() => null)) as {
      productSlug?: unknown;
      quantity?: unknown;
      addressId?: unknown;
      fulfillment?: unknown;
    } | null;

    const productSlug = typeof body?.productSlug === 'string' ? body.productSlug.trim() : '';
    const addressId = typeof body?.addressId === 'string' ? body.addressId.trim() : '';
    if (!productSlug || !addressId) {
      logDeny(400, 'payload-incomplete', { hasSlug: Boolean(productSlug), hasAddress: Boolean(addressId) });
      return NextResponse.json({ error: 'Payload tidak lengkap (productSlug, addressId wajib).' }, { status: 400 });
    }

    const quantity = typeof body?.quantity === 'number' ? Math.floor(body.quantity) : NaN;
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
      logDeny(400, 'quantity-invalid', { quantity: body?.quantity });
      return NextResponse.json({ error: 'Quantity tidak valid (1–99).' }, { status: 400 });
    }

    // fulfillment opsional; rates hanya relevan untuk delivery.
    if (body?.fulfillment !== undefined && body.fulfillment !== 'delivery' && body.fulfillment !== 'pickup') {
      logDeny(400, 'fulfillment-invalid', { fulfillment: body?.fulfillment });
      return NextResponse.json({ error: 'fulfillment harus delivery atau pickup.' }, { status: 400 });
    }
    if (body?.fulfillment === 'pickup') {
      logDeny(400, 'fulfillment-pickup');
      return NextResponse.json({ error: 'Ongkir hanya tersedia untuk pengiriman (delivery).' }, { status: 400 });
    }

    const anon = createAnonServerClient();
    const { data: product, error: prodErr } = await anon
      .from('products')
      .select('id, umkm_id, slug, name, surplus_price, original_price, stock, status, verification_status, flash_sale_price, flash_sale_start, flash_sale_end, weight_gram, length_cm, width_cm, height_cm, is_delivery, is_pickup')
      .eq('slug', productSlug)
      .maybeSingle();

    if (prodErr) {
      console.error('[shipping/rates] fetch product error', prodErr.message);
      return NextResponse.json({ error: 'Gagal mengambil data produk.' }, { status: 500 });
    }
    if (!product) {
      logDeny(404, 'product-not-found', { productSlug });
      return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    }
    if ((product as Record<string, unknown>).verification_status !== 'approved') {
      logDeny(400, 'product-not-approved', {
        productSlug,
        verification_status: (product as Record<string, unknown>).verification_status ?? null,
      });
      return NextResponse.json({ error: 'Produk belum diverifikasi admin dan tidak dapat dihitung ongkirnya.' }, { status: 400 });
    }
    if ((product as Record<string, unknown>).is_delivery !== true) {
      logDeny(400, 'product-no-delivery', { productSlug });
      return NextResponse.json({ error: 'Produk ini tidak tersedia untuk diantar.' }, { status: 400 });
    }

    const productRow = product as Record<string, unknown>;

    // Berat per unit dari DB; total = per-unit x quantity (semantik 7B-2D).
    const weightGram = toPositiveInt(productRow.weight_gram);
    if (weightGram == null) {
      logDeny(400, 'product-no-weight', { productSlug, weight_gram: productRow.weight_gram ?? null });
      return NextResponse.json(
        { error: 'Data berat produk belum tersedia, ongkir delivery belum dapat dihitung.' },
        { status: 400 }
      );
    }

    if (!productRow.umkm_id) {
      return NextResponse.json({ error: 'Data toko produk tidak lengkap.' }, { status: 500 });
    }
    const { data: vendor } = await anon
      .from('umkm_profiles')
      .select('postal_code')
      .eq('id', productRow.umkm_id)
      .maybeSingle();
    const originPostalRaw = (vendor as Record<string, unknown> | null)?.postal_code;
    const originPostal = typeof originPostalRaw === 'string' ? originPostalRaw.trim() : '';
    if (!POSTAL_CODE_RE.test(originPostal)) {
      logDeny(400, 'origin-postal-invalid', { productSlug, hasVendor: Boolean(vendor) });
      return NextResponse.json(
        { error: 'Kode pos toko belum tersedia, ongkir belum dapat dihitung.' },
        { status: 400 }
      );
    }

    // Alamat buyer dari DB + kepemilikan user (jangan percaya milik orang lain).
    const service = createServiceClient();
    const { data: address } = await service
      .from('addresses')
      .select('postal_code')
      .eq('id', addressId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!address) {
      logDeny(404, 'address-not-found', { addressId });
      return NextResponse.json({ error: 'Alamat pengiriman tidak ditemukan.' }, { status: 404 });
    }
    const destPostalRaw = (address as Record<string, unknown>).postal_code;
    const destPostal = typeof destPostalRaw === 'string' ? destPostalRaw.trim() : '';
    if (!POSTAL_CODE_RE.test(destPostal)) {
      logDeny(400, 'dest-postal-invalid', { addressId });
      return NextResponse.json(
        { error: 'Kode pos alamat tujuan belum tersedia, ongkir belum dapat dihitung. Lengkapi kode pos alamat dulu.' },
        { status: 400 }
      );
    }

    const couriers = getConfiguredCouriers();
    if (couriers.length === 0) {
      console.error('[shipping/rates] BITESHIP_COURIERS belum dikonfigurasi');
      return NextResponse.json({ error: 'Layanan pengiriman belum dikonfigurasi.' }, { status: 500 });
    }

    // Harga per unit mengikuti logika checkout (surplus/flash sale); hanya untuk items[].value.
    let unitPrice = Number(productRow.surplus_price ?? productRow.original_price ?? 0);
    const flashPrice = Number(productRow.flash_sale_price ?? NaN);
    const flashStart = productRow.flash_sale_start ? new Date(productRow.flash_sale_start as string).getTime() : NaN;
    const flashEnd = productRow.flash_sale_end ? new Date(productRow.flash_sale_end as string).getTime() : NaN;
    if (Number.isFinite(flashPrice) && flashPrice > 0 && Number.isFinite(flashStart) && Number.isFinite(flashEnd)) {
      const now = Date.now();
      if (now >= flashStart && now < flashEnd) unitPrice = flashPrice;
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return NextResponse.json({ error: 'Harga produk tidak valid.' }, { status: 500 });
    }

    const item: BiteshipRateItem = {
      name: String(productRow.name ?? 'Produk'),
      category: 'food_and_drink',
      value: Math.round(unitPrice),
      quantity,
      weight: weightGram,
    };
    // Dimensi opsional: kirim hanya yang tersedia dari DB (tanpa karangan).
    const lengthCm = toPositiveInt(productRow.length_cm);
    const widthCm = toPositiveInt(productRow.width_cm);
    const heightCm = toPositiveInt(productRow.height_cm);
    if (lengthCm != null) item.length = lengthCm;
    if (widthCm != null) item.width = widthCm;
    if (heightCm != null) item.height = heightCm;

    let pricing: BiteshipPricingEntry[];
    try {
      pricing = await getBiteshipRates({
        origin_postal_code: Number(originPostal),
        destination_postal_code: Number(destPostal),
        couriers: couriers.join(','),
        items: [item],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal menghitung ongkir.';
      console.error('[shipping/rates] biteship error', msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    return NextResponse.json({ options: normalizeOptions(pricing) });
  } catch (err) {
    console.error('[shipping/rates] unexpected', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
