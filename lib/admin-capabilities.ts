export type AdminCapabilityRequirement = 'admin' | 'super-admin';
export interface AdminCapability {
    action: string;
    label: string;
    description: string;
    requires: AdminCapabilityRequirement;
    guard: string;
}
export const ADMIN_CAPABILITIES: readonly AdminCapability[] = [
    {
        action: 'issue_sanction',
        label: 'Menangguhkan atau memblokir akun',
        description: 'Berlaku untuk pembeli dan UMKM. Akun admin lain hanya dapat disasar oleh Super Admin.',
        requires: 'admin',
        guard: 'canIssueSanction',
    },
    {
        action: 'request_role_change',
        label: 'Mengajukan perubahan peran pengguna',
        description: 'Admin tim tidak mengubah peran langsung; usulannya masuk ke halaman Permintaan Role untuk diputuskan Super Admin.',
        requires: 'admin',
        guard: 'canCreateRoleRequest',
    },
    {
        action: 'manage_own_store',
        label: 'Mengelola toko milik sendiri',
        description: 'Menu Toko Saya hanya muncul bila akun admin ini memang pemilik toko, bukan karena perannya admin.',
        requires: 'admin',
        guard: 'canManageStore',
    },
    {
        action: 'change_user_role',
        label: 'Mengubah peran pengguna secara langsung',
        description: 'Termasuk menunjuk dan mencabut admin tim. Akun Super Admin sendiri tidak dapat dicabut hak adminnya.',
        requires: 'super-admin',
        guard: 'canChangeUserRole',
    },
    {
        action: 'decide_role_request',
        label: 'Memutuskan permintaan perubahan peran',
        description: 'Permintaan yang diajukan sendiri tidak dapat diputuskan sendiri, dan akun Super Admin tidak dapat menjadi sasarannya.',
        requires: 'super-admin',
        guard: 'canDecideRoleRequest',
    },
    {
        action: 'manage_account_deletion',
        label: 'Menghapus dan memulihkan akun',
        description: 'Akun sendiri tidak dapat dihapus dari panel, dan akun Super Admin dilindungi dari penghapusan.',
        requires: 'super-admin',
        guard: 'canManageAccountDeletion',
    },
    {
        action: 'manage_store_deletion',
        label: 'Menghapus dan memulihkan toko',
        description: 'Toko milik akun Super Admin dilindungi dan tidak dapat dihapus dari panel.',
        requires: 'super-admin',
        guard: 'canManageStoreDeletion',
    },
    {
        action: 'manage_product_deletion',
        label: 'Menarik dan memulihkan produk',
        description: 'Menarik produk orang lain dari peredaran paling berdampak ke penjual, jadi hanya Super Admin yang melakukannya. Produk yang salah ditarik selalu dapat dipulihkan.',
        requires: 'super-admin',
        guard: 'canManageProductDeletion',
    },
];
export function adminCapabilities(): AdminCapability[] {
    return ADMIN_CAPABILITIES.filter((item) => item.requires === 'admin');
}
export function superAdminCapabilities(): AdminCapability[] {
    return ADMIN_CAPABILITIES.filter((item) => item.requires === 'super-admin');
}
