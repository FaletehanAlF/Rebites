import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EMAIL_NOT_REGISTERED_MESSAGE, INVALID_CREDENTIALS_MESSAGE, isInvalidCredentialsMessage, loginErrorMessageFor, } from '../lib/auth-login-hint.ts';

function readProjectFile(relative: string): string {
    return readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
}

const AUTH_FORM = readProjectFile('app/components/auth/auth-form.tsx');
const PENJUAL_LOGIN = readProjectFile('app/components/auth/penjual-login-form.tsx');
const ROUTE = readProjectFile('app/api/auth/login-hint/route.ts');

test('galat GoTrue "Invalid login credentials" dikenali, pesan lain tidak', () => {
    assert.equal(isInvalidCredentialsMessage('Invalid login credentials'), true);
    assert.equal(isInvalidCredentialsMessage('invalid_credentials'), true);
    assert.equal(isInvalidCredentialsMessage('Email not confirmed'), false);
    assert.equal(isInvalidCredentialsMessage(''), false);
});

test('email tak terdaftar menghasilkan pesan berbeda dari sandi salah', () => {
    assert.equal(loginErrorMessageFor('Invalid login credentials', false), EMAIL_NOT_REGISTERED_MESSAGE);
    assert.equal(loginErrorMessageFor('Invalid login credentials', true), INVALID_CREDENTIALS_MESSAGE);
    assert.equal(loginErrorMessageFor('Invalid login credentials', null), INVALID_CREDENTIALS_MESSAGE);
});

test('kegagalan memeriksa email TIDAK pernah menuduh email tak terdaftar', () => {
    assert.equal(loginErrorMessageFor('Invalid login credentials', null), INVALID_CREDENTIALS_MESSAGE);
    assert.notEqual(loginErrorMessageFor('Invalid login credentials', null), EMAIL_NOT_REGISTERED_MESSAGE);
});

test('galat selain kredensial dibiarkan apa adanya, tidak ditimpa', () => {
    assert.equal(loginErrorMessageFor('Email not confirmed', false), 'Email not confirmed');
    assert.equal(loginErrorMessageFor('Terlalu banyak permintaan', true), 'Terlalu banyak permintaan');
});

test('keputusan produk: endpoint ini memang membedakan email terdaftar dan tidak (user-enumeration)', () => {
    assert.match(ROUTE, /registered: true/);
    assert.match(ROUTE, /registered: false/);
    assert.match(ROUTE, /x-forwarded-for/);
    assert.match(ROUTE, /429/);
});

test('penjaga bisa gagal: pesan email-tak-terdaftar wajib berbeda dari pesan sandi salah', () => {
    assert.notEqual(EMAIL_NOT_REGISTERED_MESSAGE, INVALID_CREDENTIALS_MESSAGE);
});

test('endpoint login-hint memakai service role dan menyaring format email', () => {
    assert.match(ROUTE, /createServiceClient\(\)/);
    assert.match(ROUTE, /admin\.listUsers\(/);
    assert.match(ROUTE, /registered: true/);
    assert.match(ROUTE, /registered: false/);
    assert.match(ROUTE, /Format email tidak valid/);
    assert.doesNotMatch(ROUTE, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('kedua form login memakai aturan bersama, bukan cabang pesan sendiri', () => {
    assert.match(AUTH_FORM, /lookupEmailRegistered\(/);
    assert.match(AUTH_FORM, /loginErrorMessageFor\(/);
    assert.match(PENJUAL_LOGIN, /lookupEmailRegistered\(/);
    assert.match(PENJUAL_LOGIN, /loginErrorMessageFor\(/);
});

test('form login tidak lagi menulis pesan kredensial secara hardcode', () => {
    assert.doesNotMatch(AUTH_FORM, /setError\("Email atau kata sandi salah\."\)/);
    assert.doesNotMatch(PENJUAL_LOGIN, /throw new Error\("Email atau kata sandi salah\."\)/);
});
