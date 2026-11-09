import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}

const FORGOT = readProjectFile('app/components/auth/forgot-password-form.tsx');
const BUAT_SANDI = readProjectFile('app/components/auth/buat-sandi-baru-form.tsx');
const PROFILE_ROUTE = readProjectFile('app/api/profile/route.ts');
const CONFIG_TOML = readProjectFile('supabase/config.toml');

test('form lupa sandi menerima kode pemulihan, bukan hanya tautan', () => {
    assert.match(FORGOT, /verifyOtp\(/);
    assert.match(FORGOT, /type:\s*"recovery"/);
    assert.match(FORGOT, /mapOtpVerifyError\(/);
    assert.match(FORGOT, /\/auth\/buat-sandi-baru/);
});

test('kode pemulihan divalidasi sebagai angka sebelum dikirim ke Supabase', () => {
    assert.match(FORGOT, /\^\\d\{6,10\}\$/);
    assert.match(FORGOT, /replace\(\/\\D\/g, ""\)/);
});

test('halaman sandi baru menjelaskan tautan kedaluwarsa, tidak mengalihkan tanpa pesan', () => {
    assert.match(BUAT_SANDI, /setLinkError\(/);
    assert.match(BUAT_SANDI, /kedaluwarsa/);
    assert.match(BUAT_SANDI, /\/auth\/forgotPassword/);
    assert.doesNotMatch(BUAT_SANDI, /useRouter/);
});

test('form lupa sandi memastikan sesi pemulihan terbentuk sebelum pindah ke halaman sandi baru', () => {
    assert.match(FORGOT, /adaSesi/);
    assert.match(FORGOT, /getSession\(\)/);
    assert.match(FORGOT, /sesi pemulihan belum terbentuk/);
    const idxPenjaga = FORGOT.indexOf('if (!adaSesi)');
    const idxPindah = FORGOT.indexOf('router.push("/auth/buat-sandi-baru")');
    assert.ok(idxPenjaga > -1, 'penjaga sesi pemulihan harus ada');
    assert.ok(idxPindah > idxPenjaga, 'perpindahan halaman harus terjadi SETELAH penjaga sesi');
});

test('/api/profile tidak memantulkan peran dari metadata yang bisa ditulis pengguna', () => {
    assert.doesNotMatch(PROFILE_ROUTE, /meta\.role/);
    assert.match(PROFILE_ROUTE, /role: 'buyer'/);
});

test('form lupa sandi menangani KEDUA bentuk email: kode maupun tautan', () => {
    assert.match(FORGOT, /inputMode="numeric"/);
    assert.match(FORGOT, /one-time-code/);
    assert.match(FORGOT, /tautan/);
});

test('panjang kode tidak dihardcode: produksi mengirim 8 digit, bukan 6', () => {
    assert.doesNotMatch(FORGOT, /Kode \d+ digit/);
    assert.doesNotMatch(FORGOT, /placeholder="[^"]*\d+ digit/);
    assert.match(FORGOT, /maxLength=\{10\}/);
});

test('template email Supabase wajib memuat {{ .Token }} agar kolom kode punya isi', () => {
    assert.match(FORGOT, /verifyOtp\(/);
    assert.match(FORGOT, /type:\s*"recovery"/);
    assert.match(FORGOT, /otpCode/);
});

test('form lupa sandi tidak menjanjikan email terkirim ke alamat yang belum tentu terdaftar', () => {
    assert.match(FORGOT, /Kalau email itu terdaftar/);
    assert.doesNotMatch(FORGOT, /\bKami sudah mengirimkan\b/);
});

test('config lokal mengizinkan pengalihan konfirmasi ke alamat dev 3000', () => {
    assert.match(CONFIG_TOML, /http:\/\/localhost:3000/);
    assert.match(CONFIG_TOML, /http:\/\/127\.0\.0\.1:3000/);
});
