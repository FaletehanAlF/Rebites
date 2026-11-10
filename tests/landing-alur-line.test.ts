import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}

const SECTION = readProjectFile('app/components/landing/HowItWorksSection.tsx');

test('section cara-kerja tetap ada supaya anchor landing tidak mati', () => {
    assert.match(SECTION, /id="cara-kerja"/);
});

test('alur punya dua audiens bertab beserta panelnya', () => {
    assert.match(SECTION, /role="tablist"/);
    assert.match(SECTION, /role="tabpanel"/);
    assert.match(SECTION, /'Pembeli'/);
    assert.match(SECTION, /'UMKM'/);
    assert.match(SECTION, /aria-selected=\{audience === key\}/);
});

test('setiap audiens punya tiga langkah bernomor 01 sampai 03', () => {
    const nomor = [...SECTION.matchAll(/number: '(\d{2})'/g)].map((m) => m[1]);
    assert.equal(nomor.length, 6, 'harus enam langkah, tiga untuk tiap audiens');
    assert.deepEqual(nomor, ['01', '02', '03', '01', '02', '03']);
});

test('tab tetap bisa dioperasikan dari papan ketik', () => {
    assert.match(SECTION, /ArrowRight/);
    assert.match(SECTION, /ArrowLeft/);
    assert.match(SECTION, /onKeyDown=\{handleTabKeyDown\}/);
});

test('penjaga bisa gagal: langkah yang hilang terbaca dari daftar nomor', () => {
    const rusak = SECTION.replace("number: '03'", '');
    assert.notEqual(rusak, SECTION);
    const nomor = [...rusak.matchAll(/number: '(\d{2})'/g)].map((m) => m[1]);
    assert.equal(nomor.length, 5);
    assert.notDeepEqual(nomor, ['01', '02', '03', '01', '02', '03']);
});

test('penjaga bisa gagal: panel tanpa peran tabpanel tertangkap', () => {
    const rusak = SECTION.replace('role="tabpanel"', '');
    assert.doesNotMatch(rusak, /role="tabpanel"/);
});
