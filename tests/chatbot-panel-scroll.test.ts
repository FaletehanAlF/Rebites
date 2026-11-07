import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const SOURCE = readProjectFile('app/components/chatbot/chatbot-widget.tsx');
function classNamesAround(marker: string): string {
    const index = SOURCE.indexOf(marker);
    assert.ok(index >= 0, `penanda tidak ditemukan di sumber: ${marker}`);
    const attributeStart = SOURCE.indexOf('className=', index);
    assert.ok(attributeStart >= 0, `className tidak ditemukan setelah: ${marker}`);
    const STRING_PREFIX = 'className="';
    if (SOURCE.startsWith(STRING_PREFIX, attributeStart)) {
        const from = attributeStart + STRING_PREFIX.length;
        const to = SOURCE.indexOf('"', from);
        return SOURCE.slice(from, to);
    }
    const open = SOURCE.indexOf('{', attributeStart);
    assert.ok(open >= 0, `kurung kurawal pembuka tidak ditemukan: ${marker}`);
    let depth = 0;
    for (let i = open; i < SOURCE.length; i += 1) {
        const char = SOURCE[i];
        if (char === '{')
            depth += 1;
        else if (char === '}') {
            depth -= 1;
            if (depth === 0)
                return SOURCE.slice(open, i + 1);
        }
    }
    assert.fail(`kurung kurawal tidak seimbang pada: ${marker}`);
}
test('daftar pesan memakai min-h-0 agar flex-1 benar-benar menyusut', () => {
    const classes = classNamesAround('ref={listRef}');
    assert.match(classes, /overflow-y-auto/, 'daftar pesan harus bisa digulir vertikal');
    assert.match(classes, /\bmin-h-0\b/, 'TANPA min-h-0 daftar pesan tumbuh melewati panel dan tidak bisa digulir');
});
test('daftar pesan menahan guliran agar tidak merembet ke halaman di belakang', () => {
    const classes = classNamesAround('ref={listRef}');
    assert.match(classes, /overscroll-contain/, 'guliran di dalam panel tidak boleh ikut menggulir halaman di belakangnya');
});
test('panel tetap kolom flex dengan tinggi terbatas dan isi terpotong', () => {
    const classes = classNamesAround('role="dialog"');
    assert.match(classes, /flex-col/, 'panel harus kolom flex');
    assert.match(classes, /overflow-hidden/, 'panel harus memotong isi yang keluar');
    assert.match(classes, /h-\[70vh\]/, 'panel harus punya tinggi terbatas');
    assert.match(classes, /max-h-\[560px\]/, 'tinggi maksimum menjaga panel tidak terlalu tinggi');
});
test('form input berada di luar area gulir sehingga selalu terlihat', () => {
    const listStart = SOURCE.indexOf('ref={listRef}');
    const formStart = SOURCE.indexOf('<form');
    assert.ok(listStart >= 0 && formStart >= 0);
    assert.ok(formStart > listStart, 'form harus dirender setelah daftar pesan');
    const between = SOURCE.slice(listStart, formStart);
    assert.match(between, /<\/div>\s*\n\s*\{error &&/, 'daftar pesan harus ditutup sebelum blok error dan form dimulai');
});
