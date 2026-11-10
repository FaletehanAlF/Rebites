import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}

const FORM = readProjectFile('app/components/auth/penjual-register-form.tsx');

test('input nama lengkap dan email form daftar penjual memuat contoh isian', () => {
    assert.match(FORM, /<input id="fullName"[^>]*placeholder="Contoh: user1234567"/);
    assert.match(FORM, /<input id="email"[^>]*placeholder="Contoh: user123@gmail\.com"/);
});

test('contoh isian menempel pada input yang benar, tidak tertukar', () => {
    assert.doesNotMatch(FORM, /<input id="fullName"[^>]*placeholder="Contoh: user123@gmail\.com"/);
    assert.doesNotMatch(FORM, /<input id="email"[^>]*placeholder="Contoh: user1234567"/);
});

test('penjaga bisa gagal: input tanpa contoh isian ditolak', () => {
    const polos = '<input id="fullName" {...field} className={inputClass()}/>';
    assert.doesNotMatch(polos, /<input id="fullName"[^>]*placeholder="Contoh: user1234567"/);
    assert.doesNotMatch(polos, /<input id="email"[^>]*placeholder="Contoh: user123@gmail\.com"/);
});
