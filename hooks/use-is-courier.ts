'use client';
import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/auth-token';
export function useIsCourier(enabled = true) {
    const [isCourier, setIsCourier] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!enabled)
            return;
        let cancelled = false;
        setLoading(true);
        void (async () => {
            try {
                const res = await fetchWithAuth('/api/courier/profile');
                if (cancelled)
                    return;
                if (!res.ok) {
                    setIsCourier(false);
                    setError('Gagal memeriksa status kurir.');
                    return;
                }
                const json = (await res.json()) as {
                    courier?: unknown | null;
                };
                setIsCourier(Boolean(json.courier));
                setError(null);
            }
            catch {
                if (cancelled)
                    return;
                setIsCourier(false);
                setError('Gagal memeriksa status kurir.');
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [enabled]);
    return { isCourier, loading, error };
}
