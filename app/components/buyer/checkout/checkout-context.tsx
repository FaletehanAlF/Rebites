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
import { supabase } from '@/lib/supabase';
import { getOrderById } from '@/lib/order-storage';
import { paymentMethods } from './payment-methods';

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
}

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

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
  const [fulfillment, setFulfillment] = useState<FulfillmentMode>('pickup');
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [useCoins, setUseCoins] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState<StoredOrder | null>(null);

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

  const summary = useOrderCalculation({
    draft,
    quantity,
    fulfillment,
    promo,
    useCoins,
    coinBalance,
  });

  const toggleUseCoins = useCallback(
    (on: boolean) => setUseCoins(on && coinBalance > 0),
    [coinBalance],
  );

  const missingRequirement = useMemo<string | null>(() => {
    if (fulfillment === 'delivery' && !selectedAddress)
      return 'Pilih alamat pengiriman terlebih dahulu.';
    return null;
  }, [fulfillment, selectedAddress]);

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
    if (fulfillment === 'delivery' && !selectedAddress) return;

    submittedRef.current = true;
    setSubmitting(true);
    setPromoError(null);

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setSubmitting(false);
          submittedRef.current = false;
          setPromoError('Sesi login habis. Silakan login ulang.');
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
        };
        if (fulfillment === 'delivery' && selectedAddress) {
          payload.addressSnapshot = {
            label: selectedAddress.label,
            receiverName: selectedAddress.receiverName,
            phone: selectedAddress.phone,
            province: selectedAddress.province,
            city: selectedAddress.city,
            district: selectedAddress.district,
            fullAddress: selectedAddress.fullAddress,
            note: selectedAddress.note,
          };
        }

        const res = await fetch('/api/checkout/xendit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const json = (await res.json().catch(() => null)) as
          | { error?: string; invoiceUrl?: string; orderCode?: string; free?: boolean; order?: StoredOrder | null }
          | null;

        if (!res.ok) {
          const msg = json?.error ?? `Gagal membuat pembayaran (${res.status}).`;
          console.error('[checkout] API error', { status: res.status, body: json });
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
          window.location.href = json.invoiceUrl;
          return;
        }

        console.error('[checkout] respons tanpa invoiceUrl', json);
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
    submitting,
    useCoins,
    user,
  ]);

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
