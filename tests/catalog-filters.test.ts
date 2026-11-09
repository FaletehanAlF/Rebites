import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAndSortFoods, filterAndSortVendors, countActiveFoodFilters, countActiveVendorFilters, availableFoodCategories, availableVendorCities, isOutOfStockLabel, } from '../lib/catalog-filters.ts';
const FOODS = [
    {
        id: 'a',
        name: 'Nasi Goreng Surplus',
        vendorName: 'Dapur Ibu Tini',
        category: 'makanan-berat',
        discountedPrice: 15000,
        discountPercent: 40,
        rating: 4.8,
        stockLabel: 'Stok 5',
    },
    {
        id: 'b',
        name: 'Roti Cokelat',
        vendorName: 'Toko Roti Sinar',
        category: 'roti-kue',
        discountedPrice: 8000,
        discountPercent: 20,
        rating: 4.2,
        stockLabel: 'Habis',
    },
    {
        id: 'c',
        name: 'Es Teh Jumbo',
        vendorName: 'Warung Segar',
        category: 'minuman',
        discountedPrice: 5000,
        discountPercent: 60,
        rating: null,
        stockLabel: 'Stok 12',
    },
];
test('search hanya mencocokkan nama makanan, bukan nama toko, tanpa regex', () => {
    assert.deepEqual(filterAndSortFoods(FOODS, { query: 'goreng' }).map((f) => f.id), ['a']);
    assert.deepEqual(filterAndSortFoods(FOODS, { query: 'sinar' }), []);
    assert.deepEqual(filterAndSortFoods(FOODS, { query: 'nasi goreng' }).map((f) => f.id), ['a']);
    assert.deepEqual(filterAndSortFoods(FOODS, { query: 'Nasi.*Goreng' }), []);
    assert.deepEqual(filterAndSortFoods(FOODS, { query: '   ' }).map((f) => f.id), ['a', 'b', 'c']);
});
test('filter kategori dan rentang harga bisa digabung', () => {
    const result = filterAndSortFoods(FOODS, {
        categoryId: 'makanan-berat',
        maxPrice: 20000,
    });
    assert.deepEqual(result.map((f) => f.id), ['a']);
    const tooCheap = filterAndSortFoods(FOODS, { minPrice: 9000 });
    assert.deepEqual(tooCheap.map((f) => f.id), ['a']);
});
test('filter stok menyembunyikan produk habis', () => {
    const available = filterAndSortFoods(FOODS, { stock: 'tersedia' });
    assert.deepEqual(available.map((f) => f.id), ['a', 'c']);
    assert.equal(isOutOfStockLabel('HABIS'), true);
    assert.equal(isOutOfStockLabel('Stok 3'), false);
});
test('sort memakai data asli dan tidak mengubah array masukan', () => {
    const original = [...FOODS];
    assert.deepEqual(filterAndSortFoods(FOODS, { sort: 'diskon-terbesar' }).map((f) => f.id), ['c', 'a', 'b']);
    assert.deepEqual(filterAndSortFoods(FOODS, { sort: 'harga-rendah' }).map((f) => f.id), ['c', 'b', 'a']);
    assert.deepEqual(filterAndSortFoods(FOODS, { sort: 'harga-tinggi' }).map((f) => f.id), ['a', 'b', 'c']);
    assert.deepEqual(filterAndSortFoods(FOODS, { sort: 'rating' }).map((f) => f.id), ['a', 'b', 'c']);
    assert.deepEqual(FOODS, original, 'array masukan tidak boleh diurutkan in-place');
});
test('hitungan filter aktif dipakai untuk badge', () => {
    assert.equal(countActiveFoodFilters({}), 0);
    assert.equal(countActiveFoodFilters({
        query: ' nasi ',
        categoryId: 'makanan-berat',
        maxPrice: 20000,
        stock: 'tersedia',
        sort: 'rating',
    }), 5);
});
test('kategori yang ditawarkan hanya yang punya produk', () => {
    assert.deepEqual(availableFoodCategories(FOODS), [
        'makanan-berat',
        'roti-kue',
        'minuman',
    ]);
});
const VENDORS = [
    {
        id: 'v1',
        name: 'Dapur Ibu Tini',
        description: 'Masakan rumahan',
        address: 'Jl. Nusantara Raya No. 22, Sukmajaya, Kota Depok',
        category: 'Restoran',
        rating: 4.9,
        distanceKm: 2.4,
        isOpen: true,
    },
    {
        id: 'v2',
        name: 'Toko Roti Sinar',
        description: 'Roti dan kue harian',
        address: 'Jl. Margonda, Beji, Kota Depok',
        category: 'Bakery',
        rating: 4.3,
        distanceKm: null,
        isOpen: false,
    },
];
test('search UMKM memakai nama toko dan deskripsi', () => {
    assert.deepEqual(filterAndSortVendors(VENDORS, { query: 'roti' }).map((v) => v.id), ['v2']);
    assert.deepEqual(filterAndSortVendors(VENDORS, { query: 'rumahan' }).map((v) => v.id), ['v1']);
});
test('filter lokasi dan status buka benar-benar menyaring', () => {
    assert.deepEqual(filterAndSortVendors(VENDORS, { openOnly: 'buka' }).map((v) => v.id), ['v1']);
    assert.deepEqual(filterAndSortVendors(VENDORS, { location: 'Beji' }).map((v) => v.id), ['v2']);
});
test('sort UMKM: jarak null ditaruh paling akhir, nama memakai locale id', () => {
    assert.deepEqual(filterAndSortVendors(VENDORS, { sort: 'rating' }).map((v) => v.id), ['v1', 'v2']);
    assert.deepEqual(filterAndSortVendors(VENDORS, { sort: 'jarak' }).map((v) => v.id), ['v1', 'v2']);
    assert.deepEqual(filterAndSortVendors(VENDORS, { sort: 'nama' }).map((v) => v.id), ['v1', 'v2']);
});
test('hitungan filter UMKM', () => {
    assert.equal(countActiveVendorFilters({}), 0);
    assert.equal(countActiveVendorFilters({
        query: 'roti',
        location: 'Kota Depok',
        openOnly: 'buka',
        sort: 'jarak',
    }), 4);
});
test('kota UMKM diambil dari alamat, kode pos tidak dianggap kota', () => {
    const cities = availableVendorCities([
        ...VENDORS,
        { address: 'Jl. Mawar, Sukmajaya, 16454' },
    ]);
    assert.ok(cities.includes('Kota Depok'));
    assert.ok(!cities.includes('16454'));
    assert.deepEqual(cities, [...cities].sort((a, b) => a.localeCompare(b, 'id')));
});
