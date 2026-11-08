import { sellerStorePath } from './seller-store-path.ts';
export type SuccessStatus = 'loading' | 'pending' | 'active' | 'failed';
export interface SuccessStatusInput {
    externalId: string | null | undefined;
}
export function resolveSuccessStatus({ externalId }: SuccessStatusInput): SuccessStatus {
    return externalId ? 'pending' : 'active';
}
export interface PostPaymentHrefInput {
    hasStore: boolean | null | undefined;
    storeId?: string | null;
}
export function resolvePostPaymentHref({ hasStore, storeId, }: PostPaymentHrefInput): string {
    if (!hasStore)
        return '/home';
    return sellerStorePath(storeId);
}
