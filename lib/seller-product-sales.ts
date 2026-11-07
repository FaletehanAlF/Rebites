'use client';
import { getSellerOrders } from './order-storage';
import { getSellerProducts, SELLER_VENDOR_SLUG } from './product-storage';
export interface BestSellingMenu {
    sellerId: string;
    menuId: string;
    name: string;
    image: string;
    surplusPrice: number;
    terjual: number;
}
export async function getSellerBestSellingMenus(): Promise<BestSellingMenu[]> {
    const products = await getSellerProducts();
    const orders = await getSellerOrders();
    if (orders.length === 0)
        return [];
    const soldByMenuId = new Map<string, number>();
    for (const order of orders) {
        soldByMenuId.set(order.productId, (soldByMenuId.get(order.productId) ?? 0) + order.quantity);
    }
    return products
        .map((product) => ({
        sellerId: SELLER_VENDOR_SLUG,
        menuId: product.id,
        name: product.name,
        image: product.image,
        surplusPrice: product.surplusPrice,
        terjual: soldByMenuId.get(product.id) ?? 0,
    }))
        .filter((menu) => menu.terjual > 0)
        .sort((a, b) => b.terjual - a.terjual || a.name.localeCompare(b.name));
}
