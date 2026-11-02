import { NextRequest, NextResponse } from 'next/server';
import {
  createAnonServerClient,
  createServiceClient,
  getUserFromBearer,
  isSupabaseUnavailable,
} from '@/lib/server/supabase';
import type { ShippingRateOption } from '@/lib/types';
import { calculateTravelMinutes } from '@/lib/delivery-estimate';
import {
  REBITES_COURIER_CODE,
  REBITES_SERVICE_CODE,
  REBITES_COURIER_NAME,
  REBITES_SERVICE_NAME,
  haversineKm,
  estimateRoadDistanceKm,
  calculateDeliveryFee,
  isValidCoordinatePair,
} from '@/lib/shipping-tariff';

export const runtime = 'nodejs';

/** Bilangan bulat positif, atau null bila NULL/0/negatif/bukan angka. */
function toPositiveInt(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  const int = Math.floor(num);
  return int >= 1 ? int : null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      productSlug?: unknown;
      quantity?: unknown;
      addressId?: unknown;
      fulfillment?: unknown;
    } | null;

    const productSlug = typeof body?.productSlug === 'string' ? body.productSlug.trim() : '';
    const addressId = typeof body?.addressId === 'string' ? body.addressId.trim() : '';
    if (!productSlug || !addressId) {
      return NextResponse.json(
        { error: 'Payload tidak lengkap (productSlug, addressId wajib).', code: 'payload_incomplete' },
        { status: 400 }
      );
    }

    if (body?.fulfillment !== undefined && body.fulfillment !== 'delivery' && body.fulfillment !== 'pickup') {
      return NextResponse.json(
        { error: 'fulfillment harus delivery atau pickup.', code: 'fulfillment_invalid' },
        { status: 400 }
      );
    }
    if (body?.fulfillment === 'pickup') {
      return NextResponse.json(
        { error: 'Ongkir hanya tersedia untuk pengiriman (delivery).', code: 'fulfillment_pickup' },
        { status: 400 }
      );
    }

    const anon = createAnonServerClient();
    const { data: product, error: prodErr } = await anon
      .from('products')
      .select('id, umkm_id, slug, name, is_delivery, weight_gram')
      .eq('slug', productSlug)
      .maybeSingle();

    if (prodErr) {
      console.error('[shipping/rates] fetch product error', prodErr.message);
      return NextResponse.json({ error: 'Gagal mengambil data produk.', code: 'product_fetch_failed' }, { status: 500 });
    }
    if (!product) {
      return NextResponse.json({ error: 'Produk tidak tersedia.', code: 'product_unavailable' }, { status: 404 });
    }
    const productRow = product as Record<string, unknown>;
    if (productRow.is_delivery !== true) {
      return NextResponse.json({ error: 'Produk ini tidak tersedia untuk diantar.', code: 'product_no_delivery' }, { status: 400 });
    }
    /**
     * Berat paket dari DB, bukan dari klien.
     *
     * Checkout sudah menolak pesanan tanpa berat (`product_no_weight`), tetapi
     * endpoint ini dulu tidak memeriksanya — akibatnya pembeli melihat ongkir
     * terhitung rapi lalu ditolak saat membayar. Kegagalan yang sama dilaporkan
     * di tempat yang sama supaya pesannya konsisten.
     */
    const weightGram = toPositiveInt(productRow.weight_gram);
    if (weightGram == null) {
      return NextResponse.json(
        {
          error: 'Penjual belum mengisi berat produk ini, jadi ongkir belum dapat dihitung.',
          code: 'product_no_weight',
        },
        { status: 400 }
      );
    }
    if (!productRow.umkm_id) {
      return NextResponse.json({ error: 'Data toko produk tidak lengkap.', code: 'vendor_incomplete' }, { status: 500 });
    }

    const { data: vendor } = await anon
      .from('umkm_profiles')
      .select('latitude, longitude')
      .eq('id', productRow.umkm_id)
      .maybeSingle();
    const vendorRow = vendor as Record<string, unknown> | null;
    const vendorLat = vendorRow?.latitude;
    const vendorLng = vendorRow?.longitude;
    if (!isValidCoordinatePair(vendorLat, vendorLng)) {
      return NextResponse.json(
        {
          error: 'Koordinat toko belum tersedia, ongkir belum dapat dihitung. Lengkapi lokasi toko dulu.',
          code: 'origin_coordinates_missing',
        },
        { status: 400 }
      );
    }

    const service = createServiceClient();
    const { data: address } = await service
      .from('addresses')
      .select('latitude, longitude')
      .eq('id', addressId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!address) {
      return NextResponse.json({ error: 'Alamat pengiriman tidak ditemukan.', code: 'address_not_found' }, { status: 404 });
    }
    const addressRow = address as Record<string, unknown>;
    const destLat = addressRow.latitude;
    const destLng = addressRow.longitude;
    if (!isValidCoordinatePair(destLat, destLng)) {
      return NextResponse.json(
        {
          error: 'Koordinat alamat tujuan belum tersedia, ongkir belum dapat dihitung. Lengkapi koordinat alamat dulu.',
          code: 'dest_coordinates_missing',
        },
        { status: 400 }
      );
    }

    const straightKm = haversineKm(
      { latitude: Number(vendorLat), longitude: Number(vendorLng) },
      { latitude: Number(destLat), longitude: Number(destLng) }
    );
    const roadKm = estimateRoadDistanceKm(straightKm);
    const fee = calculateDeliveryFee(roadKm);
    // Estimasi tiba memakai fungsi yang SAMA dengan checkout dan saat kurir
    // berangkat, supaya angka di kartu ongkir tidak berbeda dengan yang
    // nanti ditampilkan di riwayat pesanan.
    const travelMinutes = calculateTravelMinutes(roadKm);

    const option: ShippingRateOption = {
      courierCode: REBITES_COURIER_CODE,
      serviceCode: REBITES_SERVICE_CODE,
      courierName: REBITES_COURIER_NAME,
      serviceName: REBITES_SERVICE_NAME,
      price: fee,
      distanceLabel: `${roadKm.toFixed(1)} km`,
      etaLabel: travelMinutes > 0 ? `±${travelMinutes} menit` : '',
      serviceType: 'standard',
    };

    return NextResponse.json({ options: [option] });
  } catch (err) {
    // Kegagalan Supabase (DNS/TLS/timeout) dulu lolos sebagai pesan mentah
    // "Supabase tidak terjangkau" yang membingungkan pembeli. Membedakan
    // penyebabnya membuat pesan bisa ditindaklanjuti.
    if (isSupabaseUnavailable(err)) {
      console.error('[shipping/rates] supabase unavailable');
      return NextResponse.json(
        {
          error:
            'Layanan sedang tidak dapat dihubungi. Ongkir belum bisa dihitung — coba lagi beberapa saat lagi.',
          code: 'service_unavailable',
        },
        { status: 503 }
      );
    }
    console.error('[shipping/rates] unexpected', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
    return NextResponse.json(
      { error: `Gagal menghitung ongkir: ${msg}`, code: 'unexpected_error' },
      { status: 500 }
    );
  }
}
