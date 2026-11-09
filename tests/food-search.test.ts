import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestFoods } from '../lib/food-search.ts';

const FOODS = [
    {
        id: 'a',
        slug: 'nasi-goreng-surplus',
        name: 'Nasi Goreng Surplus',
        vendorName: 'Dapur Ibu Tini',
        image: '/makanan1.avif',
        category: 'makanan-berat',
        rating: 4.8,
        distanceKm: 2.4,
        availableFrom: '09:00',
        availableTo: '12:00',
        stockLabel: 'Stok 5',
        originalPrice: 25000,
        discountedPrice: 15000,
        discountPercent: 40,
    },
    {
        id: 'b',
        slug: 'roti-cokelat',
        name: 'Roti Cokelat',
        vendorName: 'Toko Roti Sinar',
        image: '/makanan2.avif',
        category: 'roti-kue',
        rating: 4.2,
        distanceKm: null,
        availableFrom: '09:00',
        availableTo: '12:00',
        stockLabel: 'Stok 9',
        originalPrice: 10000,
        discountedPrice: 8000,
        discountPercent: 20,
    },
    {
        id: 'c',
        slug: 'nasi-uduk',
        name: 'Nasi Uduk',
        vendorName: 'Warung Segar',
        image: '/makanan9.avif',
        category: 'makanan-berat',
        rating: null,
        distanceKm: null,
        availableFrom: '09:00',
        availableTo: '12:00',
        stockLabel: 'Stok 12',
        originalPrice: 12000,
        discountedPrice: 5000,
        discountPercent: 60,
    },
] as const;

test('saran pencarian hanya dari nama makanan, bukan nama toko', () => {
    assert.deepEqual(suggestFoods([...FOODS], 'nasi').map((item) => item.id), ['nasi-goreng-surplus', 'nasi-uduk']);
    assert.deepEqual(suggestFoods([...FOODS], 'sinar'), []);
    assert.deepEqual(suggestFoods([...FOODS], 'dapur'), []);
});

test('kata kunci kosong tidak memunculkan saran', () => {
    assert.deepEqual(suggestFoods([...FOODS], ''), []);
    assert.deepEqual(suggestFoods([...FOODS], '   '), []);
});

test('nama yang diawali kata kunci tampil lebih dulu', () => {
    assert.deepEqual(suggestFoods([...FOODS], 'cokelat').map((item) => item.id), ['roti-cokelat']);
    assert.equal(suggestFoods([...FOODS], 'goreng')[0].matchIndex, 5);
});

test('saran membawa tujuan detail dan harga yang ditampilkan', () => {
    const suggestions = suggestFoods([...FOODS], 'goreng');
    assert.ok(suggestions[0]);
    assert.equal(suggestions[0].id, 'nasi-goreng-surplus');
    assert.equal(suggestions[0].price, 15000);
    assert.equal(suggestions[0].vendorName, 'Dapur Ibu Tini');
    assert.equal(suggestions[0].matchIndex, 5);
});

test('jumlah saran dibatasi dan pencocokan tidak peka huruf besar', () => {
    assert.equal(suggestFoods([...FOODS], 'nasi', 1).length, 1);
    assert.deepEqual(suggestFoods([...FOODS], 'NASI').map((item) => item.id), ['nasi-goreng-surplus', 'nasi-uduk']);
    assert.deepEqual(suggestFoods([...FOODS], 'nasi', 0), []);
});
