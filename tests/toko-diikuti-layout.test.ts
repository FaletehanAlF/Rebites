import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

test('daftar toko diikuti memakai grid kartu responsif, bukan satu kolom sempit', () => {
    const page = readProjectFile('app/toko-diikuti/page.tsx');
    assert.match(page, /max-w-7xl/, 'halaman harus memakai kontainer lebar');
    assert.match(
        page,
        /grid list-none grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3/,
        'daftar toko harus memakai grid responsif 1/2/3 kolom'
    );
    assert.match(page, /rounded-3xl border border-border bg-white p-5/, 'setiap toko tampil sebagai kartu');
});

test('informasi toko rata kiri tanpa pemotongan, aksi tetap jelas', () => {
    const page = readProjectFile('app/toko-diikuti/page.tsx');
    const from = page.indexOf('function FollowedStoreCard');
    const until = page.indexOf('function RecommendationCard');
    const card = page.slice(from, until);
    assert.ok(from >= 0 && until > from, 'FollowedStoreCard harus ada di halaman');
    assert.match(card, /break-words font-display text-base font-semibold leading-snug text-foreground/);
    assert.match(card, /break-words text-xs leading-relaxed text-muted-foreground/);
    assert.ok(!card.includes('truncate'), 'nama/kategori toko tidak boleh dipotong "…" di daftar ikutan');
    assert.match(page, /aria-label=\{`Rating \$\{value\.toFixed\(1\)\} dari 5`\}/);
    assert.match(card, /aria-label=\{`Berhenti mengikuti \$\{store\.name\}`\}/);
    assert.match(card, /Lihat Toko/);
});

test('header putih konsisten tanpa remah roti, label koleksi, dan tautan ke /toko', () => {
    const page = readProjectFile('app/toko-diikuti/page.tsx');
    assert.ok(!page.includes('Beranda'), 'remah roti dihapus');
    assert.ok(!page.includes('Koleksi toko'), 'label koleksi dihapus');
    assert.ok(!page.includes('href="/toko"'), 'tautan ke halaman /toko dihapus');
    assert.match(page, /bg-white/, 'background header putih');
});

test('state kosong rata kiri tanpa kartu logo dan tombol mulai menjelajah', () => {
    const page = readProjectFile('app/toko-diikuti/page.tsx');
    assert.ok(!page.includes('text-center'), 'halaman tidak boleh meratakan tengah seluruh konten');
    assert.ok(!page.includes('Mulai Menjelajahi'), 'tombol mulai menjelajah dihapus');
    assert.ok(!page.includes('Ikuti toko favoritmu supaya mudah kembali'), 'teks empty state lama dihapus');
    assert.match(page, /Belum ada toko yang diikuti\./);
});
