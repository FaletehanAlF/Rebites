import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}

const CSS = readProjectFile('app/globals.css');

function blokPertama(source: string, tag: string): string {
    const pola = new RegExp(`(?:^|\\n)[ \\t]*${tag}[ \\t]*\\{([^}]*)\\}`);
    const hasil = pola.exec(source);
    assert.ok(hasil, `blok ${tag} tidak ditemukan di globals.css`);
    return hasil![1];
}

test('guliran halaman berhenti di ujung, tanpa pantulan, di elemen akar dan body', () => {
    assert.match(blokPertama(CSS, 'html'), /overscroll-behavior:\s*none/, 'html harus menahan pantulan gulir');
    assert.match(blokPertama(CSS, 'body'), /overscroll-behavior:\s*none/, 'body harus menahan pantulan gulir pada mesin yang menurunkannya dari body');
});

test('penjaga ini benar-benar bisa gagal', () => {
    const dilepas = CSS.replace(/overscroll-behavior:\s*none;/g, '');
    assert.doesNotMatch(blokPertama(dilepas, 'html'), /overscroll-behavior/);
    assert.doesNotMatch(blokPertama(dilepas, 'body'), /overscroll-behavior/);
});

test('aturan ini menahan pantulan, bukan mengunci guliran halaman', () => {
    assert.doesNotMatch(blokPertama(CSS, 'html'), /overflow:\s*hidden/, 'html tidak boleh dikunci overflow:hidden — seluruh situs jadi tidak bisa digulir');
    assert.doesNotMatch(blokPertama(CSS, 'body'), /overflow:\s*hidden/, 'body tidak boleh dikunci overflow:hidden');
});

test('globals.css harus lolos parse PostCSS', () => {
    assert.doesNotThrow(() => postcss.parse(CSS), 'kurung yang tidak seimbang di globals.css menggagalkan build produksi, bukan typecheck/lint/tes');
});

test('penjaga parse CSS ini benar-benar bisa gagal', () => {
    assert.throws(() => postcss.parse('html { overscroll-behavior: none; }\n}\n'), 'kurung menggantung harus ditolak');
});
