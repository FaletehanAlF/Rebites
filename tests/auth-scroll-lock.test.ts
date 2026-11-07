import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
function cssBlock(source: string, selector: string): string {
    const index = source.indexOf(selector);
    assert.ok(index >= 0, `selector tidak ditemukan di globals.css: ${selector}`);
    const open = source.indexOf('{', index);
    assert.ok(open >= 0, `blok tidak dibuka setelah selector: ${selector}`);
    const close = source.indexOf('}', open);
    assert.ok(close > open, `blok tidak ditutup setelah selector: ${selector}`);
    return source.slice(open + 1, close);
}
const CSS = readProjectFile('app/globals.css');
const SHELL = readProjectFile('app/components/auth/auth-split-shell.tsx');
const LOCK = readProjectFile('app/components/auth/auth-scroll-lock.tsx');
test('halaman auth tidak bisa digeser saat kelas kuncinya terpasang', () => {
    const block = cssBlock(CSS, 'html.auth-scroll-lock');
    assert.match(block, /overflow:\s*hidden/);
    assert.match(block, /overscroll-behavior:\s*none/);
    assert.match(CSS, /html\.auth-scroll-lock\s*,\s*\n\s*html\.auth-scroll-lock body/);
});
test('shell auth memasang kunci dan melepasnya saat halaman ditinggalkan', () => {
    assert.match(SHELL, /<AuthScrollLock \/>/);
    assert.match(SHELL, /from ["']\.\/auth-scroll-lock["']/);
    assert.match(LOCK, /classList\.add\(['"]auth-scroll-lock['"]\)/);
    assert.match(LOCK, /classList\.remove\(['"]auth-scroll-lock['"]\)/);
});
test('panel form di dalam halaman auth tetap punya gulirannya sendiri', () => {
    assert.match(SHELL, /overflow-y-auto overscroll-contain/);
});
