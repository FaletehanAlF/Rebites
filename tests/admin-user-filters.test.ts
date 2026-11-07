import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ACCOUNT_STATUS_ACTIVE_CONDITION, ACCOUNT_STATUS_FILTER_LABELS, ADMIN_ACCOUNT_STATUS_FILTERS, ADMIN_ROLE_FILTERS, ROLE_FILTER_LABELS, accountStatusOrCondition, isAdminAccountStatusFilter, isAdminRoleFilter, } from '../lib/admin-user-filters.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8')
        .replace(/\r\n/g, '\n');
}
test('allowlist peran: hanya tiga peran yang sah', () => {
    for (const nilai of ['admin', 'umkm', 'buyer']) {
        assert.equal(isAdminRoleFilter(nilai), true, `${nilai} seharusnya sah`);
    }
    for (const nilai of ['', 'Admin', 'ADMIN', ' admin', 'admin ', 'penjual', 'user', 'all', '*']) {
        assert.equal(isAdminRoleFilter(nilai), false, `${JSON.stringify(nilai)} seharusnya ditolak`);
    }
});
test('allowlist status akun: hanya tiga status yang sah', () => {
    for (const nilai of ['active', 'suspended', 'banned']) {
        assert.equal(isAdminAccountStatusFilter(nilai), true, `${nilai} seharusnya sah`);
    }
    for (const nilai of ['', 'Active', 'deleted', 'inactive', 'aktif', 'null', '*']) {
        assert.equal(isAdminAccountStatusFilter(nilai), false, `${JSON.stringify(nilai)} seharusnya ditolak`);
    }
});
test('tanpa filter status, tidak ada kondisi yang dikirim', () => {
    assert.equal(accountStatusOrCondition(null), null);
});
test('"aktif" menyertakan baris lama tanpa account_status', () => {
    const kondisi = accountStatusOrCondition('active');
    assert.equal(kondisi, ACCOUNT_STATUS_ACTIVE_CONDITION);
    assert.match(kondisi!, /account_status\.is\.null/);
    assert.match(kondisi!, /account_status\.eq\.active/);
    assert.doesNotMatch(kondisi!, /neq/);
});
test('status blokir memakai perbandingan sederhana', () => {
    assert.equal(accountStatusOrCondition('suspended'), 'account_status.eq.suspended');
    assert.equal(accountStatusOrCondition('banned'), 'account_status.eq.banned');
});
test('label filter terisi untuk setiap nilai yang sah', () => {
    for (const nilai of ADMIN_ROLE_FILTERS) {
        assert.ok(ROLE_FILTER_LABELS[nilai]?.trim(), `label peran kosong: ${nilai}`);
    }
    for (const nilai of ADMIN_ACCOUNT_STATUS_FILTERS) {
        assert.ok(ACCOUNT_STATUS_FILTER_LABELS[nilai]?.trim(), `label status akun kosong: ${nilai}`);
    }
});
test('kondisi status tidak dirangkai dari input pengguna', () => {
    const sumber = readProjectFile('lib/admin-user-filters.ts');
    assert.match(sumber, /export function accountStatusOrCondition/);
    for (const status of ADMIN_ACCOUNT_STATUS_FILTERS) {
        const hasil = accountStatusOrCondition(status);
        assert.ok(hasil, `kondisi kosong untuk ${status}`);
        for (const karakter of ['(', ')', ',', '%']) {
            if (karakter === ',')
                continue;
            assert.equal(hasil!.split(karakter).length - 1, 0, `kondisi ${status} mengandung karakter struktur ${karakter}`);
        }
    }
});
test('kedua route memakai allowlist dan menolak nilai tak dikenal', () => {
    for (const berkas of [
        'app/api/admin/users/route.ts',
        'app/api/admin/users/export/route.ts',
    ]) {
        const route = readProjectFile(berkas);
        assert.match(route, /isAdminRoleFilter/, `${berkas} tidak memakai allowlist peran`);
        assert.match(route, /isAdminAccountStatusFilter/, `${berkas} tidak memakai allowlist status akun`);
        assert.match(route, /accountStatusOrCondition/, `${berkas} tidak memakai kondisi 'aktif'`);
        assert.match(route, /status: 400/, `${berkas} tidak menolak nilai tak dikenal`);
    }
});
test('daftar dan ekspor memakai arti "aktif" yang sama', () => {
    for (const berkas of [
        'app/api/admin/users/route.ts',
        'app/api/admin/users/export/route.ts',
    ]) {
        const route = readProjectFile(berkas);
        assert.doesNotMatch(route, /account_status\.is\.null/, `${berkas} menulis kondisi 'aktif' sendiri alih-alih memakai helper`);
    }
});
test('klien mengirim filter peran dan status akun ke server', () => {
    const klien = readProjectFile('lib/admin-users.ts');
    assert.match(klien, /params\.set\('role', query\.role\)/);
    assert.match(klien, /params\.set\('accountStatus', query\.accountStatus\)/);
    assert.match(klien, /avatar_url: string \| null/);
    const view = readProjectFile('app/components/admin/users-management-view.tsx');
    assert.match(view, /exportParams\.set\('role'/);
    assert.match(view, /exportParams\.set\('accountStatus'/);
});
