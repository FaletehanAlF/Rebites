import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readProjectFile(relative: string): string {
    return readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
}

const FORM = readProjectFile('app/components/auth/penjual-register-form.tsx');
const ROLE_ROUTE = readProjectFile('app/api/auth/seller-role/route.ts');

test('penjual bisa mendaftar tanpa sesi: form punya jalur signUp sendiri', () => {
    assert.match(FORM, /supabase\.auth\.signUp\(/);
    assert.match(FORM, /handleStep1Submit/);
    assert.match(FORM, /setHasSession\(false\)/);
});

test('data akun bisa diisi saat belum ada sesi, dan terkunci saat sudah ada', () => {
    assert.match(FORM, /readOnly=\{hasSession\}/);
    assert.doesNotMatch(FORM, /readOnly className/);
});

test('verifikasi kode pendaftaran penjual memakai verifyOtp type signup', () => {
    assert.match(FORM, /type: "signup"/);
    assert.match(FORM, /handleVerifyOtp/);
    assert.match(FORM, /pendingOtpEmail/);
    assert.match(FORM, /mapOtpVerifyError\(/);
});

test('setelah toko dibuat, peran dinaikkan lewat endpoint server bukan dari klien', () => {
    assert.match(FORM, /ensureSellerRole\(\)/);
    assert.match(FORM, /\/api\/auth\/seller-role/);
    assert.doesNotMatch(FORM, /from\("profiles"\)\s*\.update\(\{\s*role/);
});

test('endpoint peran memakai service role dan menolak tanpa toko', () => {
    assert.match(ROLE_ROUTE, /createServiceClient\(\)/);
    assert.match(ROLE_ROUTE, /getUserFromBearer\(/);
    assert.match(ROLE_ROUTE, /belum memiliki toko/);
});

test('endpoint peran tidak menurunkan admin dan tidak menyentuh peran asing', () => {
    assert.match(ROLE_ROUTE, /currentRole === 'umkm' \|\| currentRole === 'admin'/);
    assert.match(ROLE_ROUTE, /currentRole !== 'buyer'/);
});

test('perubahan peran dibatasi pada baris yang masih buyer (aman dari balapan)', () => {
    assert.match(ROLE_ROUTE, /\.eq\('role', 'buyer'\)/);
});

test('placeholder kode tidak menghardcode jumlah digit (produksi mengirim 6)', () => {
    assert.match(FORM, /placeholder="Kode verifikasi"/);
    assert.doesNotMatch(FORM, /placeholder="[^"]*\d+ digit/);
    assert.match(FORM, /maxLength=\{MAX_OTP_DIGITS\}/);
});

test('penjaga bisa gagal: tanpa panggilan naik-peran, toko dibuat tapi peran tetap buyer', () => {
    const rusak = FORM.split('await ensureSellerRole();').join('');
    assert.notEqual(rusak, FORM);
    assert.doesNotMatch(rusak, /await ensureSellerRole\(\)/);
});
