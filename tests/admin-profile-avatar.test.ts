import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AVATAR_HELP_TEXT, AVATAR_MAX_BYTES, avatarExtension, avatarFileError, avatarInitials, } from '../lib/admin-avatar.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8')
        .replace(/\r\n/g, '\n');
}
function berkas(overrides: Record<string, unknown> = {}) {
    return {
        name: 'foto.jpg',
        type: 'image/jpeg',
        size: 1024,
        ...overrides,
    };
}
test('format yang diterima: JPG, JPEG, PNG, WebP', () => {
    for (const type of ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']) {
        assert.equal(avatarFileError(berkas({ type })), null, `format ${type} seharusnya diterima`);
    }
});
test('format lain ditolak dengan pesan yang menyebut formatnya', () => {
    for (const type of ['application/pdf', 'image/gif', 'image/avif', 'text/plain', '']) {
        const pesan = avatarFileError(berkas({ type }));
        assert.ok(pesan, `format ${type || '(kosong)'} seharusnya ditolak`);
        assert.match(pesan, /Format file harus/, `pesan tidak menjelaskan format: ${pesan}`);
    }
});
test('batas ukuran: tepat 2 MB diterima, satu byte lebih ditolak', () => {
    assert.equal(avatarFileError(berkas({ size: AVATAR_MAX_BYTES })), null);
    const pesan = avatarFileError(berkas({ size: AVATAR_MAX_BYTES + 1 }));
    assert.ok(pesan);
    assert.match(pesan, /maksimal 2MB/i);
});
test('berkas kosong ditolak, bukan diterima sebagai gambar rusak', () => {
    const pesan = avatarFileError(berkas({ size: 0 }));
    assert.ok(pesan);
    assert.match(pesan, /kosong/i);
});
test('berkas tidak ada ditolak, ukuran tak terbaca juga', () => {
    assert.ok(avatarFileError(null));
    assert.ok(avatarFileError(undefined));
    assert.ok(avatarFileError({ type: 'image/png', size: 'besar' }));
});
test('urutan pemeriksaan: format dilaporkan sebelum ukuran', () => {
    const pesan = avatarFileError({ name: 'dokumen.pdf', type: 'application/pdf', size: 5000000 });
    assert.ok(pesan);
    assert.match(pesan, /Format file harus/);
});
test('ekstensi penyimpanan: nama berkas menang, jpeg disatukan ke jpg', () => {
    assert.equal(avatarExtension(berkas({ name: 'foto.PNG', type: 'image/jpeg' })), 'png');
    assert.equal(avatarExtension(berkas({ name: 'foto.jpeg' })), 'jpg');
    assert.equal(avatarExtension(berkas({ name: 'foto.webp' })), 'webp');
    assert.equal(avatarExtension({ name: 'foto', type: 'image/webp', size: 10 }), 'webp');
    assert.equal(avatarExtension({ name: '', type: 'image/png', size: 10 }), 'png');
    assert.equal(avatarExtension({ name: '', type: '', size: 10 }), 'jpg');
});
test('inisial: satu kata, dua kata, dan nama yang lebih panjang', () => {
    assert.equal(avatarInitials('Falen'), 'F');
    assert.equal(avatarInitials('Abdurrahman Kayysan'), 'AK');
    assert.equal(avatarInitials('Jona Alfaros Pratama'), 'JA');
    assert.equal(avatarInitials('  fahri  '), 'F');
});
test('inisial: nama kosong jatuh ke email, email kosong jatuh ke A', () => {
    assert.equal(avatarInitials('', 'falen@contoh.com'), 'F');
    assert.equal(avatarInitials(null, 'kayy@contoh.com'), 'K');
    assert.equal(avatarInitials('   ', '  jona@contoh.com'), 'J');
    assert.equal(avatarInitials('', ''), 'A');
    assert.equal(avatarInitials(null, null), 'A');
    assert.equal(avatarInitials(undefined, undefined), 'A');
    for (const nilai of ['', ' ', '-', null, undefined]) {
        assert.ok(avatarInitials(nilai, nilai).length > 0, `inisial kosong untuk ${String(nilai)}`);
    }
});
test('teks bantuan menyebut angka yang benar-benar ditegakkan', () => {
    assert.match(AVATAR_HELP_TEXT, /2 MB/);
    assert.match(AVATAR_HELP_TEXT, /WebP/);
    assert.equal(AVATAR_MAX_BYTES, 2 * 1024 * 1024);
});
test('route foto memakai modul bersama, bukan batas yang ditulis ulang', () => {
    const route = readProjectFile('app/api/profile/avatar/route.ts');
    assert.match(route, /from '@\/lib\/admin-avatar'/);
    assert.match(route, /avatarFileError\(file\)/);
    assert.match(route, /avatarExtension\(file\)/);
    assert.doesNotMatch(route, /2 \* 1024 \* 1024/);
    assert.doesNotMatch(route, /'image\/jpeg'/);
});
test('route foto punya POST dan DELETE, keduanya menolak tanpa sesi', () => {
    const route = readProjectFile('app/api/profile/avatar/route.ts');
    assert.match(route, /export async function POST\(/);
    assert.match(route, /export async function DELETE\(/);
    const handlers = route.split(/export async function /).slice(1);
    assert.equal(handlers.length, 2, 'route harus punya tepat dua handler');
    for (const handler of handlers) {
        const namaHandler = handler.slice(0, handler.indexOf('('));
        const posisiAuth = handler.indexOf('getUserFromBearer');
        const posisiStorage = handler.indexOf(".storage");
        assert.ok(posisiAuth > -1, `${namaHandler}: tidak memeriksa pemanggil`);
        assert.ok(posisiStorage === -1 || posisiAuth < posisiStorage, `${namaHandler}: penyimpanan disentuh sebelum pemanggil diverifikasi`);
        assert.match(handler, /status: 401/, `${namaHandler}: tidak ada balasan 401`);
    }
});
test('klien memakai aturan yang sama dengan server', () => {
    const hook = readProjectFile('hooks/use-profile.ts');
    assert.match(hook, /from '@\/lib\/admin-avatar'/);
    assert.match(hook, /avatarFileError\(file\)/);
    assert.doesNotMatch(hook, /2 \* 1024 \* 1024/);
});
test('halaman profil admin memakai jalur server, bukan penyimpanan perangkat', () => {
    const view = readProjectFile('app/components/admin/admin-profile-view.tsx');
    assert.match(view, /uploadAvatar/);
    assert.match(view, /removeAvatar/);
    assert.doesNotMatch(view, /localStorage/);
    assert.doesNotMatch(view, /readAsDataURL/);
});
test('topbar admin menampilkan foto dari profil, dengan inisial sebagai cadangan', () => {
    const topbar = readProjectFile('app/components/admin/admin-topbar.tsx');
    assert.match(topbar, /AdminAvatar/);
    assert.match(topbar, /useProfile/);
    assert.match(topbar, /user\?\.fullName/);
    assert.match(topbar, /user\?\.email/);
});
