import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const SECTION = readProjectFile('app/components/landing/HowItWorksSection.tsx');
test('garis penghubung alur tidak lagi bergantung pada posisi langkah', () => {
    assert.equal(SECTION.includes('index < STEPS.length - 1'), false, 'garis masih bersyarat, sehingga langkah 04 tetap tanpa garis');
    assert.match(SECTION, /<span aria-hidden className="hidden h-px flex-1 bg-white\/20 xl:block"\/>/, 'span garis penghubung hilang dari kartu langkah');
});
test('alur tetap empat langkah, termasuk 04', () => {
    for (const num of ['01', '02', '03', '04']) {
        assert.ok(SECTION.includes(`num: '${num}'`), `langkah ${num} hilang dari daftar`);
    }
});
