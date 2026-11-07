'use client';
import dynamic from 'next/dynamic';
export const ProductDetailModal = dynamic(() => import('./ProductDetailModal').then((m) => m.ProductDetailModal), { ssr: false });
