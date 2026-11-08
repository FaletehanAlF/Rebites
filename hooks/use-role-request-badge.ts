'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminRoleRequests } from '@/lib/role-requests';
import { ADMIN_ROLE_DECISIONS_EVENT, readSeenRoleDecisionIds, } from '@/lib/admin-preferences';
const POLL_INTERVAL_MS = 20000;
const DECISION_SCAN_LIMIT = 20;
export type RoleBadgeKind = 'pending' | 'decision';
export interface RoleRequestBadge {
    count: number | null;
    kind: RoleBadgeKind | null;
    refresh: () => void;
}
export function useRoleRequestBadge(enabled: boolean, isSuperAdmin: boolean): RoleRequestBadge {
    const [state, setState] = useState<{
        count: number | null;
        kind: RoleBadgeKind | null;
    }>({ count: null, kind: null });
    const requestIdRef = useRef(0);
    const load = useCallback(async () => {
        if (!enabled)
            return;
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        try {
            if (isSuperAdmin) {
                const result = await fetchAdminRoleRequests({
                    status: 'pending',
                    limit: 1,
                    offset: 0,
                });
                if (requestId !== requestIdRef.current)
                    return;
                if (result.notProvisioned) {
                    setState({ count: null, kind: null });
                    return;
                }
                setState({ count: result.total, kind: 'pending' });
                return;
            }
            const result = await fetchAdminRoleRequests({
                mine: true,
                limit: DECISION_SCAN_LIMIT,
                offset: 0,
            });
            if (requestId !== requestIdRef.current)
                return;
            if (result.notProvisioned) {
                setState({ count: null, kind: null });
                return;
            }
            const seen = readSeenRoleDecisionIds();
            const unseen = result.requests.filter((item) => item.requested_by_me === true &&
                typeof item.id === 'string' &&
                (item.status === 'approved' || item.status === 'rejected') &&
                !seen.has(item.id)).length;
            setState({ count: unseen, kind: 'decision' });
        }
        catch {
            if (requestId !== requestIdRef.current)
                return;
            setState({ count: null, kind: null });
        }
    }, [enabled, isSuperAdmin]);
    useEffect(() => {
        if (!enabled) {
            setState({ count: null, kind: null });
            return;
        }
        void load();
        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible')
                void load();
        }, POLL_INTERVAL_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible')
                void load();
        };
        const onSeen = () => void load();
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener(ADMIN_ROLE_DECISIONS_EVENT, onSeen);
        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener(ADMIN_ROLE_DECISIONS_EVENT, onSeen);
        };
    }, [enabled, load]);
    return { ...state, refresh: () => void load() };
}
