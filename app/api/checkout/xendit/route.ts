import { NextRequest, NextResponse } from 'next/server';
import { createAnonServerClient, createServiceClient, getSiteUrl, getUserFromBearer } from '@/lib/server/supabase';
import {
  REBITES_COURIER_CODE as REBITES_COURIER_CODE_LOCAL,
  REBITES_SERVICE_CODE as REBITES_SERVICE_CODE_LOCAL,
  REBITES_SERVICE_NAME as REBITES_SERVICE_NAME_LOCAL,
  haversineKm as haversineKmLocal,
  calculateDeliveryFee as calculateDeliveryFeeLocal,
  estimateRoadDistanceKm as estimateRoadDistanceKmLocal,
  isValidCoordinatePair as isValidCoordinatePairLocal,
} from '@/lib/shipping-tariff';
import { createXenditInvoice, getXenditInvoice } from '@/lib/server/xendit';
import {
  canTransitionInvoiceState,
  classifyCompensationRpcResult,
  classifyInvoiceError,
  classifyOrderWriteError,
  classifyReplay,
  classifyReserveOutcome,
  normalizeIdempotencyKey,
  planAbandonDeletion,
  planKeyedFailureCompensation,
  type InvoiceState,
  type KeyedFailurePhase,
} from '@/lib/server/checkout-idempotency';
import { calculatePricing } from '@/lib/server/pricing';
// Biteship tidak lagi dipakai: ongkir dihitung lokal dari koordinat.
import { estimateOrderMinutes } from '@/lib/delivery-estimate';
import { parseDistanceKm, sanitizeAddressSnapshot, buildAddressSnapshot } from '@/lib/location-validation';
import { resolvePackageWeightGram } from '@/lib/package-weight';
import { resolveOriginPoint } from '@/lib/store-origin-point';
import { isMenuScheduleVisible } from '@/lib/menu-schedule';

export const runtime = 'nodejs';

const POSTAL_CODE_RE = /^[0-9]{5}$/;

/**
 * Server-side cerminan `isOpenNow` di lib/store-status.ts (dipakai
 * VendorSection/VendorCard), tetapi dengan zona Asia/Jakarta eksplisit.
 * Format yang dikenali SAMA: "HH.MM-HH.MM" (pemisah . atau –/-).
 * Fail-open (true) bila kosong / tidak ter-parse / Intl gagal, agar penjual
 * legacy tanpa jam valid tidak terblokir. Jangan impor file 'use client'.
 */
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
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  } catch {
    return null;
  }
}

function isOpenHoursNowWib(openHours: string | null | undefined, now = new Date()): boolean {
  if (openHours == null || typeof openHours !== 'string') return true;
  const trimmed = openHours.trim();
  if (!trimmed) return true;
  const match = trimmed.match(/(\d{1,2})\.(\d{2})\s*[–-]\s*(\d{1,2})\.(\d{2})/);
  if (!match) return true;
  const open = Number(match[1]) * 60 + Number(match[2]);
  const close = Number(match[3]) * 60 + Number(match[4]);
  if (!Number.isFinite(open) || !Number.isFinite(close)) return true;
  const minutes = getWibMinutesNow(now);
  if (minutes == null) return true;
  if (open <= close) {
    return minutes >= open && minutes < close;
  }
  return minutes >= open || minutes < close;
}

