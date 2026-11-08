'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminMe, type AdminMe } from '@/lib/admin-me';
import { classifyAdminMeFailure, type AdminMeStatus, } from '@/lib/admin-me-status';
import { withTimeout } from '@/lib/async-timeout';
const ADMIN_ME_TIMEOUT_MS = 15000;
export interface UseAdminMeResult {
    loading: boolean;
    me: AdminMe | null;
    status: AdminMeStatus;
    errorMessage: string | null;
    retry: () => void;
}
export function useAdminMe(): UseAdminMeResult {
    const [state, setState] = useState<{
        me: AdminMe | null;
        status: AdminMeStatus;
        errorMessage: string | null;
    }>({ me: null, status: 'loading', errorMessage: null });
    const [attempt, setAttempt] = useState(0);
    const requestIdRef = useRef(0);
    const retry = useCallback(() => {
        setState((prev) => ({ ...prev, me: null, status: 'loading', errorMessage: null }));
        setAttempt((value) => value + 1);
    }, []);
    useEffect(() => {
        let active = true;
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        const isCurrent = () => active && requestId === requestIdRef.current;
        (async () => {
            try {
                const me = await withTimeout(fetchAdminMe(), ADMIN_ME_TIMEOUT_MS);
                if (!isCurrent())
                    return;
                setState({ me, status: 'verified', errorMessage: null });
            }
            catch (err) {
                if (!isCurrent())
                    return;
                const failure = classifyAdminMeFailure(err);
                setState({
                    me: null,
                    status: failure.status,
                    errorMessage: failure.message,
                });
            }
        })();
        return () => {
            active = false;
        };
    }, [attempt]);
    return {
        loading: state.status === 'loading',
        me: state.me,
        status: state.status,
        errorMessage: state.errorMessage,
        retry,
    };
}
