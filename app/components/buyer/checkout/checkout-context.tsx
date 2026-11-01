'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import type {
  DeliveryAddress,
  FulfillmentMode,
  OrderDraft,
  PaymentMethod,
  PromoCode,
  ShippingRateOption,
  StoredOrder,
} from '@/lib/types';
import { useOrderCalculation } from '@/hooks/buyer/use-order-calculation';
import { useRebitesCoins } from '@/hooks/buyer/use-rebites-coins';
import { useCurrentUser } from '@/lib/current-user';
import {
  useAddresses,
  type AddressFormValues,
} from '@/hooks/buyer/use-addresses';
import { validatePromoCode } from '@/lib/catalog';
import { AuthError, fetchWithAuth, getValidAuthHeader } from '@/lib/auth-token';
import { getOrderById } from '@/lib/order-storage';
import { buildAddressRateSignature, buildAddressSnapshot } from '@/lib/location-validation';
import { paymentMethods } from './payment-methods';

/**
 * Tahap 1 (konsistensi harga): total server ≠ total yang tampil saat pesanan
 * dibuat (harga katalog / ongkir / koin berubah antara load dan submit).
 * Dialog konfirmasi ditampilkan sebelum redirect ke Xendit.
 */
export interface PendingInvoiceReview {
  invoiceUrl: string;
  serverTotal: number;
  displayTotal: number;
}

interface CheckoutContextValue {
  draft: OrderDraft;
  methods: PaymentMethod[];
  quantity: number;
  increment: () => void;
  decrement: () => void;
  canDecrement: boolean;
  canIncrement: boolean;

  fulfillment: FulfillmentMode;
  setFulfillment: (mode: FulfillmentMode) => void;

  addresses: DeliveryAddress[];
  selectedAddress: DeliveryAddress | null;
  selectedAddressId: string | null;
  selectAddress: (id: string) => void;
  addAddress: (values: AddressFormValues) => void;
  updateAddress: (id: string, values: AddressFormValues) => void;

  selectedMethod: PaymentMethod | null;
  selectMethod: (id: string) => void;

  promo: PromoCode | null;

  coinBalance: number;
  useCoins: boolean;
  toggleUseCoins: (on: boolean) => void;

  summary: ReturnType<typeof useOrderCalculation>;
  canPay: boolean;
  missingRequirement: string | null;
  submitting: boolean;
  submitOrder: () => void;

  successOrder: StoredOrder | null;

  /**
   * Tahap 1: non-null = total server berbeda dari tampilan; tunggu keputusan
   * user sebelum redirect ke Xendit (lihat CheckoutPriceReviewDialog).
   */
  pendingInvoiceReview: PendingInvoiceReview | null;
  /** Redirect ke invoice Xendit setelah user menyetujui total terbaru. */
  continueToInvoice: () => void;

  /** opsi ongkir Biteship (display-only; harga final tetap revalidasi server). */
  shippingOptions: ShippingRateOption[];
  /** pilihan kurir user (identifier saja, bukan harga). Tidak auto-select. */
  selectedShipping: { courierCode: string; serviceCode: string } | null;
  setSelectedShipping: (next: { courierCode: string; serviceCode: string } | null) => void;
  /** opsi yang cocok dengan pilihan (null bila belum/stale). Untuk display pricing. */
  selectedShippingOption: ShippingRateOption | null;
  shippingLoading: boolean;
  shippingError: string | null;
  /** Kode penyebab gagal hitung ongkir dari API (machine-readable), null bila bukan dari API. */
  shippingErrorCode: string | null;
}

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

const SHIPPING_CACHE_TTL_MS = 5 * 60 * 1000;
const shippingRatesCache = new Map<
  string,
  { options: ShippingRateOption[]; expiresAt: number }
>();
const shippingRatesInFlight = new Map<string, Promise<ShippingRateOption[]>>();

