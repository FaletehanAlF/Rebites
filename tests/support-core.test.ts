import test from 'node:test';
import assert from 'node:assert/strict';
import { APPEAL_CODE_LENGTH, SUPPORT_MESSAGE_MAX, appealStatusMeta, formatAppealCode, isPlausibleAppealCode, isValidSupportEmail, normalizeAppealCode, normalizeSupportEmail, supportSenderLabel, } from '../lib/support.ts';
test('email dinormalkan ke huruf kecil tanpa spasi tepi', () => {
    assert.equal(normalizeSupportEmail('  Budi@Mail.COM '), 'budi@mail.com');
    assert.equal(normalizeSupportEmail(null), '');
    assert.equal(normalizeSupportEmail(undefined), '');
    assert.equal(normalizeSupportEmail('Budi@Mail.com'), normalizeSupportEmail('budi@mail.com'));
});
test('validasi email sejalan dengan pola di fungsi database', () => {
    assert.equal(isValidSupportEmail('budi@mail.com'), true);
    assert.equal(isValidSupportEmail(' BUDI@MAIL.CO.ID '), true);
    assert.equal(isValidSupportEmail(''), false);
    assert.equal(isValidSupportEmail('budi'), false);
    assert.equal(isValidSupportEmail('budi@mail'), false);
    assert.equal(isValidSupportEmail('budi @mail.com'), false);
    assert.equal(isValidSupportEmail('a@b@c.com'), false);
    assert.equal(isValidSupportEmail(null), false);
});
test('kode banding dirapikan: huruf besar, tanpa pemisah, tanpa awalan RB', () => {
    assert.equal(normalizeAppealCode('a1b2-c3d4-e5f6'), 'A1B2C3D4E5F6');
    assert.equal(normalizeAppealCode('RB-A1B2-C3D4-E5F6'), 'A1B2C3D4E5F6');
    assert.equal(normalizeAppealCode(' rb a1b2 c3d4 e5f6 '), 'A1B2C3D4E5F6');
    assert.equal(normalizeAppealCode(null), '');
    assert.equal(normalizeAppealCode('RB12'), 'RB12');
});
test('hanya kode 12 heksadesimal yang dianggap masuk akal', () => {
    assert.equal(APPEAL_CODE_LENGTH, 12);
    assert.equal(isPlausibleAppealCode('a1b2c3d4e5f6'), true);
    assert.equal(isPlausibleAppealCode('RB-A1B2-C3D4-E5F6'), true);
    assert.equal(isPlausibleAppealCode('a1b2c3d4e5f'), false);
    assert.equal(isPlausibleAppealCode('a1b2c3d4e5f6a'), false);
    assert.equal(isPlausibleAppealCode('g1b2c3d4e5f6'), false);
    assert.equal(isPlausibleAppealCode(''), false);
    assert.equal(isPlausibleAppealCode(null), false);
});
test('kode ditampilkan berkelompok empat huruf', () => {
    assert.equal(formatAppealCode('a1b2c3d4e5f6'), 'RB-A1B2-C3D4-E5F6');
    assert.equal(formatAppealCode('RB-A1B2-C3D4-E5F6'), 'RB-A1B2-C3D4-E5F6');
    assert.equal(formatAppealCode('ABC'), 'ABC');
});
test('status banding punya label dan arti bagi pengaju', () => {
    assert.equal(appealStatusMeta('pending').label, 'Menunggu ditinjau');
    assert.equal(appealStatusMeta('reviewing').label, 'Sedang ditinjau');
    assert.equal(appealStatusMeta('approved').label, 'Disetujui');
    assert.equal(appealStatusMeta('rejected').label, 'Ditolak');
    assert.match(appealStatusMeta('approved').hint, /masuk/);
    assert.equal(appealStatusMeta('PENDING').label, 'Menunggu ditinjau');
});
test('status tak dikenal TIDAK dikarang menjadi label resmi', () => {
    const meta = appealStatusMeta('escalted');
    assert.equal(meta.label, 'escalted');
    assert.equal(meta.variant, 'secondary');
    const kosong = appealStatusMeta(null);
    assert.equal(kosong.label, 'Status tidak diketahui');
    assert.equal(appealStatusMeta(undefined).label, 'Status tidak diketahui');
});
test('label pengirim konsisten di kedua sisi percakapan', () => {
    assert.equal(supportSenderLabel('admin'), 'Admin ReBites');
    assert.equal(supportSenderLabel('system'), 'Sistem ReBites');
    assert.equal(supportSenderLabel('user'), 'Pengguna');
    assert.equal(supportSenderLabel(null), 'Pengguna');
    assert.equal(supportSenderLabel('sesuatu'), 'Pengguna');
});
test('batas panjang pesan sama dengan CHECK di migrasi', () => {
    assert.equal(SUPPORT_MESSAGE_MAX, 2000);
});
