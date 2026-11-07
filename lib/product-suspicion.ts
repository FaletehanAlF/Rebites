export interface SuspicionInput {
    id: string | null;
    name: string;
    description: string | null;
    image_url: string | null;
    category: string | null;
    original_price: number | null;
    surplus_price: number | null;
    stock: number | null;
    verification_status: string | null;
    created_at: string | null;
    updated_at: string | null;
}
export interface SuspicionContext {
    siblingProducts?: Pick<SuspicionInput, 'id' | 'name'>[];
    reportCount?: number | null;
    recentChangeCount?: number | null;
}
export interface SuspicionFlag {
    code: 'duplicate_name' | 'incomplete_info' | 'missing_photo' | 'price_anomaly' | 'user_reports' | 'frequent_changes';
    label: string;
    detail: string;
}
const PLACEHOLDER_IMAGE_PREFIXES = ['/foods/ikansayur', '/placeholder', 'placehold.co'];
export function flagSuspiciousProduct(product: SuspicionInput, ctx?: SuspicionContext): SuspicionFlag[] {
    const flags: SuspicionFlag[] = [];
    const name = (product.name ?? '').trim();
    const desc = (product.description ?? '').trim();
    const img = (product.image_url ?? '').trim();
    const siblings = ctx?.siblingProducts ?? [];
    const dupes = siblings.filter((s) => s.id !== product.id && s.name.trim().toLowerCase() === name.toLowerCase() && name !== '');
    if (dupes.length > 0) {
        flags.push({
            code: 'duplicate_name',
            label: 'Kemungkinan duplikat',
            detail: `Ditemukan ${dupes.length} produk lain dengan nama persis "${name}" di toko ini. Periksa apakah duplikat tidak sengaja.`,
        });
    }
    if (!desc || desc.length < 20 || !product.category) {
        const parts: string[] = [];
        if (!desc)
            parts.push('deskripsi kosong');
        else if (desc.length < 20)
            parts.push(`deskripsi sangat pendek (${desc.length} karakter)`);
        if (!product.category)
            parts.push('kategori belum diisi');
        flags.push({
            code: 'incomplete_info',
            label: 'Info produk tidak lengkap',
            detail: `Perlu dilengkapi: ${parts.join(', ')}.`,
        });
    }
    if (!img || PLACEHOLDER_IMAGE_PREFIXES.some((p) => img.includes(p))) {
        flags.push({
            code: 'missing_photo',
            label: 'Foto perlu diperiksa',
            detail: !img
                ? 'Produk belum memiliki foto.'
                : 'Produk memakai foto placeholder bawaan; minta UMKM mengunggah foto asli.',
        });
    }
    const orig = product.original_price;
    const sur = product.surplus_price;
    const stock = product.stock;
    if (orig != null && sur != null && sur > orig) {
        flags.push({
            code: 'price_anomaly',
            label: 'Harga tidak wajar',
            detail: `Harga surplus (${sur}) lebih tinggi dari harga normal (${orig}).`,
        });
    }
    else if ((sur === 0 || orig === 0) && (stock ?? 0) > 0) {
        flags.push({
            code: 'price_anomaly',
            label: 'Harga tidak wajar',
            detail: 'Harga Rp0 dengan stok tersedia; pastikan bukan salah input.',
        });
    }
    else if ((orig ?? 0) > 10000000 || (sur ?? 0) > 10000000) {
        flags.push({
            code: 'price_anomaly',
            label: 'Harga tidak wajar',
            detail: 'Harga di atas Rp10.000.000 — tidak wajar untuk porsi surplus; verifikasi ke UMKM.',
        });
    }
    if (typeof ctx?.reportCount === 'number' && ctx.reportCount > 0) {
        flags.push({
            code: 'user_reports',
            label: 'Ada laporan pengguna',
            detail: `Ditemukan ${ctx.reportCount} laporan terkait. Tinjau laporan sebelum menindak.`,
        });
    }
    if (typeof ctx?.recentChangeCount === 'number' && ctx.recentChangeCount >= 5) {
        flags.push({
            code: 'frequent_changes',
            label: 'Sering diubah',
            detail: `${ctx.recentChangeCount} perubahan dalam 24 jam terakhir; periksa pola manipulasi harga/stok.`,
        });
    }
    return flags;
}
