import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}
const STARS = readProjectFile('app/components/seller/dashboard-penjual/RatingStars.tsx');
const CHIPS = readProjectFile('app/components/seller/dashboard-penjual/RatingFilterChips.tsx');
const PAGE = readProjectFile('app/(app)/dashboard/penjual/[storeId]/ulasan/page.tsx');
const TAILWIND = readProjectFile('tailwind.config.ts');
test('bintang tidak pernah memakai warna hijau brand', () => {
    for (const source of [STARS, CHIPS]) {
        assert.doesNotMatch(source, /fill-primary\b/);
        assert.doesNotMatch(source, /text-primary\b/);
    }
    assert.doesNotMatch(PAGE, /fill-primary/);
});
test('filter rating: bintang emas, kontras memadai di kedua latar chip', () => {
    assert.match(CHIPS, /fill-gold-300 text-gold-300/);
    assert.match(CHIPS, /fill-gold-600 text-gold-600/);
    assert.match(CHIPS, /aria-pressed=\{selected\}/);
});
test('bintang kosong tidak putih dan tidak memakai token karangan', () => {
    assert.doesNotMatch(STARS, /text-primary-foreground/);
    assert.doesNotMatch(STARS, /border-100/);
    assert.match(STARS, /text-muted-foreground\/80/);
    assert.match(STARS, /fill-gold-600 text-gold-600/);
    assert.match(STARS, /aria-label=\{`Rating \$\{safe\} dari 5`\}/);
});
test('token emas yang dipakai benar-benar ada di tema Tailwind', () => {
    assert.match(TAILWIND, /'gold-300': '#E2C98A'/);
    assert.match(TAILWIND, /'gold-600': '#B08A1C'/);
});
test('kartu Rating Toko di halaman yang sama ikut memakai bintang emas', () => {
    const card = readProjectFile('app/components/seller/dashboard-penjual/StoreRatingCard.tsx');
    assert.doesNotMatch(card, /fill-primary/);
    assert.doesNotMatch(card, /fill-border-100|text-primary-foreground/);
    assert.match(card, /fill-gold-600 text-gold-600/);
    assert.match(card, /text-muted-foreground\/80/);
});
test('halaman ulasan memakai komponen bersama, bukan salinan lokal', () => {
    assert.match(PAGE, /import \{ RatingFilterChips \}/);
    assert.match(PAGE, /import \{ RatingStars \}/);
    assert.doesNotMatch(PAGE, /fill-border-100/);
    assert.doesNotMatch(PAGE, /function Stars\(/);
});
