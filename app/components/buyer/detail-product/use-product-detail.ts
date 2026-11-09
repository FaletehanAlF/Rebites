'use client';
import { useEffect, useState } from 'react';
import type { ProductDetail } from './data';
import { fetchProductDetail } from './detail-data';
export function useProductDetail(selectedProductId: string | null): ProductDetail | null {
    const [product, setProduct] = useState<ProductDetail | null>(null);
    useEffect(() => {
        if (!selectedProductId) {
            setProduct(null);
            return;
        }
        let active = true;
        setProduct(null);
        fetchProductDetail(selectedProductId)
            .then((detail) => {
            if (active)
                setProduct(detail ?? null);
        })
            .catch((error) => {
            console.error('[detail] gagal memuat produk:', error);
            if (active)
                setProduct(null);
        });
        return () => {
            active = false;
        };
    }, [selectedProductId]);
    return product;
}
