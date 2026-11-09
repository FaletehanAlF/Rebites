import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { imageSrcVariants, resolveImageSrc } from '../lib/image-path.ts';

const source = readFileSync(new URL('../app/components/shared/SmartImage.tsx', import.meta.url), 'utf8');

test('SmartImage merender kandidat hasil resolve, bukan src mentah', () => {
    assert.ok(source.includes('const resolved = resolveImageSrc(src);'));
    assert.ok(source.includes('...imageSrcVariants(src)'));
    assert.ok(source.includes('const current = candidates[variantIndex]'));
    assert.ok(source.includes('<Image src={current}'));
    assert.equal(source.includes('<Image src={src}'), false);
});

test('kegagalan gambar jatuh ke varian berikutnya, lalu ke placeholder', () => {
    assert.ok(source.includes('variantIndex + 1 < candidates.length'));
    assert.ok(source.includes('setFailed(true)'));
    assert.ok(source.includes('<Leaf '));
});

test('kandidat memuat bentuk lama dan baru sehingga fallback mungkin', () => {
    const variants = imageSrcVariants('/makanan1.jpeg');
    assert.ok(variants.includes('/makanan1.avif'));
    assert.ok(variants.includes('/makanan1.jpeg'));
    assert.equal(resolveImageSrc('/makanan1.jpeg'), '/makanan1.avif');
    assert.equal(resolveImageSrc('https://contoh.com/a.jpg'), 'https://contoh.com/a.jpg');
});
