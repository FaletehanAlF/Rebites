'use client';
import { useEffect, useState } from 'react';
import { SUBSCRIPTION_UPDATED_EVENT, getActiveSubscription, type StoredSubscription, } from './subscription-storage';
export type SellerTier = 'basic' | 'standar' | 'max';
export interface SellerEntitlements {
    tier: SellerTier;
    label: string;
    maxProducts: number | null;
    historyDays: number | null;
    maxFlashSaleProducts: number | null;
    detailedReport: boolean;
    verifiedBadge: boolean;
    priorityListing: boolean;
    featuredPromo: boolean;
    demandAnalytics: boolean;
    categoryPerformance: boolean;
    bestSellingMenus: boolean;
    prioritySupport: boolean;
    upgradeSlug: 'standar' | 'premium' | null;
}
const ENTITLEMENTS: Record<SellerTier, SellerEntitlements> = {
    basic: {
        tier: 'basic',
        label: 'ReBites Basic',
        maxProducts: 3,
        historyDays: 30,
        maxFlashSaleProducts: 0,
        detailedReport: false,
        verifiedBadge: false,
        priorityListing: false,
        featuredPromo: false,
        demandAnalytics: false,
        categoryPerformance: false,
        bestSellingMenus: false,
        prioritySupport: false,
        upgradeSlug: 'standar',
    },
    standar: {
        tier: 'standar',
        label: 'ReBites Standar',
        maxProducts: 5,
        historyDays: null,
        maxFlashSaleProducts: 1,
        detailedReport: true,
        verifiedBadge: true,
        priorityListing: true,
        featuredPromo: false,
        demandAnalytics: false,
        categoryPerformance: true,
        bestSellingMenus: true,
        prioritySupport: false,
        upgradeSlug: 'premium',
    },
    max: {
        tier: 'max',
        label: 'ReBites Max',
        maxProducts: 15,
        historyDays: null,
        maxFlashSaleProducts: null,
        detailedReport: true,
        verifiedBadge: true,
        priorityListing: true,
        featuredPromo: true,
        demandAnalytics: true,
        categoryPerformance: true,
        bestSellingMenus: true,
        prioritySupport: true,
        upgradeSlug: null,
    },
};
export function getSellerEntitlements(subscription: StoredSubscription | null): SellerEntitlements {
    if (!subscription)
        return ENTITLEMENTS.basic;
    if (subscription.planSlug === 'standar')
        return ENTITLEMENTS.standar;
    if (subscription.planSlug === 'premium')
        return ENTITLEMENTS.max;
    return ENTITLEMENTS.basic;
}
export async function readSellerPlan(): Promise<SellerEntitlements> {
    const subscription = await getActiveSubscription();
    return getSellerEntitlements(subscription);
}
const SELLER_PLAN_CACHE_TTL_MS = 30000;
let planCache: Promise<SellerEntitlements> | null = null;
let planCacheTimestamp = 0;
function invalidatePlanCache() {
    planCache = null;
    planCacheTimestamp = 0;
}
if (typeof window !== 'undefined') {
    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, invalidatePlanCache);
}
function readSellerPlanCached(): Promise<SellerEntitlements> {
    if (planCache && Date.now() - planCacheTimestamp < SELLER_PLAN_CACHE_TTL_MS) {
        return planCache;
    }
    const run = readSellerPlan();
    planCache = run;
    planCacheTimestamp = Date.now();
    run.catch(() => {
        if (planCache === run)
            planCache = null;
    });
    return run;
}
export function useSellerPlan() {
    const [plan, setPlan] = useState<SellerEntitlements>(ENTITLEMENTS.basic);
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => {
        let mounted = true;
        const refresh = () => {
            readSellerPlanCached().then((result) => {
                if (!mounted)
                    return;
                setPlan(result);
                setHydrated(true);
            });
        };
        refresh();
        window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, refresh);
        return () => {
            mounted = false;
            window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, refresh);
        };
    }, []);
    return { plan, hydrated };
}
