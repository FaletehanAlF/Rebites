import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ADMIN_CAPABILITIES, adminCapabilities, superAdminCapabilities, } from '../lib/admin-capabilities.ts';
import { canChangeUserRole, canCreateRoleRequest, canDecideRoleRequest, canIssueSanction, canManageAccountDeletion, canManageProductDeletion, canManageStore, canManageStoreDeletion, type AdminActor, type AdminDecision, type AdminStoreTarget, type AdminTarget, } from '../lib/admin-access.ts';
const ADMIN_TIM: AdminActor = { id: 'admin-tim', role: 'admin', isSuperAdmin: false };
const SUPER_ADMIN: AdminActor = { id: 'admin-utama', role: 'admin', isSuperAdmin: true };
const PEMBELI: AdminTarget = { id: 'pembeli-1', role: 'buyer', isSuperAdmin: false };
const PEMAIN_ADMIN: AdminTarget = { id: 'admin-lain', role: 'admin', isSuperAdmin: false };
const TOKO_MILIK_ORANG: AdminStoreTarget = {
    id: 'umkm-1',
    ownerId: 'pemilik-1',
    ownerIsSuperAdmin: false,
};
const PEMANGGIL: Record<string, (aktor: AdminActor) => AdminDecision | boolean> = {
    canIssueSanction: (aktor) => canIssueSanction(aktor, PEMBELI),
    canCreateRoleRequest: (aktor) => canCreateRoleRequest(aktor, PEMBELI, 'umkm'),
    canManageStore: (aktor) => canManageStore(aktor.id, aktor.id),
    canChangeUserRole: (aktor) => canChangeUserRole(aktor, PEMBELI, 'umkm'),
    canDecideRoleRequest: (aktor) => canDecideRoleRequest(aktor, {
        requestedBy: 'admin-pengaju',
        status: 'pending',
        targetIsSuperAdmin: false,
    }),
    canManageAccountDeletion: (aktor) => canManageAccountDeletion(aktor, PEMBELI),
    canManageStoreDeletion: (aktor) => canManageStoreDeletion(aktor, TOKO_MILIK_ORANG),
    canManageProductDeletion: (aktor) => canManageProductDeletion(aktor),
};
function diizinkan(hasil: AdminDecision | boolean): boolean {
    return typeof hasil === 'boolean' ? hasil : hasil.allowed;
}
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8')
        .replace(/\r\n/g, '\n');
}
test('setiap entri menunjuk penjaga yang benar-benar ada di lib/admin-access.ts', () => {
    const access = readProjectFile('lib/admin-access.ts');
    for (const item of ADMIN_CAPABILITIES) {
        assert.ok(PEMANGGIL[item.guard], `entri "${item.action}" memakai penjaga "${item.guard}" yang tidak dikenal tes`);
        assert.match(access, new RegExp(`export function ${item.guard}\\(`), `penjaga "${item.guard}" tidak diekspor lib/admin-access.ts`);
    }
});
test('entri super-admin memang ditolak untuk admin tim', () => {
    const entri = superAdminCapabilities();
    assert.ok(entri.length > 0, 'harus ada entri khusus Super Admin');
    for (const item of entri) {
        const hasil = PEMANGGIL[item.guard](ADMIN_TIM);
        assert.equal(diizinkan(hasil), false, `"${item.label}" ditulis khusus Super Admin tetapi admin tim diizinkan menjalankannya`);
        if (typeof hasil !== 'boolean' && hasil.allowed === false) {
            assert.ok(['super-admin-required', 'super-admin-protected', 'admin-protected'].includes(hasil.code), `"${item.label}" ditolak dengan kode tak terduga: ${hasil.code}`);
        }
    }
});
test('entri super-admin diizinkan untuk Super Admin', () => {
    for (const item of superAdminCapabilities()) {
        assert.equal(diizinkan(PEMANGGIL[item.guard](SUPER_ADMIN)), true, `"${item.label}" tidak dapat dilakukan Super Admin — teks di layar salah`);
    }
});
test('entri yang berlaku untuk semua admin memang diizinkan admin tim', () => {
    const entri = adminCapabilities();
    assert.ok(entri.length > 0, 'harus ada entri untuk semua admin');
    for (const item of entri) {
        assert.equal(diizinkan(PEMANGGIL[item.guard](ADMIN_TIM)), true, `"${item.label}" ditulis untuk semua admin tetapi admin tim ditolak`);
    }
});
test('sanksi admin tim diblokir untuk akun admin lain, tapi tidak untuk pembeli', () => {
    assert.equal(canIssueSanction(ADMIN_TIM, PEMAIN_ADMIN).allowed, false);
    assert.equal(canIssueSanction(ADMIN_TIM, PEMBELI).allowed, true);
    assert.equal(canIssueSanction(SUPER_ADMIN, PEMAIN_ADMIN).allowed, true);
});
test('daftar kewenangan tidak punya kode ganda dan setiap teks terisi', () => {
    const kode = ADMIN_CAPABILITIES.map((item) => item.action);
    assert.equal(new Set(kode).size, kode.length, 'ada action yang dipakai dua kali');
    for (const item of ADMIN_CAPABILITIES) {
        assert.ok(item.label.trim().length > 0, `label kosong pada "${item.action}"`);
        assert.ok(item.description.trim().length > 0, `deskripsi kosong pada "${item.action}"`);
    }
});
