import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DUPLICATE_EMAIL_MESSAGE, isDuplicateEmailSignUp, } from '../lib/auth-signup.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const SIGNUP_LIB = readProjectFile('lib/auth-signup.ts');
const AUTH_FORM = readProjectFile('app/components/auth/auth-form.tsx');
test('jalur anti-enumeration: user tanpa identities = email sudah dipakai', () => {
    assert.equal(isDuplicateEmailSignUp({ error: null, identities: [], hasSession: false }), true);
    assert.equal(isDuplicateEmailSignUp({ error: null, identities: [] }), true);
});
test('jalur dengan sesi: sesi akun lama yang terlanjur dibuat tetap duplikat', () => {
    assert.equal(isDuplicateEmailSignUp({ error: null, identities: [], hasSession: true }), true);
});
test('jalur error: kode dan pesan GoTrue "sudah terdaftar" dikenali', () => {
    assert.equal(isDuplicateEmailSignUp({ error: { code: 'user_already_exists' } }), true);
    assert.equal(isDuplicateEmailSignUp({ error: { error_code: 'email_exists' } }), true);
    assert.equal(isDuplicateEmailSignUp({ error: { message: 'User already registered' } }), true);
    assert.equal(isDuplicateEmailSignUp({ error: 'A user with this email address has already been registered' }), true);
});
test('pendaftaran yang sah TIDAK dituduh duplikat', () => {
    assert.equal(isDuplicateEmailSignUp({
        error: null,
        identities: [{ id: 'x', provider: 'email' }],
        hasSession: false,
    }), false);
    assert.equal(isDuplicateEmailSignUp({
        error: null,
        identities: [{ id: 'x', provider: 'email' }],
        hasSession: true,
    }), false);
    assert.equal(isDuplicateEmailSignUp({ error: { message: 'Invalid login credentials' } }), false);
    assert.equal(isDuplicateEmailSignUp({
        error: { code: 'over_email_send_rate_limit', message: 'Too many requests' },
    }), false);
    assert.equal(isDuplicateEmailSignUp({}), false);
    assert.equal(isDuplicateEmailSignUp({ error: null, identities: undefined }), false);
});
test('form register memakai aturan bersama, bukan cabang pesan sendiri', () => {
    assert.match(AUTH_FORM, /isDuplicateEmailSignUp\(/);
    assert.match(AUTH_FORM, /DUPLICATE_EMAIL_MESSAGE/);
    assert.match(AUTH_FORM, /setError\(DUPLICATE_EMAIL_MESSAGE\)/);
    assert.doesNotMatch(AUTH_FORM, /Email sudah terdaftar\. Silakan masuk/);
    assert.doesNotMatch(AUTH_FORM, /message\.includes\("User already registered"\)/);
});
test('modul aturan tetap murni agar bisa diuji tanpa Supabase', () => {
    assert.match(SIGNUP_LIB, /export function isDuplicateEmailSignUp/);
    assert.match(SIGNUP_LIB, /export const DUPLICATE_EMAIL_MESSAGE/);
    assert.doesNotMatch(SIGNUP_LIB, /^import /m);
    assert.equal(DUPLICATE_EMAIL_MESSAGE, 'Email sudah terdaftar. Silakan login menggunakan akun tersebut.');
});
