import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readProjectFile(relative: string): string {
    return readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
}

function countOccurrences(source: string, needle: string): number {
    return source.split(needle).length - 1;
}

const FORM = 'app/components/auth/penjual-register-form.tsx';
const BARE_LOGIN = 'router.replace("/auth/login");';
const ONBOARDING_LOGIN = 'router.replace(loginUrlForOnboarding());';

test('halaman pendaftaran penjual membawa niat pendaftaran lewat parameter redirect', () => {
    const source = readProjectFile(FORM);
    assert.match(source, /function loginUrlForOnboarding\(\): string \{/);
    assert.match(source, /for \(const key of \["step", "plan", "billing"\]\)/);
    assert.match(source, /const target = `\/auth\/register\/penjual\$\{query \? `\?\$\{query\}` : ""\}`;/);
    assert.match(source, /return `\/auth\/login\?redirect=\$\{encodeURIComponent\(target\)\}`;/);
});

test('semua cabang tanpa sesi mengalihkan ke login yang membawa niat, bukan login polos', () => {
    const source = readProjectFile(FORM);
    assert.equal(countOccurrences(source, ONBOARDING_LOGIN), 3);
    assert.equal(countOccurrences(source, BARE_LOGIN), 0);
});

test('penjaga bisa gagal: redirect login polos menghapus niat pendaftaran', () => {
    const source = readProjectFile(FORM);
    const rusak = source.split(ONBOARDING_LOGIN).join(BARE_LOGIN);
    assert.notEqual(rusak, source);
    assert.equal(countOccurrences(rusak, BARE_LOGIN), 3);
    assert.equal(countOccurrences(rusak, ONBOARDING_LOGIN), 0);
});
