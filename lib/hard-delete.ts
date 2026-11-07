export interface HardDeleteImpact {
    ordersAsBuyer: number;
    ordersInStore: number;
    activeOrders: number;
    products: number;
    reviews: number;
    coinTransactions: number;
    articles: number;
}
export type HardDeletePrecondition = {
    allowed: true;
} | {
    allowed: false;
    code: 'active-orders' | 'articles';
    message: string;
};
export function evaluateHardDeletePreconditions(impact: HardDeleteImpact): HardDeletePrecondition {
    if (impact.activeOrders > 0) {
        return {
            allowed: false,
            code: 'active-orders',
            message: `Masih ada ${impact.activeOrders} pesanan yang belum selesai di akun atau toko ini. Selesaikan atau batalkan dulu, baru hapus permanen.`,
        };
    }
    if (impact.articles > 0) {
        return {
            allowed: false,
            code: 'articles',
            message: `Akun ini adalah penulis ${impact.articles} artikel, dan artikel tidak boleh kehilangan penulisnya. Pindahkan atau hapus artikel itu dulu.`,
        };
    }
    return { allowed: true };
}