/** Error ongkir membawa `code` dari API (machine-readable) untuk arahan UI per penyebab. */
class ShippingRatesError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'ShippingRatesError';
    this.code = code;
  }
}

// Keystroke-frequency state lives in its own context: every promoInput change
// used to change the main context value and re-render all 11 checkout
// consumers (payment summary, sticky bar, steppers, ...). Only the promo
// input subscribes to this one.
interface PromoInputContextValue {
  promoInput: string;
  setPromoInput: (value: string) => void;
  promoError: string | null;
  applyPromo: () => void;
  clearPromo: () => void;
}

const PromoInputContext = createContext<PromoInputContextValue | null>(null);


export function useCheckout() {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error('useCheckout must be used within CheckoutProvider');
  return ctx;
}

export function usePromoInput() {
  const ctx = useContext(PromoInputContext);
  if (!ctx) throw new Error('usePromoInput must be used within CheckoutProvider');
  return ctx;
}

export function CheckoutProvider({
  draft,
  initialQuantity = 1,
  children,
}: {
  draft: OrderDraft;
  initialQuantity?: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useCurrentUser();

  const [quantity, setQuantity] = useState(initialQuantity);
  // fulfillment awal mengikuti kapabilitas produk.
  // Berat NULL juga menutup delivery (ongkir pasti gagal), jadi buyer langsung
  // diarahkan ke pickup alih-alih melihat error kurir.
  const deliveryUsable =
    draft.isDelivery && draft.deliveryUnavailableReason !== 'weight_missing';
  // delivery-only -> 'delivery'; selain itu 'pickup' (invalid diblokir missingRequirement).
  const [fulfillment, setFulfillment] = useState<FulfillmentMode>(() =>
    deliveryUsable && !draft.isPickup ? 'delivery' : 'pickup'
  );
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [useCoins, setUseCoins] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState<StoredOrder | null>(null);
  const [pendingInvoiceReview, setPendingInvoiceReview] =
    useState<PendingInvoiceReview | null>(null);

  // shipping state (rates Biteship, display-only; total/pricing tidak berubah).
  const [shippingOptions, setShippingOptions] = useState<ShippingRateOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<{
    courierCode: string;
    serviceCode: string;
  } | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [shippingErrorCode, setShippingErrorCode] = useState<string | null>(null);
  const shippingSeqRef = useRef(0);

  const { balance: coinBalance } = useRebitesCoins();

  const submittedRef = useRef(false);
  const {
    addresses,
    selectedAddress,
    selectedAddressId,
    selectAddress,
    addAddress,
    updateAddress,
  } = useAddresses();

  // Tahap 3: signature field alamat yang memengaruhi tarif (postal + koordinat).
  // Dipakai di cache key DAN dependency effect ongkir di bawah, agar perubahan
  // isi alamat terpilih (id tetap sama) tidak memakai estimasi lama. String
  // stabil: konten tidak berubah -> effect tidak jalan ulang (anti loop).
  const selectedAddressRateSignature = useMemo(
    () => buildAddressRateSignature(selectedAddress),
    [selectedAddress]
  );

  // fetch rates Biteship via endpoint internal (server-authoritative).
  // Hanya untuk delivery + alamat terpilih; pickup/tanpa-alamat = reset kosong.
  // Tidak auto-select; pilihan lama selalu di-reset saat dependency berubah.
  useEffect(() => {
    const seq = shippingSeqRef.current + 1;
    shippingSeqRef.current = seq;

    // Reset dulu agar pilihan lama tidak terbawa.
    setSelectedShipping(null);
    setShippingOptions([]);
    setShippingError(null);
    setShippingErrorCode(null);

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (timer !== null) clearTimeout(timer);
      controller.abort();
    };

    if (fulfillment !== 'delivery' || !selectedAddressId || !draft.productSlug || !user) {
      setShippingLoading(false);
      return finish;
    }
    if (!draft.isDelivery) {
      setShippingLoading(false);
      return finish;
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      setShippingLoading(false);
      return finish;
    }

    const cacheKey = `shipping:${draft.productSlug}:${quantity}:${selectedAddressId}:${selectedAddressRateSignature}:${fulfillment}`;
    const cached = shippingRatesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setShippingOptions(cached.options);
      setShippingError(null);
      setShippingLoading(false);
      return finish;
    }

    setShippingLoading(true);

    timer = setTimeout(() => {
      (async () => {
        try {
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[checkout] shipping effect', { seq, fulfillment, selectedAddressId, productSlug: draft.productSlug, quantity, hasUser: Boolean(user), cacheKey });
          }

          let shared = shippingRatesInFlight.get(cacheKey);
          if (!shared) {
            shared = (async () => {
              const res = await fetchWithAuth(
                '/api/shipping/rates',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    productSlug: draft.productSlug,
                    quantity,
                    addressId: selectedAddressId,
                    fulfillment,
                  }),
                  signal: controller.signal,
                }
              );
              const json = (await res.json().catch(() => null)) as
                | { options?: ShippingRateOption[]; error?: string; code?: string }
                | null;
              if (!res.ok) {
                throw new ShippingRatesError(
                  (json?.error && String(json.error)) || 'Gagal menghitung ongkir. Coba lagi.',
                  json?.code ? String(json.code) : null
                );
              }
              const options = json && Array.isArray(json.options) ? json.options : [];
              shippingRatesCache.set(cacheKey, {
                options,
                expiresAt: Date.now() + SHIPPING_CACHE_TTL_MS,
              });
              return options;
            })();
            shippingRatesInFlight.set(cacheKey, shared);
            shared.finally(() => {
              shippingRatesInFlight.delete(cacheKey);
            }).catch(() => undefined);
          }

          const options = await shared;

          // Stale-response protection: abaikan bila sudah ada request lebih baru.
          if (shippingSeqRef.current !== seq || controller.signal.aborted) return;

          setShippingOptions(options);
          setShippingLoading(false);
        } catch (error) {
          if (shippingSeqRef.current !== seq || controller.signal.aborted) return;
          if (error instanceof DOMException && error.name === 'AbortError') return;
          if (error instanceof Error && error.name === 'AbortError') return;
          setShippingOptions([]);
          setShippingLoading(false);
          setShippingErrorCode(error instanceof ShippingRatesError ? error.code : null);
          setShippingError(
            error instanceof AuthError
              ? 'Sesi login habis. Silakan login ulang.'
              : error instanceof Error && error.message
                ? error.message
                : 'Gagal menghitung ongkir. Coba lagi.'
          );
        }
      })();
    }, 500);

    return finish;
  }, [fulfillment, quantity, selectedAddressId, selectedAddressRateSignature, draft.productSlug, user, draft.isDelivery]);

  const increment = useCallback(
    () =>
      setQuantity((q) =>
        Math.min(draft.stockRemaining, Math.max(1, q + 1))
      ),
    [draft.stockRemaining]
  );

  const decrement = useCallback(
    () => setQuantity((q) => Math.max(1, q - 1)),
    []
  );

  const selectMethod = useCallback((id: string) => setSelectedMethodId(id), []);

  const selectedMethod = useMemo(
    () => paymentMethods.find((m) => m.id === selectedMethodId) ?? null,
    [selectedMethodId]
  );

  const applyPromo = useCallback(() => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    validatePromoCode(code).then((match) => {
      if (match) {
        setPromo(match);
        setPromoError(null);
      } else {
        setPromo(null);
        setPromoError('Kode promo tidak valid');
      }
    });
  }, [promoInput]);

  const clearPromo = useCallback(() => {
    setPromo(null);
    setPromoInput('');
    setPromoError(null);
  }, []);

  // derive opsi yang cocok dengan pilihan user dari options terbaru.
  // Pilihan yang sudah tidak ada di options = stale → null (tanpa harga lama).
  const selectedShippingOption = useMemo<ShippingRateOption | null>(
    () =>
      selectedShipping
        ? (shippingOptions.find(
            (option) =>
              option.courierCode === selectedShipping.courierCode &&
              option.serviceCode === selectedShipping.serviceCode
          ) ?? null)
        : null,
    [shippingOptions, selectedShipping]
  );

  const summary = useOrderCalculation({
    draft,
    quantity,
    fulfillment,
    promo,
    useCoins,
    coinBalance,
    // DISPLAY memakai harga opsi terpilih; tanpa pilihan = 0
    // (tanpa fallback Rp8.000). Final order tetap revalidasi server.
    deliveryFeeOverride:
      fulfillment === 'delivery' ? (selectedShippingOption?.price ?? 0) : 0,
  });

  const toggleUseCoins = useCallback(
    (on: boolean) => setUseCoins(on && coinBalance > 0),
    [coinBalance],
  );

  const missingRequirement = useMemo<string | null>(() => {
    // fulfillment harus didukung kapabilitas produk (UI gating;
    // security boundary tetap di server checkout).
    if (!draft.isDelivery && !draft.isPickup) {
      return 'Produk ini sedang tidak tersedia untuk dipesan.';
    }
    if (fulfillment === 'delivery' && !draft.isDelivery) {
      return 'Produk ini tidak tersedia untuk diantar.';
    }
    // Berat belum diisi penjual: pilihan Diantar disembunyikan, tetapi state
    // bisa sudah 'delivery' dari cache/alamat lama — blokir dengan arahan.
    if (fulfillment === 'delivery' && draft.deliveryUnavailableReason === 'weight_missing') {
      return 'Produk ini belum bisa dikirim kurir karena beratnya belum diisi penjual. Pilih Ambil Sendiri.';
    }
    if (fulfillment === 'pickup' && !draft.isPickup) {
      return 'Produk ini tidak tersedia untuk diambil sendiri.';
    }
    // pickup tidak butuh alamat (behavior lama dipertahankan).
    // delivery wajib ada alamat terpilih dengan field minimum
    // (nama, telepon, alamat, kecamatan). postal/latlng opsional (NULL legacy).
    if (fulfillment === 'delivery') {
      if (!selectedAddress) return 'Pilih alamat pengiriman terlebih dahulu.';
      if (
        !selectedAddress.receiverName.trim() ||
        !selectedAddress.phone.trim() ||
        !selectedAddress.fullAddress.trim() ||
        !selectedAddress.district.trim()
      ) {
        return 'Alamat pengiriman belum lengkap. Perbarui nama, telepon, alamat, dan kecamatan.';
      }
      // delivery wajib memilih layanan pengiriman (identifier saja;
      // harga final tetap revalidasi server). Pickup tidak butuh pilihan.
      if (!selectedShipping) return 'Pilih layanan pengiriman terlebih dahulu.';
    }
    return null;
  }, [draft, fulfillment, selectedAddress, selectedShipping]);

  const canPay = missingRequirement === null && !submitting;

  const promoInputValue = useMemo<PromoInputContextValue>(
    () => ({
      promoInput,
      setPromoInput,
      promoError,
      applyPromo,
      clearPromo,
    }),
    [promoInput, promoError, applyPromo, clearPromo],
  );

  const submitOrder = useCallback(() => {
    if (submitting || submittedRef.current) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }
    // pickup tetap tanpa alamat; delivery wajib alamat minimum.
    // Fulfillment yang tidak didukung produk ditolak di sini (server menolak juga).
    if (!draft.isDelivery && !draft.isPickup) return;
    if (fulfillment === 'delivery' && !draft.isDelivery) return;
    if (fulfillment === 'pickup' && !draft.isPickup) return;
    if (fulfillment === 'delivery') {
      if (!selectedAddress) return;
      if (
        !selectedAddress.receiverName.trim() ||
        !selectedAddress.phone.trim() ||
        !selectedAddress.fullAddress.trim() ||
        !selectedAddress.district.trim()
      ) {
        return;
      }
      // cegah submit delivery tanpa pilihan kurir (server menolak juga).
      if (!selectedShipping) return;
    }

    submittedRef.current = true;
    setSubmitting(true);
    setPromoError(null);

    (async () => {
      try {
        let authHeader: string;
        try {
          authHeader = await getValidAuthHeader();
        } catch (err) {
          setSubmitting(false);
          submittedRef.current = false;
          setPromoError(
            err instanceof AuthError ? err.message : 'Sesi login habis. Silakan login ulang.'
          );
          router.push('/auth/login');
          return;
        }

        const payload: Record<string, unknown> = {
          productSlug: draft.productSlug,
          quantity,
          fulfillment,
          promoCode: promo?.code ?? null,
          useCoins,
          distanceKm: draft.distanceKm ?? null,
          // info package untuk observabilitas; SUMBER KEBENARAN
          // tetap database di server (server mengabaikan nilai ini bila beda).
          weightGram: draft.weightGram ?? null,
          lengthCm: draft.lengthCm ?? null,
          widthCm: draft.widthCm ?? null,
          heightCm: draft.heightCm ?? null,
          // identifier pilihan kurir saja (bukan harga/nama).
          // Harga final selalu hasil revalidasi Biteship di server.
          courierCode: selectedShipping?.courierCode ?? null,
          courierServiceCode: selectedShipping?.serviceCode ?? null,
        };
        if (fulfillment === 'delivery' && selectedAddress) {
          // snapshot diperluas (addressId + postal + lat/lng, NULL jika belum ada).
          // Order lama tanpa field baru tetap terbaca (backward compat).
          // TIDAK ada panggilan provider shipping / hitung ongkir / shipment di sini.
          payload.addressSnapshot = buildAddressSnapshot(selectedAddress);
        }

        // Tahap 2D-E: kunci idempotensi per niat checkout (UUID baru setiap
        // submit; server mengikatnya ke buyer dari JWT, bukan dari nilai ini).
        const idempotencyKey =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
        const res = await fetchWithAuth('/api/checkout/xendit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(payload),
        });

        const json = (await res.json().catch(() => null)) as
          | { error?: string; invoiceUrl?: string; orderCode?: string; free?: boolean; order?: StoredOrder | null; retryable?: boolean; invoiceState?: string; amount?: number }
          | null;

        // Tahap 2D-E: 409 retryable = hasil belum diketahui (paralel/unknown).
        // JANGAN submit ulang (kunci sama akan replay); arahkan ke halaman
        // sukses agar polling verify yang memantau status.
        if (res.status === 409 && json?.retryable && json.orderCode) {
          setSubmitting(false);
          submittedRef.current = false;
          window.location.href = `/detail/pesanan/sukses?orderId=${encodeURIComponent(json.orderCode)}`;
          return;
        }

        if (!res.ok) {
          const msg = json?.error ?? `Gagal membuat pembayaran (${res.status}).`;
          // Body respons TIDAK dicatat: dapat memuat objek pesanan (orderCode,
          // total, metadata). Status HTTP sudah cukup untuk diagnosis.
          console.error('[checkout] API error', { status: res.status });
          setSubmitting(false);
          submittedRef.current = false;
          setPromoError(msg);
          return;
        }

        if (json?.free && json.orderCode) {
          
          let order: StoredOrder | null | undefined = (json as { order?: StoredOrder }).order as StoredOrder | undefined;
          if (!order) {
            
            try {
              order = await getOrderById(json.orderCode);
            } catch (e) {
              console.warn('[checkout] getOrderById fallback gagal', e);
            }
          }
          if (order) {
            setSuccessOrder(order as StoredOrder);
          } else {
            console.warn('[checkout] free orderCode tanpa order payload', json.orderCode);
            
            setPromoError(null);
            
            window.location.href = `/detail/pesanan/sukses?orderId=${encodeURIComponent(json.orderCode)}`;
            return;
          }
          setSubmitting(false);
          submittedRef.current = false;
          return;
        }

        if (json?.invoiceUrl) {
          // Tahap 1: server selalu menghitung ulang dari DB. Bila total server
          // berbeda dari yang tampil (harga katalog / ongkir / koin berubah),
          // JANGAN redirect diam-diam — tampilkan perbedaannya dulu.
          const serverTotal =
            typeof json.amount === 'number' && Number.isFinite(json.amount)
              ? json.amount
              : null;
          if (serverTotal !== null && serverTotal !== summary.total) {
            setPendingInvoiceReview({
              invoiceUrl: json.invoiceUrl,
              serverTotal,
              displayTotal: summary.total,
            });
            // `submitting` sengaja tetap true: tombol bayar terkunci sampai
            // user memutuskan lewat dialog konfirmasi.
            return;
          }
          // `invoiceUrl` TIDAK dicatat: ia URL kapabilitas — siapa pun yang
          // memegangnya dapat melihat/membayar invoice. orderCode cukup.
          window.location.href = json.invoiceUrl;
          return;
        }

        console.error('[checkout] respons tanpa invoiceUrl');
        setSubmitting(false);
        submittedRef.current = false;
        setPromoError('Respons pembayaran tidak valid. Silakan coba lagi atau hubungi admin.');
      } catch (error) {
        console.error('[checkout] gagal memproses pesanan:', error);
        setSubmitting(false);
        submittedRef.current = false;
        setPromoError('Terjadi kesalahan saat memproses pesanan.');
      }
    })();
  }, [
    draft,
    fulfillment,
    promo,
    quantity,
    router,
    selectedAddress,
    selectedShipping,
    submitting,
    summary.total,
    useCoins,
    user,
  ]);

  const continueToInvoice = useCallback(() => {
    if (!pendingInvoiceReview) return;
    window.location.href = pendingInvoiceReview.invoiceUrl;
  }, [pendingInvoiceReview]);

  const value = useMemo<CheckoutContextValue>(
    () => ({
      draft,
      methods: paymentMethods,
      quantity,
      increment,
      decrement,
      canDecrement: quantity > 1,
      canIncrement: quantity < draft.stockRemaining,
      fulfillment,
      setFulfillment,
      addresses,
      selectedAddress,
      selectedAddressId,
      selectAddress,
      addAddress,
      updateAddress,
      selectedMethod,
      selectMethod,
      promo,
      coinBalance,
      useCoins,
      toggleUseCoins,
      summary,
      canPay,
      missingRequirement,
      submitting,
      submitOrder,
      successOrder,
      pendingInvoiceReview,
      continueToInvoice,
      shippingOptions,
      selectedShipping,
      setSelectedShipping,
      selectedShippingOption,
      shippingLoading,
      shippingError,
      shippingErrorCode,
    }),
    [
      draft,
      quantity,
      increment,
      decrement,
      fulfillment,
      addresses,
      selectedAddress,
      selectedAddressId,
      selectAddress,
      addAddress,
      updateAddress,
      selectedMethod,
      selectMethod,
      promo,
      coinBalance,
      useCoins,
      toggleUseCoins,
      summary,
      canPay,
      missingRequirement,
      submitting,
      submitOrder,
      successOrder,
      pendingInvoiceReview,
      continueToInvoice,
      shippingOptions,
      selectedShipping,
      selectedShippingOption,
      shippingLoading,
      shippingError,
      shippingErrorCode,
    ]
  );

  return (
    <CheckoutContext.Provider value={value}>
      <PromoInputContext.Provider value={promoInputValue}>
        {children}
      </PromoInputContext.Provider>
    </CheckoutContext.Provider>
  );
}
