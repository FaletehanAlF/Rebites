'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { STORE_ACTIVATION_UPDATED_EVENT, getStoreActivationState, submitStoreActivationRequest, type StoreActivationState, } from '@/lib/store-activation';
export function useStoreActivation() {
    const [state, setState] = useState<StoreActivationState | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const requestIdRef = useRef(0);
    const refresh = useCallback(async () => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        const next = await getStoreActivationState();
        if (requestId !== requestIdRef.current)
            return;
        setState(next);
        setLoading(false);
    }, []);
    useEffect(() => {
        void refresh();
        const onUpdated = () => void refresh();
        const onVisible = () => {
            if (document.visibilityState === 'visible')
                void refresh();
        };
        window.addEventListener(STORE_ACTIVATION_UPDATED_EVENT, onUpdated);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.removeEventListener(STORE_ACTIVATION_UPDATED_EVENT, onUpdated);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [refresh]);
    const submit = useCallback(async (message: string): Promise<{
        ok: true;
    } | {
        ok: false;
        message: string;
    }> => {
        if (!state)
            return { ok: false, message: 'Data toko belum tersedia.' };
        setSubmitting(true);
        try {
            const result = await submitStoreActivationRequest(state.umkmId, message);
            if (result.ok)
                await refresh();
            return result;
        }
        finally {
            setSubmitting(false);
        }
    }, [state, refresh]);
    return { state, loading, submitting, submit, refresh };
}
