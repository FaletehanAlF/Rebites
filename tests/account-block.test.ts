import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKED_ACCOUNT_MESSAGE, SUSPENDED_ACCOUNT_MESSAGE, blockMessageFor, classifyAccountBlock, isActiveBlockSanction, isBannedAuthError, isBlockedRoleErrorCode, } from '../lib/account-block.ts';
test('status banned dan suspended terdeteksi dari baris profil', () => {
    assert.equal(classifyAccountBlock({ account_status: 'banned' }), 'banned');
    assert.equal(classifyAccountBlock({ account_status: 'suspended' }), 'suspended');
    assert.equal(classifyAccountBlock({ account_status: ' BANNED ' }), 'banned');
    assert.equal(classifyAccountBlock({ account_status: 'Suspended' }), 'suspended');
    assert.equal(classifyAccountBlock('banned'), 'banned');
});
test('status lain diloloskan supaya data lama tidak mengunci akun', () => {
    assert.equal(classifyAccountBlock({ account_status: 'active' }), null);
    assert.equal(classifyAccountBlock({ account_status: null }), null);
    assert.equal(classifyAccountBlock({}), null);
    assert.equal(classifyAccountBlock(null), null);
    assert.equal(classifyAccountBlock(undefined), null);
    assert.equal(classifyAccountBlock(42), null);
    assert.equal(classifyAccountBlock({ account_status: 'probation' }), null);
});
test('pesan blokir membedakan diblokir dan ditangguhkan', () => {
    assert.match(blockMessageFor('banned'), /diblokir/);
    assert.match(blockMessageFor('suspended'), /ditangguhkan/);
    assert.equal(blockMessageFor('banned'), BLOCKED_ACCOUNT_MESSAGE);
    assert.equal(blockMessageFor('suspended'), SUSPENDED_ACCOUNT_MESSAGE);
    assert.match(BLOCKED_ACCOUNT_MESSAGE, /admin ReBites/);
    assert.match(SUSPENDED_ACCOUNT_MESSAGE, /admin ReBites/);
});
test('error GoTrue ber-code user_banned terbaca sebagai blokir', () => {
    assert.equal(isBannedAuthError({ code: 'user_banned', message: 'User is banned' }), true);
    assert.equal(isBannedAuthError({ error_code: 'user_banned' }), true);
    assert.equal(isBannedAuthError({ message: 'Invalid Refresh Token: User Banned' }), true);
    assert.equal(isBannedAuthError('User is banned'), true);
});
test('kegagalan login biasa TIDAK dibaca sebagai blokir', () => {
    assert.equal(isBannedAuthError({ message: 'Invalid login credentials' }), false);
    assert.equal(isBannedAuthError({ code: 'invalid_credentials' }), false);
    assert.equal(isBannedAuthError(new Error('Email not confirmed')), false);
    assert.equal(isBannedAuthError({ status: 400 }), false);
    assert.equal(isBannedAuthError(null), false);
    assert.equal(isBannedAuthError(undefined), false);
    assert.equal(isBannedAuthError(''), false);
    assert.equal(isBannedAuthError({ message: 'ban_duration tidak valid' }), false);
});
test('semua kode penolakan akun memutus sesi, bukan hanya yang terhapus', () => {
    assert.equal(isBlockedRoleErrorCode('account-deleted'), true);
    assert.equal(isBlockedRoleErrorCode('account-banned'), true);
    assert.equal(isBlockedRoleErrorCode('account-suspended'), true);
    assert.equal(isBlockedRoleErrorCode('no-session'), false);
    assert.equal(isBlockedRoleErrorCode('query-error'), false);
    assert.equal(isBlockedRoleErrorCode(undefined), false);
    assert.equal(isBlockedRoleErrorCode(null), false);
});
test('sanksi blokir yang masih berlaku dikenali untuk tombol buka blokir', () => {
    const sekarang = Date.parse('2026-11-05T12:00:00Z');
    const besok = '2026-11-06T12:00:00Z';
    const kemarin = '2026-11-04T12:00:00Z';
    assert.equal(isActiveBlockSanction({ sanctionType: 'ban', endAt: null }, sekarang), true);
    assert.equal(isActiveBlockSanction({ sanctionType: 'suspend', endAt: null }, sekarang), true);
    assert.equal(isActiveBlockSanction({ sanctionType: 'BAN', endAt: besok }, sekarang), true);
    assert.equal(isActiveBlockSanction({ sanctionType: 'ban', endAt: kemarin }, sekarang), false);
    assert.equal(isActiveBlockSanction({ sanctionType: 'delete', endAt: null }, sekarang), false);
    assert.equal(isActiveBlockSanction({ sanctionType: 'ban', endAt: 'bukan-tanggal' }, sekarang), true);
    assert.equal(isActiveBlockSanction(null, sekarang), false);
    assert.equal(isActiveBlockSanction({}, sekarang), false);
    assert.equal(isActiveBlockSanction({ sanctionType: 'warning' }, sekarang), false);
});
