import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('kegagalan checkout mengisi promoError, bukan hanya console', () => {
    const context = read('app/components/checkout/checkout-context.tsx');
    assert.ok(context.includes('promoError: string | null;'));
    assert.ok(context.includes('setPromoError(msg)'));
});

test('kartu ringkasan merender promoError sebagai alert setelah tombol Pesan Sekarang', () => {
    const card = read('app/components/checkout/payment-summary-card.tsx');
    const buttonIndex = card.indexOf('Pesan Sekarang · ');
    const alertIndex = card.indexOf('{promoError &&');
    assert.ok(buttonIndex !== -1, 'tombol Pesan Sekarang tidak ditemukan');
    assert.ok(alertIndex > buttonIndex, 'pesan galat harus dirender di bawah tombol supaya terlihat');
    assert.ok(card.includes('role="alert"'));
    assert.ok(card.includes('{promoError}'));
});
