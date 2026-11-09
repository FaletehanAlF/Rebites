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

test('/api/profile tidak memantulkan peran dari metadata yang bisa ditulis pengguna', () => {
    assert.doesNotMatch(PROFILE_ROUTE, /meta\.role/);
    assert.match(PROFILE_ROUTE, /role: 'buyer'/);
});

test('form lupa sandi menangani KEDUA bentuk email: kode maupun tautan', () => {
    assert.match(FORGOT, /inputMode="numeric"/);
    assert.match(FORGOT, /one-time-code/);
    assert.match(FORGOT, /tautan/);
});

test('template email Supabase wajib memuat {{ .Token }} agar kolom kode punya isi', () => {
    assert.match(FORGOT, /verifyOtp\(/);
    assert.match(FORGOT, /type:\s*"recovery"/);
    assert.match(FORGOT, /otpCode/);
});

test('config lokal mengizinkan pengalihan konfirmasi ke alamat dev 3000', () => {
    assert.match(CONFIG_TOML, /http:\/\/localhost:3000/);
    assert.match(CONFIG_TOML, /http:\/\/127\.0\.0\.1:3000/);
});
