'use client';
import { useParams } from 'next/navigation';
export function useStoreRouteId(): string {
    const params = useParams<{
        storeId?: string;
    }>();
    return typeof params?.storeId === 'string' ? params.storeId : '';
}
