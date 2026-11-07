import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OAUTH_INTENT_LOGIN, OAUTH_INTENT_REGISTER, getOAuthIntent, isReturningOAuthUser, REGISTER_GOOGLE_EXISTS_MESSAGE, REGISTER_INTENT_GRACE_MS, } from '../lib/oauth-intent.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const AUTH_FORM = readProjectFile('app/components/auth/auth-form.tsx');
const CALLBACK = readProjectFile('app/auth/callback/page.tsx');
const OAUTH_LIB = readProjectFile('lib/auth-oauth.ts');
const OAUTH_INTENT_LIB = readProjectFile('lib/oauth-intent.ts');
test('getOAuthIntent membaca register dan login', () => {
    assert.equal(getOAuthIntent('oauth=google&intent=register'), OAUTH_INTENT_REGISTER);
    assert.equal(getOAuthIntent('?oauth=google&intent=login'), OAUTH_INTENT_LOGIN);
    assert.equal(getOAuthIntent('code=x&intent=register&next=/home'), 'register');
});
test('getOAuthIntent menolak nilai liar dan input rusak', () => {
    assert.equal(getOAuthIntent('oauth=google'), null);
    assert.equal(getOAuthIntent('intent=REGIS TER'), null);
    assert.equal(getOAuthIntent('intent=admin'), null);
    assert.equal(getOAuthIntent('intent='), null);
    assert.equal(getOAuthIntent('%'), null);
    assert.equal(getOAuthIntent(''), null);
});
test('akun baru (created_at ≈ last_sign_in_at) tidak dituduh lama', () => {
    const now = new Date('2026-11-06T03:00:00.000Z').toISOString();
    assert.equal(isReturningOAuthUser({ created_at: now, last_sign_in_at: now }), false);
    const aSecondLater = new Date('2026-11-06T03:00:01.000Z').toISOString();
    assert.equal(isReturningOAuthUser({ created_at: now, last_sign_in_at: aSecondLater }), false);
    const underGrace = new Date(new Date(now).getTime() + REGISTER_INTENT_GRACE_MS - 1000).toISOString();
    assert.equal(isReturningOAuthUser({ created_at: now, last_sign_in_at: underGrace }), false);
});
test('akun baru dengan jeda redirect beberapa detik (perangkat lambat) tetap dianggap baru', () => {
    const created = new Date(Date.now() - 5000).toISOString();
    const last = new Date().toISOString();
    assert.equal(isReturningOAuthUser({ created_at: created, last_sign_in_at: last }), false);
});
test('regresi: akun lama berumur 5 menit yang mendaftar ulang ditolak', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    assert.equal(isReturningOAuthUser({ created_at: fiveMinutesAgo, last_sign_in_at: now }), true);
});
test('regresi: akun lama berumur 1 menit (di atas grace) dikenali', () => {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const now = new Date().toISOString();
    assert.equal(isReturningOAuthUser({ created_at: oneMinuteAgo, last_sign_in_at: now }), true);
});
test('akun lama (last_sign_in_at = sekarang, created_at jauh lebih tua) dikenali', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    assert.equal(isReturningOAuthUser({ created_at: tenDaysAgo, last_sign_in_at: now }), true);
});
test('timestamp yang hilang/rusak dianggap akun baru (fail-open untuk pendaftar sah)', () => {
    assert.equal(isReturningOAuthUser(null), false);
    assert.equal(isReturningOAuthUser({}), false);
    assert.equal(isReturningOAuthUser({ created_at: 'bukan tanggal' }), false);
    assert.equal(isReturningOAuthUser({ created_at: '2020-01-01T00:00:00.000Z' }), false);
});
test('pesan register Google persis seperti yang diminta', () => {
    assert.equal(REGISTER_GOOGLE_EXISTS_MESSAGE, 'Email sudah terdaftar. Silakan login menggunakan Google.');
});
test('form Google membaca mode: register di halaman daftar, login di halaman masuk', () => {
    assert.match(AUTH_FORM, /signInWithOAuth\(/);
    assert.match(AUTH_FORM, /getOAuthCallbackUrl\([\s\S]{0,120}isSignup\s*\?\s*"register"\s*:\s*"login"/);
});
test('getOAuthCallbackUrl menerima intent dan menyetelnya pada URL', () => {
    assert.match(OAUTH_LIB, /intent\?:\s*OAuthIntent \| null/);
    assert.match(OAUTH_LIB, /params\.set\(OAUTH_INTENT_PARAM, intent\)/);
    assert.match(OAUTH_LIB, /OAUTH_INTENT_REGISTER \|\| intent === OAUTH_INTENT_LOGIN/);
});
test('callback menolak akun Google lama pada jalur register', () => {
    assert.match(CALLBACK, /getOAuthIntent\(/);
    assert.match(CALLBACK, /registerIntent/);
    assert.match(CALLBACK, /const rejectIfReturningOAuthUser = async/);
    const calls = (CALLBACK.match(/rejectIfReturningOAuthUser\(/g) ?? []).length;
    assert.ok(calls >= 3, `gerbang penolakan hanya dipakai ${calls} kali (diharapkan 3 jalur)`);
    assert.match(CALLBACK, /supabase\.auth\.signOut\(\)/);
    assert.match(CALLBACK, /REGISTER_GOOGLE_EXISTS_MESSAGE/);
    assert.match(CALLBACK, /isReturningOAuthUser\(/);
});
test('modul aturan intent tetap murni agar bisa diuji tanpa Supabase', () => {
    assert.doesNotMatch(OAUTH_INTENT_LIB, /^import /m);
    assert.match(OAUTH_INTENT_LIB, /export function isReturningOAuthUser/);
    assert.match(OAUTH_INTENT_LIB, /export function getOAuthIntent/);
});
