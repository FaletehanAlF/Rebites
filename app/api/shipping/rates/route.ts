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
import {
  resolvePackageWeightGram,
  isDefaultPackageWeight,
} from '@/lib/package-weight';
import { resolveOriginPoint } from '@/lib/store-origin-point';

export const runtime = 'nodejs';

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
        .select(
          'id, umkm_id, slug, name, category, is_delivery, weight_gram, scheduled_start, scheduled_end'
        )
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
     * Produk yang beratnya belum diisi penjual TIDAK lagi ditolak: berat
     * bawaannya diambil dari kategori (lihat lib/package-weight.ts), karena
     * 38 dari 44 produk aktif belum punya berat sehingga fitur "Diantar"
     * praktis mati untuk hampir seluruh katalog.
     */
    const weightGram = resolvePackageWeightGram(
      productRow.weight_gram,
      productRow.category as string | null
    );
    const weightIsEstimated = isDefaultPackageWeight(productRow.weight_gram);
    if (weightGram == null) {
      return NextResponse.json(
        {
          error: 'Berat produk tidak dapat ditentukan, jadi ongkir belum dapat dihitung.',
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
      .select('latitude, longitude, city')
      .eq('id', productRow.umkm_id)
      .maybeSingle();
    const vendorRow = vendor as Record<string, unknown> | null;
    /**
     * Titik asal: koordinat toko bila sudah ditandai penjual, jika tidak
     * pusat kecamatan/kota yang diisi penjual (lib/store-origin-point.ts).
     * 10 dari 13 toko belum menandai titik, dan tanpa cadangan ini semua
     * produknya tidak bisa diantar sama sekali.
     */
    const origin = resolveOriginPoint(
      vendorRow?.latitude,
      vendorRow?.longitude,
      vendorRow?.city
    );
    if (!origin.point) {
      return NextResponse.json(
        {
          error: 'Lokasi toko belum tersedia, ongkir belum dapat dihitung. Penjual perlu menandai titik lokasi toko.',
          code: 'origin_coordinates_missing',
        },
        { status: 400 }
      );
    }
    const vendorLat = origin.point.latitude;
    const vendorLng = origin.point.longitude;

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
      // Pembeli berhak tahu ongkir ini perkiraan, bukan hasil titik toko
      // yang ditandai penjual (atau berat yang benar-benar ditimbang).
      originEstimated: origin.source === 'city',
      weightEstimated: weightIsEstimated,
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