/**
 * mapping berat/dimensi dari DB. NULL = belum diketahui
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
 * mapping koordinat origin dari DB. NULL = belum diketahui
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
      // identifier pilihan kurir (bukan harga/nama). Harga selalu revalidasi server.
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

    // Tahap 2D-E: kunci idempotensi per niat checkout (standar header
    // Idempotency-Key). Kunci TIDAK menggantikan identitas: buyer selalu dari
    // JWT di atas dan kunci di-scope per buyer di setiap query. Kunci
    // hilang/tidak valid -> jalur legacy tanpa idempotensi (perilaku lama).
    // Kolom DB (idempotency_key/invoice_state) memerlukan migration
    // 20261008000000; bila kolom belum ada, klaim gagal dan kode turun ke
    // jalur legacy secara otomatis (lihat claimIdempotencyKey di bawah).
    const idempotencyKey = normalizeIdempotencyKey(req.headers.get('idempotency-key'));
    const checkoutBuyerId: string = user.id;

    if (body.fulfillment !== 'delivery' && body.fulfillment !== 'pickup') {
      return NextResponse.json({ error: 'fulfillment harus delivery atau pickup.' }, { status: 400 });
    }

    if (body.fulfillment === 'delivery' && !body.addressSnapshot) {
      return NextResponse.json({ error: 'Alamat pengiriman wajib untuk delivery.' }, { status: 400 });
    }

    // sanitasi snapshot (additive: addressId + postal + lat/lng).
    // pickup -> NULL (behavior lama). delivery -> snapshot tervalidasi.
    // Legacy NULL boleh; isi non-kosong harus valid. Tanpa provider shipping.
    let addressSnapshot: Record<string, unknown> | null = null;
    if (body.fulfillment === 'delivery') {
      const { snapshot, error } = sanitizeAddressSnapshot(body.addressSnapshot);
      if (error || !snapshot) {
        return NextResponse.json({ error: error ?? 'Alamat pengiriman tidak valid.' }, { status: 400 });
      }
      // snapshot HARUS berasal dari DB, bukan dari payload client.
      // Client wajib mengirim addressId; server memvalidasi kepemilikan
      // (address.user_id === session user) dan membangun ulang snapshot.
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
      // kolom shipping ikut dibaca (sumber kebenaran package).
      .select('id, umkm_id, slug, name, category, surplus_price, original_price, stock, status, verification_status, flash_sale_price, flash_sale_start, flash_sale_end, image_url, distance_km, is_delivery, is_pickup, weight_gram, length_cm, width_cm, height_cm, scheduled_start, scheduled_end')
      .eq('slug', body.productSlug)
      .maybeSingle();

    if (prodErr) {
      console.error('[checkout/xendit] fetch product error', prodErr.message);
      return NextResponse.json({ error: 'Gagal mengambil data produk.' }, { status: 500 });
    }
    if (!product) {
      // products_select_public (20261011000000) menyembunyikan produk non-approved
      // dari role anon. PostgREST tidak membedakan "baris tidak ada" vs "baris
      // disembunyikan RLS": keduanya menghasilkan product = null tanpa error.
      // Jadi produk rejected, produk pending, dan produk yang benar-benar tidak
      // semuanya berakhir di sini. Semua itu kondisi bisnis normal, bukan
      // kegagalan server, sehingga 404 + pesan netral (bukan 500, dan bukan
      // pesan yang membocorkan bahwa produk pernah ada lalu dimoderasi).
      // Gate 'verification_status' di bawah tetap dipertahankan sebagai
      // defense-in-depth bila jalur baca ini berubah di masa depan.
      return NextResponse.json(
        { error: 'Produk tidak tersedia untuk dipesan.' },
        { status: 404 }
      );
    }

    if ((product.stock ?? 0) < quantity) {
      return NextResponse.json({ error: 'Stok tidak mencukupi.' }, { status: 400 });
    }
    if (product.status === 'sold_out' || product.status === 'hidden') {
      return NextResponse.json({ error: 'Produk sedang tidak tersedia.' }, { status: 400 });
    }
    // Produk pending/rejected (mis. ditunda admin) tidak boleh di-checkout
    // walau ID/slug diketahui. Cek server-side (jangan andalkan frontend);
    // products.status tidak diubah. Auto-approve membuat cabang ini jarang
    // terjadi untuk produk baru, TAPI tetap wajib sebagai penjaga takedown
    // admin dan sisa antrean lama.
    if ((product as Record<string, unknown>).verification_status !== 'approved') {
      return NextResponse.json(
        { error: 'Produk sedang tidak tersedia untuk dipesan.' },
        { status: 400 }
      );
    }
    // Jadwal menu ditegakkan di server, bukan hanya filter katalog: tautan
    // langsung ke produk yang belum tayang / sudah berakhir tidak boleh
    // menghasilkan pesanan.
    if (
      !isMenuScheduleVisible({
        scheduledStart:
          ((product as Record<string, unknown>).scheduled_start as string | null) ?? null,
        scheduledEnd:
          ((product as Record<string, unknown>).scheduled_end as string | null) ?? null,
      })
    ) {
      return NextResponse.json(
        { error: 'Menu ini belum tayang atau jadwalnya sudah berakhir.' },
        { status: 400 }
      );
    }
    // tegakkan kapabilitas fulfillment dari database.
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
    let promoMaxUses: number | null = null;
    let promoUsedCount = 0;
    if (body.promoCode) {
      const code = String(body.promoCode).trim().toUpperCase();
      if (code) {
        // Kolom kanonis sesuai skema DB (migrasi 0003 + seed 0004):
        // promo_codes(code, percent_off, is_valid, expires_at, ...).
        // Jangan select nama kolom lain (discount_percent/is_active) —
        // PostgREST error untuk kolom tak dikenal dan semua promo valid
        // akan tertolak 400.
        // ikut baca max_uses/used_count agar batas pemakaian
        // tervalidasi di sini; penegakan atomik via consume_promo()
        // setelah order berhasil dibuat.
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
        // batas pemakaian (format lama tanpa max_uses = tanpa batas).
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
          // percent_off dari DB, dibatasi 1..100 (CHECK di DB +
          // clamp di sini sebagai pertahanan kedua).
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
        for (const row of txs as Array<{ amount: number; type: string }>) {
          const amt = Number(row.amount) || 0;
          // saldo = (earned + refund) - spent (tipe 'refund' dari
          // migrasi P1-A dikembalikan ke sisi earned).
          if (row.type === 'earned' || row.type === 'refund') earned += amt;
          else if (row.type === 'spent') spent += amt;
        }
        coinBalance = Math.max(0, earned - spent);
      }
    }

    // calculatePricing dipanggil SETELAH revalidasi Biteship di bawah,
    // supaya deliveryFee delivery berasal dari rate ter-validasi.

    // Vendor info untuk snapshot
    let vendorName = 'Toko';
    let vendorAddress: string | null = null;
    let vendorOpenHours: string | null = null;
    // Gate toko tutup (server-authoritative): null = tidak diketahui (fail-open,
    // selaras client `isOpen ?? true`), false = penjual menandai tutup.
    let vendorIsOpen: boolean | null = null;
    // Gate toko dinonaktifkan admin: null = baris toko tidak terbaca.
    // RLS anon menyembunyikan toko nonaktif, jadi pada praktiknya `vendor`
    // bernilai null dan gate di bawah menolak pesanan.
    let vendorIsActive: boolean | null = null;
    // origin shipping tambahan (NULL = seller belum mengisi).
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
        // kolom origin shipping ikut dibaca (server-authoritative).
        // is_open ikut dibaca untuk gate toko tutup (bukan dari client).
        // is_active dibaca untuk gate toko yang dinonaktifkan admin.
        .select('business_name, address, city, postal_code, phone, latitude, longitude, open_hours, is_open, is_active, slug')
        .eq('id', product.umkm_id)
        .maybeSingle();
      if (vendor) {
        const vendorInfo = vendor as Record<string, unknown>;
        vendorName = vendorInfo.business_name as string ?? vendorName;
        vendorAddress = vendorInfo.address as string | null;
        vendorOpenHours = vendorInfo.open_hours as string | null;
        if (typeof vendorInfo.is_open === 'boolean') vendorIsOpen = vendorInfo.is_open;
        if (typeof vendorInfo.is_active === 'boolean') vendorIsActive = vendorInfo.is_active;
        vendorSlug = (vendorInfo.slug as string | undefined) ?? vendorSlug;
        // origin tambahan dari DB. NULL = seller belum mengisi.
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
    /**
     * Titik asal cadangan untuk toko yang belum menandai lokasi (10 dari 13
     * toko di database). Tanpa ini checkout menolak semua produk toko
     * tersebut, sehingga pembeli tidak punya cara memesan "Diantar".
     * Titik dari penjual selalu diutamakan (lihat resolveOriginPoint).
     */
    let originEstimated = false;
    if (vendorSlug && (!isValidCoordinatePairLocal(vendorLatitude, vendorLongitude))) {
      const fallback = resolveOriginPoint(vendorLatitude, vendorLongitude, vendorCity);
      if (fallback.point) {
        vendorLatitude = fallback.point.latitude;
        vendorLongitude = fallback.point.longitude;
        originEstimated = fallback.source === 'city';
      }
    }
    // origin shipping internal (server-authoritative, dari DB saja).
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
      estimated: originEstimated,
    };
    // PII (nama/alamat/telepon toko) hanya di-log di development.
    if (process.env.NODE_ENV !== 'production') {
      console.log('[checkout/xendit] origin dari DB', {
        productSlug: body.productSlug,
        ...originShipping,
      });
    }

    // Gate toko tutup (server-side, tidak hanya andalkan frontend).
    // 1) Toggle manual penjual: is_open === false -> tolak.
    // 2) Jam operasional: cerminan isVendorReallyOpen (isOpen && isOpenNow)
    //    dengan WIB eksplisit; fail-open bila jam kosong/tak ter-parse.
    // Ditempatkan sebelum revalidasi ongkir (Biteship), reserve_stock,
    // insert order, dan invoice agar tidak ada efek samping saat tutup.
    // Frontend membaca `error` (kontrak lama) + `code` aditif STORE_CLOSED.
    // Gate toko dinonaktifkan admin. RLS anon sudah menyembunyikan toko
    // nonaktif sehingga `vendor` biasanya null; pemeriksaan eksplisit ini
    // menutup jalur di mana baris toko masih terbaca (mis. perubahan policy
    // di masa depan) agar checkout tetap menolak.
    if (vendorIsActive === false) {
      return NextResponse.json(
        {
          error: `Toko ${vendorName} sedang tidak aktif. Silakan pilih produk dari toko lain.`,
          code: 'STORE_INACTIVE',
        },
        { status: 409 }
      );
    }
    if (vendorIsOpen === false) {
      return NextResponse.json(
        { error: `Toko ${vendorName} sedang tutup. Silakan coba lagi saat toko buka.`, code: 'STORE_CLOSED' },
        { status: 409 }
      );
    }
    if (!isOpenHoursNowWib(vendorOpenHours)) {
      const hours = vendorOpenHours?.trim()
        ? ` (${vendorOpenHours.trim()})`
        : '';
      return NextResponse.json(
        { error: `Toko ${vendorName} sedang tutup di luar jam operasional${hours}. Silakan kembali pada jam operasional.`, code: 'STORE_CLOSED' },
        { status: 409 }
      );
    }

    const productName = (product as Record<string, unknown>).name as string ?? 'Produk';
    const imageUrl = (product as Record<string, unknown>).image_url as string ?? '';

    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const orderCode = `RB-${stamp}${rand}`;
    const nowIso = new Date().toISOString();

    // distance client BUKAN sumber kebenaran shipping.
    // NULL = belum diketahui (jangan karang 1 km). Estimasi waktu memakai 0
    // saat unknown (bukan angka yang disimpan). Tanpa routing/ongkir provider.
    const distanceKm =
      parseDistanceKm(body.distanceKm) ??
      parseDistanceKm((product as Record<string, unknown>).distance_km) ??
      null;
    // package shipping HANYA dari database (sumber kebenaran).
    // Nilai weightGram/lengthCm/widthCm/heightCm yang dikirim client
    // (jika ada) SENGAJA diabaikan — tidak dipercaya, tidak dibaca.
    // weight_gram = BERAT PER UNIT (satu kemasan); maknanya tidak diubah.
    // totalPackageWeightGram = turunan jelas (per-unit x quantity) untuk
    // kebutuhan shipping nanti; dimensi diteruskan apa adanya (tanpa scaling).
    //
    // Produk tanpa berat memakai berat bawaan kategori (lib/package-weight.ts)
    // agar pesanannya tetap tercatat dengan berat yang bisa dipakai kurir.
    // Penanda `packageWeightEstimated` membedakan tebakan ini dari isian
    // penjual, sehingga laporan bisa menunjuk produk yang belum ditimbang.
    const productRow = product as Record<string, unknown>;
    const rawPackageWeight = toPackageInt(productRow.weight_gram);
    const packageWeightGram = rawPackageWeight ?? resolvePackageWeightGram(null, productRow.category as string | null);
    const packageWeightEstimated = rawPackageWeight == null;
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
        packageWeightEstimated,
        packageLengthCm,
        packageWidthCm,
        packageHeightCm,
      });
    }
    // shipping snapshot imut, dibangun server-side dari DB
    // (originShipping + package di atas). Destination tidak diduplikasi
    // (tetap di address_snapshot). Tanpa courier/service/tracking.
    // Nilai opsional yang null tetap null (tanpa dummy/fallback).
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
    // revalidasi ongkir Biteship untuk delivery.
    // Client hanya mengirim identifier (courierCode/courierServiceCode);
    // harga/nama/berat/postal SELALU dari DB + response Biteship.
    // Tanpa fallback Rp8.000 bila revalidasi gagal.
    let validatedCourierCode: string | null = null;
    let validatedCourierServiceCode: string | null = null;
    let validatedCourierServiceName: string | null = null;
    let validatedShippingRate: number | null = null;
    /**
     * Jarak tempuh yang DIHITUNG SERVER, bukan kiriman klien.
     *
     * Sebelumnya ETA memakai `body.distanceKm`, sehingga klien bisa mengirim
     * angka apa pun dan memengaruhi estimasi yang dilihat pembeli — padahal
     * ongkirnya sendiri sudah dihitung dari koordinat. Satu sumber untuk
     * keduanya: jarak yang dihitung di sini.
     */
    let serverRoadKm: number | null = null;
    if (body.fulfillment === 'delivery') {
      const reqCourierCode = typeof body.courierCode === 'string' ? body.courierCode.trim() : '';
      const reqServiceCode = typeof body.courierServiceCode === 'string' ? body.courierServiceCode.trim() : '';
      if (!reqCourierCode || !reqServiceCode) {
        return NextResponse.json({ error: 'Silakan pilih layanan pengiriman terlebih dahulu.' }, { status: 400 });
      }
      // Validasi koordinat toko & tujuan (wajib untuk ongkir lokal).
      // Memakai validator bersama: null/''/(0,0) TIDAK sah, sehingga toko yang
      // belum mengisi lokasi ditolak dengan pesan jelas alih-alih dihitung
      // seolah berada di Teluk Guinea (~11.900 km -> ongkir plafon + ETA
      // puluhan hari).
      if (!isValidCoordinatePairLocal(vendorLatitude, vendorLongitude)) {
        return NextResponse.json(
          { error: 'Koordinat toko belum tersedia, ongkir belum dapat dihitung.' },
          { status: 400 }
        );
      }
      const destLat = addressSnapshot?.latitude;
      const destLng = addressSnapshot?.longitude;
      if (!isValidCoordinatePairLocal(destLat, destLng)) {
        return NextResponse.json(
          { error: 'Koordinat alamat tujuan belum tersedia, ongkir belum dapat dihitung. Lengkapi koordinat alamat dulu.' },
          { status: 400 }
        );
      }
      // Tarif lokal (tanpa Biteship): hitung dari jarak koordinat.
      const straightKm = haversineKmLocal(
        { latitude: Number(vendorLatitude), longitude: Number(vendorLongitude) },
        { latitude: Number(destLat), longitude: Number(destLng) }
      );
      const roadKm = estimateRoadDistanceKmLocal(straightKm);
      const expectedFee = calculateDeliveryFeeLocal(roadKm);

      // Kode layanan harus sesuai tarif lokal.
      if (reqCourierCode !== REBITES_COURIER_CODE_LOCAL || reqServiceCode !== REBITES_SERVICE_CODE_LOCAL) {
        return NextResponse.json(
          { error: 'Layanan pengiriman yang dipilih sudah tidak tersedia. Silakan pilih layanan lain.' },
          { status: 400 }
        );
      }
      // Harga klien tidak dipercaya; tarif server yang dipakai.
      validatedCourierCode = REBITES_COURIER_CODE_LOCAL;
      validatedCourierServiceCode = REBITES_SERVICE_CODE_LOCAL;
      validatedCourierServiceName = REBITES_SERVICE_NAME_LOCAL;
      validatedShippingRate = expectedFee;
      // Jarak yang sama dipakai untuk ETA dan disimpan ke orders.distance_km.
      serverRoadKm = roadKm;
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
    // Jarak untuk ETA: untuk delivery pakai jarak yang DIHITUNG SERVER dari
    // koordinat (serverRoadKm), bukan angka kiriman klien. Pickup tidak
    // memakai jarak sama sekali.
    const estimateDistanceKm =
      body.fulfillment === 'delivery' && serverRoadKm != null
        ? serverRoadKm
        : (distanceKm ?? 0);
    const estimate = estimateOrderMinutes({
      fulfillment: body.fulfillment as 'delivery' | 'pickup',
      distanceKm: estimateDistanceKm,
      vendorSlug: estimateVendorSlug,
    });
    const estimatedMinutes = estimate.estimatedMinutes;
    const estimatedCompletionAt = new Date(Date.now() + estimatedMinutes * 60_000).toISOString();
    // Angka jarak yang DISIMPAN: jarak hasil hitung server untuk delivery
    // (agar riwayat & pelacakan memakai angka yang sama dengan ongkir),
    // selain itu nilai lama apa adanya (tanpa mengarang).
    const storedDistanceKm =
      body.fulfillment === 'delivery' && serverRoadKm != null ? serverRoadKm : distanceKm;

    const serviceClient = createServiceClient();

    // salin nilai request yang sudah tervalidasi ke konstanta lokal
    // agar closure di bawah tidak kehilangan narrowing TS (user/body
    // non-null sudah dijamin early-return di atas).
    const checkoutUserId: string = user.id;
    const checkoutProductSlug: string = body.productSlug;
    const checkoutPromoCode: string | null =
      typeof body.promoCode === 'string' && body.promoCode.trim()
        ? body.promoCode.trim().toUpperCase()
        : null;

    // supabase-js .rpc() RESOLVE dengan { data, error } — ia tidak
    // melempar. Karena itu try/catch SAJA tidak pernah menangkap kegagalan RPC
    // dan hasilnya sebelumnya dibuang, sehingga order tetap dihapus walau
    // refund_order_coins / release_promo gagal (koin & promo hilang jejak).
    // Helper di bawah memeriksa .error DAN tetap dibungkus try/catch (untuk
    // kegagalan jaringan yang benar-benar melempar). Hanya nama operasi,
    // orderCode, dan pesan error dari Supabase yang dicatat — tidak ada
    // parameter RPC, token, atau data sensitif.
    // Kontrak balik RPC kompensasi (semua RETURNS boolean):
    //   - release_stock: true = pelepasan stok berhasil; false = TIDAK ada
    //     yang dilepas (slug produk tidak ditemukan / qty tidak valid) ->
    //     kegagalan keras, WAJIB requireSuccessData.
    //   - refund_order_coins: false benign = tidak ada hold koin untuk order
    //     (order tanpa koin / belum dipotong) -> bukan kegagalan.
    //   - release_promo: false benign = UPDATE promo_codes 0 baris
    //     (tidak ada yang perlu dilepas) -> bukan kegagalan.
    // Catat: supabase-js RESOLVE dengan { data, error } dan tidak melempar
    // untuk kegagalan RPC; hasil boolean TIDAK diabaikan lagi. Logging hanya
    // nama operasi + reason + orderCode — tidak ada parameter RPC.
    const runCompensationRpc = async (
      orderCode: string,
      operation: string,
      params: Record<string, unknown>,
      opts?: { requireSuccessData?: boolean }
    ): Promise<boolean> => {
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
      } catch (e) {
        console.error('[checkout/xendit] kompensasi melempar', operation, {
          orderCode,
          detail: e instanceof Error ? e.message : 'unknown error',
        });
        return false;
      }
    };

    // Tahap C (audit stok/kompensasi) + I1 (retensi order): pembatalan order
    // legacy TERPUSAT. Pelepasan stok TIDAK pernah mentah di sini — order
    // ditransisikan ke terminal (payment failed + order cancelled) sehingga
    // trigger P0-B melepas stok TEPAT-1x lewat marker stock_released_at
    // (row lock yang sama dengan webhook/verify/cancel).
    // baris TIDAK PERNAH dihapus dari jalur checkout. Baris terminal
    // dipertahankan sebagai jangkar rekonsiliasi (bukti stok/koin/promo) —
    // retensi adalah perilaku yang direncanakan, bukan kegagalan.
    // Guard `payment_status = 'unpaid'`: order yang sudah PAID tidak pernah
    // diturunkan menjadi gagal. Bila webhook/verify melunasi order saat
    // update ini berjalan, update memenangkan 0 baris dan baca-ulang
    // mengenali paid -> dibiarkan apa adanya tanpa kompensasi.
    // Kontrak keputusan tetap dihitung via planAbandonDeletion (murni,
    // diuji unit): `mayDelete` sengaja TIDAK dipakai (penghapusan
    // dinonaktifkan I1); hold/stockReleased tetap menentukan logging:
    //   1. transisi terminal wajib terkonfirmasi (tepat 1 baris / reread
    //      terminal); keadaan tidak pasti TIDAK melepas apa-apa + log
    //      CRITICAL untuk rekonsiliasi manual;
    //   2. baris paid -> TIDAK ditransisikan terminal, tanpa kompensasi;
    //   3. marker pelepasan stok belum terisi -> log CRITICAL (trigger
    //      belum menangani; TIDAK ada pelepasan stok mentah di jalur ini);
    //   4. kompensasi belum sukses -> log rekonsiliasi, baris tetap ada.
    const abandonCheckoutOrder = async (
      orderCode: string,
      phase: KeyedFailurePhase,
      opts: { compensationSettled: boolean; logLabel: string }
    ): Promise<{ confirmed: boolean; stockReleased: boolean | null }> => {
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
        // Spend/klaim belum pernah tercatat -> bersihkan snapshot agar
        // trigger P1-A tidak mencetak refund tanpa spent (anti-mint).
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
      } else {
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
          console.error(
            '[checkout/xendit] CRITICAL: status pesanan tak terbaca saat rollback; TANPA tindakan lanjutan (rekonsiliasi manual)',
            { orderCode, detail: rereadErr.message }
          );
          return { confirmed: false, stockReleased: null };
        }
        const rereadRow = (reread ?? null) as MarkerRow | null;
        if (!rereadRow) {
          console.error(
            '[checkout/xendit] CRITICAL: baris pesanan TIDAK ditemukan saat rollback; status stok tidak pasti (rekonsiliasi manual)',
            { orderCode }
          );
          return { confirmed: false, stockReleased: null };
        }
        const terminal =
          rereadRow.payment_status === 'failed' ||
          rereadRow.payment_status === 'refunded' ||
          rereadRow.order_status === 'cancelled' ||
          rereadRow.order_status === 'refunded' ||
          rereadRow.order_status === 'failed';
        if (rereadRow.payment_status === 'paid') {
          // balapan dengan settlement (webhook/verify) — sudah lunas,
          // dibiarkan apa adanya. Bukan kegagalan rollback: tidak ada yang
          // perlu dikompensasi dan tidak ada downgrade status.
          return { confirmed: true, stockReleased: true };
        }
        if (!terminal) {
          console.error(
            '[checkout/xendit] CRITICAL: transisi terminal TIDAK terkonfirmasi; pesanan dibiarkan apa adanya (rekonsiliasi manual)',
            { orderCode, logLabel: opts.logLabel }
          );
          return { confirmed: false, stockReleased: null };
        }
        confirmed = true;
        markerRow = rereadRow;
      }

      // retensi order — baris TIDAK PERNAH dihapus dari jalur checkout
      // (retries/replay butuh jangkar; rekonsiliasi butuh bukti stok/koin/
      // promo). Keputusan murni planAbandonDeletion (diuji unit di
      // tests/checkout-failure-handling.test.ts) tetap dipakai untuk
      // menentukan SEVERITAS catatan: status terminal SAJA bukan bukti stok
      // dilepas — wajib marker; kompensasi belum sukses juga wajib tercatat
      // untuk rekonsiliasi. `mayDelete` sengaja tidak dipakai: penghapusan
      // dinonaktifkan I1, retensi adalah perilaku yang direncanakan —
      // DILAPORKAN sebagai retensi (console.log), BUKAN kegagalan penghapusan.
      const plan = planAbandonDeletion({
        transitionConfirmed: confirmed,
        stockReservedAt: markerRow?.stock_reserved_at ?? null,
        stockReleasedAt: markerRow?.stock_released_at ?? null,
        compensationSettled: opts.compensationSettled,
      });
      if (plan.hold === 'stock_not_released') {
        console.error(
          '[checkout/xendit] CRITICAL: marker pelepasan stok belum terisi; pesanan DIPERTAHANKAN untuk rekonsiliasi',
          { orderCode }
        );
        return { confirmed, stockReleased: plan.stockReleased };
      }
      if (plan.hold === 'compensation_pending') {
        console.error(
          '[checkout/xendit] kompensasi belum sukses: pesanan dibiarkan terminal, baris DIPERTAHANKAN untuk rekonsiliasi',
          { orderCode }
        );
        return { confirmed, stockReleased: plan.stockReleased };
      }
      // Retensi sadar: semua syarat teknis terpenuhi (transisi terminal
      // terkonfirmasi + stok aman + kompensasi sukses) — baris tetap ada
      // sebagai jangkar rekonsiliasi. Bukan kegagalan.
      console.log('[checkout/xendit] rollback: pesanan terminal DIPERTAHANKAN untuk rekonsiliasi (I1: tanpa hard delete)', {
        orderCode,
      });
      return { confirmed, stockReleased: plan.stockReleased };
    };

    // rollback terpusat untuk kegagalan SETELAH order dibuat
    // (jalur legacy). Refund koin & rilis promo memakai RPC eksplisit
    // (idempoten) SEBELUM transisi; pelepasan stok HANYA lewat transisi
    // terminal (trigger P0-B, tepat-1x — tidak ada rilis mentah). I1: baris
    // tidak pernah dihapus; bila refund/promo belum sukses, baris tetap ada
    // sebagai jejak kompensasi untuk rekonsiliasi manual.
    const rollbackCheckoutOrder = async (
      orderCode: string,
      opts: { promoClaimed: boolean; refundCoins: boolean; phase: KeyedFailurePhase }
    ): Promise<{ confirmed: boolean; stockReleased: boolean | null }> => {
      // Default true = tidak ada yang perlu dikompensasikan (bukan kegagalan).
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

      // Tahap C: hasil rollback TIDAK diabaikan. Kegagalan transisi terminal
      // TIDAK dilaporkan sebagai pembatalan yang berhasil — hasilnya
      // dipropagasikan ke pemanggil dan kegagalan dicatat untuk rekonsiliasi.
      // Respons API tidak berubah (kontrak endpoint lama).
      const abandonResult = await abandonCheckoutOrder(orderCode, opts.phase, {
        compensationSettled: refundOk && promoOk,
        logLabel: 'rollback',
      });
      if (!abandonResult.confirmed) {
        console.error(
          '[checkout/xendit] CRITICAL: rollback belum terkonfirmasi penuh; baris dibiarkan apa adanya (rekonsiliasi manual)',
          {
            orderCode,
            confirmed: abandonResult.confirmed,
            stockReleased: abandonResult.stockReleased,
          }
        );
      } else {
        console.log('[checkout/xendit] rollback selesai (I1: baris dipertahankan, tanpa hard delete)', {
          orderCode,
          confirmed: abandonResult.confirmed,
          stockReleased: abandonResult.stockReleased,
        });
      }
      return abandonResult;
    };

    // Tahap C: kegagalan INSERT order legacy TIDAK membuktikan transaksi DB
    // gagal — error jaringan supabase-js (code kosong) bisa saja COMMIT.
    // Hanya penolakan server (code PostgREST non-kosong) yang definitif:
    // pernyataan ditolak -> baris PASTI tidak ada -> satu-satunya jalur aman
    // untuk melepas stok mentah (reserve_stock sudah mengurangi stok).
    // Selain itu: baca ulang DULU; baris ada -> rollback terpusat (transisi
    // terminal, trigger melepas tepat-1x); baris tiada -> rilis mentah aman;
    // baris tak terbaca -> TANPA pelepasan + log CRITICAL (rekonsiliasi manual).
    const handleLegacyInsertFailure = async (
      orderCode: string,
      insertErr: { code?: string | null; message?: string | null },
      logLabel: string
    ): Promise<void> => {
      console.error(`[checkout/xendit] ${logLabel}`, insertErr.message ?? 'unknown error', { orderCode });
      if (classifyOrderWriteError(insertErr) === 'definitive') {
        // Stok wajib kembali bila baris order PASTI tidak ada; false di sini
        // = kegagalan keras (bukan benign) — wajib diketahui, bukan sukses.
        await runCompensationRpc(
          orderCode,
          'release_stock',
          {
            p_slug: checkoutProductSlug,
            p_quantity: quantity,
          },
          { requireSuccessData: true }
        );
        return;
      }
      const { data: reread, error: rereadErr } = await serviceClient
        .from('orders')
        .select('order_code')
        .eq('order_code', orderCode)
        .eq('buyer_id', checkoutBuyerId)
        .maybeSingle();
      if (rereadErr) {
        console.error(
          '[checkout/xendit] CRITICAL: insert gagal ambigu & baris tak terbaca; TANPA pelepasan stok (rekonsiliasi manual)',
          { orderCode, detail: rereadErr.message }
        );
        return;
      }
      if (!reread?.order_code) {
        // Stok wajib kembali bila baris order PASTI tidak ada; false di sini
        // = kegagalan keras (bukan benign) — wajib diketahui, bukan sukses.
        await runCompensationRpc(
          orderCode,
          'release_stock',
          {
            p_slug: checkoutProductSlug,
            p_quantity: quantity,
          },
          { requireSuccessData: true }
        );
        return;
      }
      await rollbackCheckoutOrder(orderCode, {
        promoClaimed: false,
        refundCoins: false,
        phase: 'pre_gate',
      });
    };

    // klaim promo atomik + potong koin atomik SETELAH order insert.
    // spend_order_coins memakai advisory lock per user sehingga dua checkout
    // bersamaan dengan saldo yang sama tidak bisa double-spend: yang kalah
    // mendapat false dan checkout-nya di-rollback (409) agar user mengulang
    // dengan saldo terbaru.
    const claimPromoAndSpendCoins = async (
      orderCode: string,
      coinUsed: number,
      // Tahap 2D-E: 'legacy' = rollback+hapus seperti dulu; 'keyed' = transisi
      // terminal failed (kompensasi via trigger P0-B/P1-A tepat-1x, TANPA hapus
      // baris agar replay kunci tetap menemukan jangkar). Hanya pemenang
      // transisi yang menjalankan release_promo.
      mode: 'legacy' | 'keyed' = 'legacy'
    ): Promise<{ ok: true } | { ok: false; status: number; error: string }> => {
      let promoClaimed = false;
      const compensate = async () => {
        if (mode === 'keyed') {
          // Klaim promo gagal -> spent tak pernah tercatat -> bersihkan
          // snapshot agar trigger tidak mencetak refund tanpa spent.
          const failed = await failKeyedOrder(orderCode, { releasePromo: promoClaimed, clearCoinSnapshot: true });
          if (!failed) {
            console.error(
              '[checkout/xendit] CRITICAL: pembatalan order keyed (klaim promo gagal) tidak terkonfirmasi',
              { orderCode }
            );
          }
        } else {
          await rollbackCheckoutOrder(orderCode, { promoClaimed: false, refundCoins: false, phase: 'pre_gate' });
        }
      };
      const compensateWithPromo = async () => {
        if (mode === 'keyed') {
          // Spend gagal -> spent tak pernah tercatat -> bersihkan snapshot.
          const failed = await failKeyedOrder(orderCode, { releasePromo: promoClaimed, clearCoinSnapshot: true });
          if (!failed) {
            console.error(
              '[checkout/xendit] CRITICAL: pembatalan order keyed (spend gagal) tidak terkonfirmasi',
              { orderCode }
            );
          }
        } else {
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

    // ---- Tahap 2D-E: klaim idempotensi (atomik via partial UNIQUE) ----
    // Ditempatkan SETELAH seluruh validasi dan SEBELUM efek samping pertama
    // (reserve_stock). Klaim = INSERT placeholder (invoice_state not_started);
    // konflik kunci = replay tanpa efek baru. UNIQUE parsial mencakup
    // (buyer_id, idempotency_key) sehingga kunci di-scope per buyer — sesuai
    // seluruh query API yang selalu menyertakan buyer_id.
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

    // Transisi invoice_state kondisional/atomik: pemenang = tepat 1 baris.
    // to='failed' selalu dikunci payment_status='unpaid' agar order paid
    // TIDAK PERNAH dibalik menjadi failed oleh request yang kalah race.
    const transitionInvoiceState = async (
      orderCode: string,
      from: InvoiceState[],
      to: InvoiceState,
      extra?: Record<string, unknown>
    ): Promise<boolean> => {
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
      if (to === 'failed') query = query.eq('payment_status', 'unpaid');
      const { data, error } = await query.select('order_code');
      if (error) {
        console.error('[checkout/xendit] transisi invoice_state gagal', error.message, { orderCode, to });
        return false;
      }
      return (data ?? []).length === 1;
    };

    // Gagal terminal jalur keyed: SATU update atomik (payment failed + order
    // cancelled + invoice_state failed). Stok + koin dikembalikan trigger
    // P0-B/P1-A tepat-1x (terbukti); promo dirilis sekali oleh pemenang.
    // Mengembalikan true hanya bila panggilan ini yang memenangkan transisi.
    // clearCoinSnapshot: true bila spend BELUM pernah tercatat (mis. gate
    // gagal) agar trigger TIDAK mencetak refund tanpa spent (anti-mint).
    // false bila spend sudah tercatat (butuh refund) atau snapshot kosong.
    // Kegagalan rilis promo TIDAK mengubah nilai balik: transisi sudah
    // terkunci terminal dan tidak dapat dibalik.
    const failKeyedOrder = async (
      orderCode: string,
      opts: { releasePromo: boolean; clearCoinSnapshot: boolean }
    ): Promise<boolean> => {
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
      if (error || !data || data.length !== 1) return false;
      if (opts.releasePromo && checkoutPromoCode) {
        // release_promo sekarang lewat runCompensationRpc, yang
        // memeriksa .error (supabase-js resolve dengan { data, error } dan
        // tidak melempar) serta tetap menangkap exception jaringan.
        //
        // Sengaja TIDAK mengulang pemanggilan: bila respons hilang atau
        // timeout, RPC bisa saja SUDAH berhasil. Pemanggilan ulang berisiko
        // melepas promo dua kali dan merusak idempotensi. Kegagalan hanya
        // dicatat (orderCode + nama operasi) agar dapat direkonsiliasi manual.
        //
        // Nilai balik TIDAK dipengaruhi kegagalan di sini: transisi order
        // sudah terkunci terminal (failed/cancelled) sebelum blok ini, dan
        // tidak boleh dibalik. Kehilangan rilis promo adalah isu kompensasi
        // terpisah, bukan hasil transisi.
        await runCompensationRpc(orderCode, 'release_promo', { p_code: checkoutPromoCode });
      }
      return true;
    };

    // Respons replay TANPA efek samping baru (lihat classifyReplay).
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
        return NextResponse.json(
          { error: 'Pesanan ini sudah dibatalkan/gagal. Silakan buat pesanan baru.', final: true, orderCode: code },
          { status: 400 }
        );
      }
      if (kind === 'attached_unpaid') {
        // invoice_url tidak disimpan di DB: ambil via GET Xendit (read-only,
        // idempoten menurut dokumen). Gagal -> 409 agar client polling verify.
        try {
          const inv = await getXenditInvoice(row.xendit_invoice_id as string);
          return NextResponse.json({
            orderCode: code,
            invoiceUrl: inv.invoice_url,
            invoiceId: row.xendit_invoice_id,
            amount: Number(row.total_price ?? 0),
            invoiceState: 'attached' as InvoiceState,
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Gagal mengambil invoice.';
          console.error('[checkout/xendit] replay invoice lookup gagal', msg, { orderCode: code });
          return NextResponse.json(
            { error: 'Pesanan sedang diproses. Cek status pembayaran berkala.', retryable: true, orderCode: code, invoiceState: state },
            { status: 409 }
          );
        }
      }
      return NextResponse.json(
        { error: 'Pesanan sedang diproses. Jangan submit ulang; cek status pembayaran berkala.', retryable: true, orderCode: code, invoiceState: state },
        { status: 409 }
      );
    };

    // Tahap 2D-G: penanganan UPDATE keyed yang mengubah 0 baris.
    // Aturan: baca ulang DULU; bila paid/terminal/attached -> replay murni
    // (tanpa kompensasi); bila DB error/hilang -> 500 TANPA kompensasi
    // spekulatif; bila masih checking pre-terminal -> gagalkan via
    // failKeyedOrder (pemenang-tunggal, trigger tepat-1x). Pre-gate berarti
    // spent tak pernah tercatat -> clearCoinSnapshot; pasca-gate (spend
    // mungkin tercatat) -> pertahankan snapshot agar trigger me-refund,
    // dan rilis promo TEPAT SEKALI bila terklaim (promo tidak ikut dipulihkan
    // trigger DB; lihat planKeyedFailureCompensation).
    // Tahap C: klaim "Pesanan dibatalkan" HANYA setelah transisi terminal
    // terkonfirmasi menang (atau baris terbaca berstatus terminal/paid).
    const handleKeyedMismatch = async (
      orderCode: string,
      phase: KeyedFailurePhase,
      promoClaimed: boolean
    ) => {
      let row: KeyedRow | null = null;
      try {
        row = await fetchKeyedRow(idempotencyKey as string);
      } catch {
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
      if (after && after.order_code) return respondForKeyedRow(after);
      if (failed) {
        return NextResponse.json(
          { error: 'Pesanan dibatalkan. Silakan buat pesanan baru.', final: true, orderCode },
          { status: 400 }
        );
      }
      console.error('[checkout/xendit] CRITICAL: transisi gagal terminal tidak terkonfirmasi', {
        orderCode,
      });
      return NextResponse.json(
        {
          error: 'Status pesanan belum dapat dipastikan. Cek riwayat pesanan sebelum mencoba lagi.',
          orderCode,
        },
        { status: 500 }
      );
    };

    // Tahap 1.3: free legacy — paid-mark GAGAL (0 baris / error).
    //
    // Baca ulang kebenaran baris order (order_code + buyer_id) lalu putuskan:
    //   - paid     -> dibiarkan apa adanya (anti-downgrade paid; order mungkin
    //                 sudah lunas) -> 409 retryable, client memantau status.
    //   - terminal -> transisi terminal SUDAH terjadi (kompensasi trigger
    //                 P0-B/P1-A + RPC sudah jalan) -> JANGAN kompensasi lagi.
    //   - unpaid  -> gate SUDAH lolos: kompensasi penuh (refund koin + rilis
    //                 promo sekali + transisi terminal). phase 'post_gate'
    //                 mempertahankan snapshot koin agar trigger P1-A
    //                 me-refund tepat-1x (anti-mint) dan mencabut reward.
    //
    // TIDAK PERNAH: menghapus baris (retensi I1), menurunkan paid menjadi
    // failed, atau melepas stok mentah (trigger P0-B satu-satunya jalur
    // pelepasan setelah baris order ada).
    //
    // CATATAN: fungsi ini TIDAK boleh membaca kolom 2D-E (invoice_state /
    // idempotency_key) — jalur legacy justru dipakai saat kolom tersebut
    // belum ada di database.
    const handleLegacyFreePaidMarkFailure = async (orderCode: string) => {
      const { data: reread, error: rereadErr } = await serviceClient
        .from('orders')
        .select('order_code, payment_status, order_status')
        .eq('order_code', orderCode)
        .eq('buyer_id', checkoutBuyerId)
        .maybeSingle();
      const row = (reread ?? null) as KeyedRow | null;
      if (rereadErr || !row?.order_code) {
        console.error(
          '[checkout/xendit] CRITICAL: paid-mark free legacy tidak terkonfirmasi & baris tak terbaca; tanpa kompensasi (rekonsiliasi manual)',
          { orderCode, detail: rereadErr?.message ?? null }
        );
        return NextResponse.json(
          {
            error: 'Status pesanan belum dapat dipastikan. Cek riwayat pesanan sebelum mencoba lagi.',
            orderCode,
          },
          { status: 500 }
        );
      }
      const payment = row.payment_status as string | null;
      const order = row.order_status as string | null;
      if (payment === 'paid') {
        // Sudah lunas (mis. balapan settlement) -> dibiarkan apa adanya.
        console.error(
          '[checkout/xendit] paid-mark free legacy: pesanan sudah lunas; dibiarkan apa adanya (tanpa downgrade status)',
          { orderCode }
        );
        return NextResponse.json(
          {
            error: 'Pesanan sedang diproses. Cek status pembayaran berkala.',
            retryable: true,
            orderCode,
          },
          { status: 409 }
        );
      }
      const terminal =
        payment === 'failed' ||
        payment === 'refunded' ||
        order === 'cancelled' ||
        order === 'refunded' ||
        order === 'failed';
      if (terminal) {
        // Transisi terminal sudah terjadi -> kompensasi (stok/koin/promo)
        // sudah dijalankan trigger/RPC. JANGAN kompensasi dua kali.
        return NextResponse.json(
          { error: 'Pesanan ini sudah dibatalkan/gagal. Silakan buat pesanan baru.', final: true, orderCode },
          { status: 400 }
        );
      }
      const result = await rollbackCheckoutOrder(orderCode, {
        promoClaimed: checkoutPromoCode != null && promoPercentOff != null,
        refundCoins: pricing.coinUsed > 0,
        phase: 'post_gate',
      });
      if (!result.confirmed) {
        console.error(
          '[checkout/xendit] CRITICAL: kompensasi free legacy (paid-mark gagal) belum terkonfirmasi; baris dipertahankan untuk rekonsiliasi',
          { orderCode, confirmed: result.confirmed, stockReleased: result.stockReleased }
        );
        return NextResponse.json(
          {
            error: 'Status pesanan belum dapat dipastikan. Cek riwayat pesanan sebelum mencoba lagi.',
            orderCode,
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: 'Pesanan dibatalkan. Silakan buat pesanan baru.', final: true, orderCode },
        { status: 400 }
      );
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
      } else if (claimErr.code === '23505') {
        // Kunci sudah dipakai (paralel/retry/crash-retry): replay murni.
        const existing = await fetchKeyedRow(idempotencyKey);
        if (existing && existing.order_code) return respondForKeyedRow(existing);
        console.error('[checkout/xendit] konflik kunci tanpa baris', claimErr.message);
        return NextResponse.json({ error: 'Gagal membuat pesanan.' }, { status: 500 });
      } else if (
        claimErr.code === '42703' ||
        /idempotency_key|invoice_state/i.test(claimErr.message ?? '')
      ) {
        // Migration 2D-E belum dijalankan di database ini -> jalur legacy.
        console.warn('[checkout/xendit] kolom idempotensi belum ada, memakai jalur legacy');
      } else {
        console.error('[checkout/xendit] klaim idempotensi gagal', claimErr.message);
        return NextResponse.json({ error: 'Gagal membuat pesanan.' }, { status: 500 });
      }
    }

    if (keyedFlow) {
      // Tahap 2D-J (Desain B audit 2D-I): decrement stok + marker
      // stock_reserved_at dalam SATU transaksi (reserve_stock_for_order).
      // Crash-sebelum = tak terjadi (retry aman); crash-sesudah = marker
      // tercatat (jalur trigger pulih). Stok-kurang = false tanpa tulisan;
      // klaim-marker gagal = EXCEPTION + rollback decrement (bukan false).
      // Bedakan via baca ulang di bawah: terminal -> replay; bertanda =
      // reservasi terbukti -> lanjut; tak bertanda = gagalkan TANPA
      // release_stock mentah.
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
        const rereadRow = (reread ?? null) as (KeyedRow & { stock_reserved_at?: string | null }) | null;
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
        // Baris terminal/attached/paid (mis. digagalkan konkuren saat RPC
        // melempar): replay murni, TANPA kompensasi baru.
        if (kind !== 'checking') return respondForKeyedRow(rereadRow);
        // Tahap C: bedakan stok kurang dari kegagalan teknis (fungsi belum
        // ada/izin/jaringan) — marker terbukti = reservasi sukses.
        const outcome = classifyReserveOutcome({
          reserved,
          error: reserveErr,
          markerSet: rereadRow.stock_reserved_at != null,
        });
        if (outcome === 'reserved') {
          // Commit tak terlihat (respons hilang padahal marker tercatat):
          // reservasi terbukti milik order ini -> lanjutkan alur.
          reservedOk = true;
        } else {
          const failed = await failKeyedOrder(orderCode, { releasePromo: false, clearCoinSnapshot: false });
          if (!failed) {
            const after = await fetchKeyedRow(idempotencyKey as string).catch(() => null);
            if (after && after.order_code) return respondForKeyedRow(after);
            console.error('[checkout/xendit] CRITICAL: transisi gagal-reservasi tidak terkonfirmasi', {
              orderCode,
              outcome,
            });
            return NextResponse.json(
              {
                error: 'Status pesanan belum dapat dipastikan. Cek riwayat pesanan sebelum mencoba lagi.',
                orderCode,
              },
              { status: 500 }
            );
          }
          if (outcome === 'insufficient_stock') {
            return NextResponse.json({ error: 'Stok tidak mencukupi, pesanan dibatalkan.' }, { status: 400 });
          }
          // technical_error: JANGAN mengklaim stok habis — penyebabnya bisa
          // fungsi RPC belum terpasang, izin, atau kegagalan jaringan.
          return NextResponse.json({ error: 'Gagal mengunci stok. Coba lagi.' }, { status: 500 });
        }
      }
    } else {
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
        // Tahap 1.3: order free DITULIS sebagai 'unpaid'/'pending' (identik
        // jalur keyed dan jalur paid). Status 'paid' hanya ditulis SETELAH
        // gate promo+koin lolos (lihat penanda paid di bawah).
        //
        // Kalau order free lahir 'paid', kegagalan gate tidak dapat
        // dikompensasi: guard unpaid mencegah transisi terminal, sehingga
        // trigger P0-B tidak pernah melepas stok dan order tertinggal berstatus
        // paid + stok terkunci. Menulis 'unpaid' sejak awal membuat jalur
        // legacy memakai mekanisme kompensasi yang sama dengan jalur keyed
        // (transisi terminal -> trigger P0-B/P1-A tepat-1x).
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
        // Jalur keyed: placeholder sudah ada -> UPDATE kondisional (pemenang =
        // tepat 1 baris). P0: JANGAN tandai paid di sini — baris ditulis
        // unpaid/pending dulu; status paid hanya setelah gate promo/koin
        // lolos (lihat penanda paid di bawah). Invarian "paid tak pernah
        // dibalik" tetap utuh karena failKeyedOrder mensyaratkan unpaid.
        // Tahap 1.3: payload free pun kini unpaid/pending, jadi penulisan
        // eksplisit di sini bersifat penguat (pagar), bukan satu-satunya.
        const { data: keyedUpd, error: keyedUpdErr } = await serviceClient
          .from('orders')
          .update({ ...freeInsertPayload, payment_status: 'unpaid', order_status: 'pending', invoice_state: 'not_started' } as Record<string, unknown>)
          .eq('order_code', orderCode)
          .eq('buyer_id', checkoutBuyerId)
          .in('invoice_state', ['not_started'] as InvoiceState[])
          .select('order_code');
        if (keyedUpdErr || !keyedUpd || keyedUpd.length !== 1) {
          if (keyedUpdErr) console.error('[checkout/xendit] keyed free update error', keyedUpdErr.message, { orderCode });
          return handleKeyedMismatch(orderCode, 'pre_gate', false);
        }
      } else {
        let { error: insertErr } = await serviceClient.from('orders').insert(freeInsertPayload);
        if (
          insertErr &&
          // Tahap C: retry tanpa kolom HANYA untuk penolakan DB definitif
          // (punya kode PostgREST). Penolakan definitif membuktikan pernyataan
          // tidak pernah COMMIT, sehingga retry TIDAK mungkin menciptakan
          // order duplikat. Error ambigu (jaringan/timeout, tanpa kode)
          // TIDAK boleh masuk jalur retry — permintaan pertama bisa saja sudah
          // commit; tangani lewat handleLegacyInsertFailure (baca ulang),
          // bukan INSERT ulang.
          classifyOrderWriteError(insertErr) === 'definitive' &&
          (insertErr.message.includes('shipping_snapshot') || insertErr.message.includes('courier_code') || insertErr.message.includes('shipping_rate'))
        ) {
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
          await handleLegacyInsertFailure(orderCode, insertErr, 'insert free order error');
          return NextResponse.json({ error: 'Gagal membuat pesanan.' }, { status: 500 });
        }
      }

      if (pricing.coinUsed > 0 || pricing.coinEarned > 0) {
        // reservasi koin atomik (gagal -> rollback order + stok).
        const gate = await claimPromoAndSpendCoins(orderCode, pricing.coinUsed, keyedFlow ? 'keyed' : 'legacy');
        if (!gate.ok) {
          return NextResponse.json({ error: gate.error }, { status: gate.status });
        }
        // Reward dikreditkan setelah gate promo/koin lolos; penandaan paid
        // menyusul setelah blok ini (Tahap 1.3).
        // Idempoten: cek existing dulu (kolom unik per order+type).
        if (pricing.coinEarned > 0) {
          const { data: existing } = await serviceClient
            .from('coin_transactions')
            .select('type')
            .eq('user_id', user.id)
            .eq('order_code', orderCode);
          const existingTypes = new Set(
            ((existing ?? []) as Array<{ type: string }>).map((r) => r.type)
          );
          if (!existingTypes.has('earned')) {
            const { error: earnErr } = await serviceClient.from('coin_transactions').insert({
              user_id: user.id,
              order_code: orderCode,
              type: 'earned',
              amount: pricing.coinEarned,
              description: 'Reward pembelian',
            });
            if (earnErr) console.error('[checkout/xendit] coin earn error', earnErr.message, { orderCode });
          }
        }
      } else if (body.promoCode && promoPercentOff != null) {
        // Order tanpa koin tetap perlu klaim promo atomik.
        const gate = await claimPromoAndSpendCoins(orderCode, 0, keyedFlow ? 'keyed' : 'legacy');
        if (!gate.ok) {
          return NextResponse.json({ error: gate.error }, { status: gate.status });
        }
      }

      // Tahap 1.3: tandai paid SETELAH gate promo/koin lolos — di KEDUA
      // jalur (keyed dan free legacy). Pagar: order_code + buyer_id +
      // payment_status='unpaid' -> 0 baris berarti baris sudah berubah,
      // jadi JANGAN lanjut seolah-olah pembayaran berhasil.
      // Invarian "paid tak pernah dibalik" tetap utuh: baris belum pernah
      // paid saat penandaan ini dijalankan.
      let paidMarkQuery = serviceClient
        .from('orders')
        .update({ payment_status: 'paid', order_status: 'paid' } as Record<string, unknown>)
        .eq('order_code', orderCode)
        .eq('buyer_id', checkoutBuyerId)
        .eq('payment_status', 'unpaid');
      if (keyedFlow) {
        // Pagar tambahan jalur keyed: placeholder 2D-E harus masih di state
        // 'not_started' (belum pernah diklaim invoice).
        paidMarkQuery = paidMarkQuery.in('invoice_state', ['not_started'] as InvoiceState[]);
      }
      const { data: paidMark, error: paidMarkErr } = await paidMarkQuery.select('order_code');
      if (paidMarkErr || !paidMark || paidMark.length !== 1) {
        if (paidMarkErr) console.error('[checkout/xendit] free paid-mark error', paidMarkErr.message, { orderCode });
        if (keyedFlow) {
          // Pasca-gate: spent mungkin tercatat -> pertahankan snapshot refund.
          // Post-gate: gate promo/koin sudah lolos -> promo mungkin terklaim.
          // Rilis sekali bila terklaim; snapshot koin dipertahankan agar
          // trigger DB me-refund tepat satu kali.
          return handleKeyedMismatch(
            orderCode,
            'post_gate',
            checkoutPromoCode != null && promoPercentOff != null
          );
        }
        // Jalur free legacy: paid-mark gagal -> baca ulang kebenaran baris,
        // lalu kompensasi / beri tahu sesuai kondisi nyata (tidak pernah
        // sukses palsu, tidak pernah downgrade paid, tidak pernah hapus).
        return handleLegacyFreePaidMarkFailure(orderCode);
      }

      const siteUrl = getSiteUrl(req);
      const deepHref = `/riwayatPesanan?orderId=${encodeURIComponent(orderCode)}`;
      // Tahap 2D-E: dedup notif gratis (pola order-settlement): retry/crash
      // tidak boleh menggandakan payment_success/order_created.
      const { data: existingFreeNotifs } = await serviceClient
        .from('notifications')
        .select('type')
        .eq('user_id', user.id)
        .eq('reference_id', orderCode)
        .in('type', ['payment_success', 'order_created']);
      const existingFreeTypes = new Set(
        ((existingFreeNotifs ?? []) as Array<{ type: string }>).map((r) => r.type)
      );
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
      let notifErr: { message: string } | null = null;
      if (freeNotifs.length > 0) {
        const { error } = await serviceClient.from('notifications').insert(freeNotifs);
        notifErr = error as { message: string } | null;
      }
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
      // Jalur keyed: placeholder sudah ada -> UPDATE kondisional (pemenang =
      // tepat 1 baris). 0 baris = kalah race -> replay, TANPA efek baru.
      const { data: keyedUpd, error: keyedUpdErr } = await serviceClient
        .from('orders')
        .update({ ...insertPayload, invoice_state: 'not_started' } as Record<string, unknown>)
        .eq('order_code', orderCode)
        .eq('buyer_id', checkoutBuyerId)
        .in('invoice_state', ['not_started'] as InvoiceState[])
        .select('order_code');
      if (keyedUpdErr || !keyedUpd || keyedUpd.length !== 1) {
        if (keyedUpdErr) console.error('[checkout/xendit] keyed update error', keyedUpdErr.message, { orderCode });
        return handleKeyedMismatch(orderCode, 'pre_gate', false);
      }
    } else {
      const { error: insertErr } = await serviceClient.from('orders').insert(insertPayload);
      if (insertErr) {
        console.error('[checkout/xendit] insert order error', insertErr.message);

      // Tahap C: retry INSERT hanya untuk penolakan definitif (lihat catatan
      // pada jalur free order di atas) — error ambigu dilarang masuk jalur
      // retry agar tidak mungkin tercipta order duplikat.
      const insertDefinitive = classifyOrderWriteError(insertErr) === 'definitive';
      if (insertDefinitive && (insertErr.message.includes('shipping_snapshot') || insertErr.message.includes('courier_code') || insertErr.message.includes('shipping_rate'))) {
        // Skema DB lama tanpa kolom snapshot/kurir - coba ulang tanpa field tersebut.
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
      } else if (insertDefinitive && (insertErr.message.includes('umkm_id') || insertErr.message.includes('product_id'))) {
        // Skema DB lama tanpa kolom umkm_id/product_id - coba ulang tanpa snapshot relasi.
        // PENTING: stok TIDAK dilepas dulu di sini. Jika retry berhasil, stok yang
        // sudah dikunci reserve_stock tetap terpakai (mencegah oversell).
        const retry = { ...insertPayload };
        delete (retry as Record<string, unknown>).umkm_id;
        delete (retry as Record<string, unknown>).product_id;
        const { error: retryErr } = await serviceClient.from('orders').insert(retry);
        if (retryErr) {
          await handleLegacyInsertFailure(orderCode, retryErr, 'retry insert error');
          return NextResponse.json({ error: 'Gagal membuat pesanan (DB).' }, { status: 500 });
        }
      } else {
        // Insert gagal — kompensasi aman terpusat (lihat handleLegacyInsertFailure).
        await handleLegacyInsertFailure(orderCode, insertErr, 'insert order error');
        return NextResponse.json({ error: 'Gagal membuat pesanan.' }, { status: 500 });
      }
    }
    }

    // reservasi koin + klaim promo atomik SETELAH order insert
    // (sebelum invoice). Gagal -> rollback penuh, user mengulang.
    {
      const gate = await claimPromoAndSpendCoins(orderCode, pricing.coinUsed, keyedFlow ? 'keyed' : 'legacy');
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
      }
    }

    // Tahap 2D-E: klaim hak pembuatan invoice (hanya pemenang yang boleh
    // memanggil Xendit). Kalah -> replay, TANPA invoice kedua.
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
          if (kind !== 'checking') return respondForKeyedRow(existing);
          const claimState = (existing.invoice_state as InvoiceState | null) ?? null;
          if (claimState === 'not_started') {
            // B-3 (Tahap 1): klaim inflight SELALU mendahului
            // createXenditInvoice, jadi state not_started membuktikan belum
            // pernah ada invoice untuk order ini -> aman dikompensasi lewat
            // pola yang sudah idempoten (pemenang tunggal). Gate koin/promo
            // sudah berjalan sebelum klaim ini -> post_gate: pertahankan
            // snapshot (trigger refund tepat-1x) + rilis promo sekali bila
            // terklaim.
            return handleKeyedMismatch(
              orderCode,
              'post_gate',
              checkoutPromoCode != null && promoPercentOff != null
            );
          }
          // State inflight/unknown: invoice mungkin sudah terbit dari attempt
          // sebelumnya yang crash -> JANGAN kompensasi; rekonsiliasi berbasis
          // external_id (Tahap B-2). Replay murni tanpa efek baru.
          return respondForKeyedRow(existing);
        }
        console.error(
          '[checkout/xendit] CRITICAL: klaim inflight gagal & baris tidak terbaca; tanpa kompensasi (rekonsiliasi manual)',
          { orderCode }
        );
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
      if (keyedFlow) {
        // Klasifikasi konservatif: unknown -> simpan state + pertahankan
        // order (JANGAN hapus, JANGAN kompensasi); definitive -> gagal
        // terminal 1x. TIDAK PERNAH membuat invoice pengganti otomatis.
        const cls = classifyInvoiceError(e);
        const msg = e instanceof Error ? e.message : 'Gagal membuat invoice Xendit.';
        console.error('[checkout/xendit] xendit error', msg, { orderCode, cls });
        if (cls === 'unknown') {
          const unknownMarked = await transitionInvoiceState(orderCode, ['inflight'], 'unknown');
          if (!unknownMarked) {
            console.error(
              '[checkout/xendit] CRITICAL: state invoice unknown tidak tersimpan; order tetap non-attached untuk rekonsiliasi',
              { orderCode }
            );
          }
          return NextResponse.json(
            {
              error: 'Status pembayaran belum diketahui. Pesanan disimpan; cek status pembayaran berkala, jangan submit ulang.',
              retryable: true,
              orderCode,
              invoiceState: 'unknown' as InvoiceState,
            },
            { status: 409 }
          );
        }
        const failed = await failKeyedOrder(orderCode, {
          releasePromo: body.promoCode != null && promoPercentOff != null,
          // Spend SUDAH tercatat di tahap ini -> pertahankan snapshot agar
          // trigger mengembalikan hold (jangan clear).
          clearCoinSnapshot: false,
        });
        if (!failed) {
          const after = await fetchKeyedRow(idempotencyKey as string).catch(() => null);
          console.error(
            '[checkout/xendit] CRITICAL: pembatalan order keyed (invoice definitif gagal) tidak terkonfirmasi',
            { orderCode, invoiceState: after?.invoice_state ?? null }
          );
        }
        // Detail error internal HANYA ke server log; respons klien generik
        // agar tidak membocorkan pesan Xendit ke buyer.
        return NextResponse.json(
          { error: 'Gagal membuat invoice pembayaran. Silakan coba lagi.' },
          { status: 502 },
        );
      }
      // I1 (legacy invoice): klasifikasi yang sama dengan jalur keyed.
      // Konservatif: hasil yang tidak dapat dipastikan TIDAK dianggap invoice
      // tidak ada — Xendit dapat menerbitkan invoice walau respons hilang
      // (timeout 10s klien vs pemrosesan server invoice yang lebih lambat).
      const cls = classifyInvoiceError(e);
      const msg = e instanceof Error ? e.message : 'Gagal membuat invoice Xendit.';
      console.error('[checkout/xendit] xendit error', msg, { orderCode, cls });
      // I1 (legacy invoice unknown): timeout/jaringan/429/5xx -> TIDAK ada
      // rollback: pesanan DIPERTAHANKAN unpaid — tanpa refund koin, tanpa
      // pelepasan promo, tanpa transisi terminal, tanpa penghapusan, dan
      // TANPA invoice pengganti otomatis (klaim keyed/inflight mencegah
      // itu di jalur keyed; legacy tidak punya klaim, jadi kehati-hatian:
      // jangan buat efek baru). Rekonsiliasi: webhook (external_id =
      // orderCode) menentukan nasib invoice yang ternyata terbit; buyer
      // memantau via halaman pesanan.
      if (cls === 'unknown') {
        return NextResponse.json(
          {
            error: 'Status pembayaran belum diketahui. Pesanan disimpan; cek status pembayaran berkala, jangan submit ulang.',
            retryable: true,
            orderCode,
          },
          { status: 409 }
        );
      }
      // I1 (legacy invoice definitive): Xendit menolak pembuatan invoice
      // (4xx selain 429) -> invoice PASTI tidak terbit -> kompensasi penuh
      // lewat rollback terpusat (refund koin + rilis promo + transisi
      // terminal unpaid->failed; trigger melepas stok tepat-1x). Guard unpaid
      // di abandonCheckoutOrder memastikan order yang sudah settle tidak
      // ikut dibatalkan.
      await rollbackCheckoutOrder(orderCode, {
        promoClaimed: body.promoCode != null && promoPercentOff != null,
        refundCoins: pricing.coinUsed > 0,
        phase: 'post_gate',
      });
      // Detail error internal HANYA ke server log; respons klien generik.
      return NextResponse.json(
        { error: 'Gagal membuat invoice pembayaran. Silakan coba lagi.' },
        { status: 502 },
      );
    }

    if (keyedFlow) {
      // Simpan ID invoice + tandai attached secara kondisional. Gagal
      // menyimpan (0 baris) -> JANGAN buat pengganti; baca ulang kebenaran.
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
          // Paid/terminal: replay murni — JANGAN menyodorkan URL pembayaran
          // untuk order yang sudah lunas/dibatalkan.
          if (kind === 'success' || kind === 'failed_final') {
            return respondForKeyedRow(existing);
          }
        }
        // B-3 (Tahap 1): invoice SUDAH terbuat pada permintaan ini (`invoice`)
        // dan TIDAK dibuat ulang (klaim keyed = maksimum satu invoice per
        // order). Yang gagal hanyalah penyimpanan state — jangan tinggalkan
        // pembeli tanpa cara membayar: kembalikan URL invoice yang sama,
        // tanpa kompensasi/rollback. Settlement & kedaluwarsa tetap
        // direkonsiliasi webhook via external_id = orderCode (tidak
        // bergantung pada tersimpannya xendit_invoice_id).
        console.error(
          '[checkout/xendit] CRITICAL: invoice terbuat tetapi state attached tidak tersimpan; URL invoice dikembalikan (rekonsiliasi via webhook external_id)',
          { orderCode, invoiceId: invoice.id }
        );
        return NextResponse.json({
          orderCode,
          invoiceUrl: invoice.invoice_url,
          invoiceId: invoice.id,
          amount: pricing.total,
        });
      }
    } else {
      // Observability: kegagalan menyimpan ID invoice TIDAK menghalangi
      // pembayaran (URL tetap dikembalikan di bawah; webhook memakai
      // external_id), tetapi WAJIB tercatat agar state non-attached tidak
      // buta.
      const { error: invoiceIdErr } = await serviceClient
        .from('orders')
        .update({ xendit_invoice_id: invoice.id })
        .eq('order_code', orderCode);
      if (invoiceIdErr) {
        console.error(
          '[checkout/xendit] CRITICAL: gagal menyimpan xendit_invoice_id (legacy); webhook external_id tetap jalur utama',
          invoiceIdErr.message,
          { orderCode, invoiceId: invoice.id }
        );
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
