import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}
const PAGE = readProjectFile('app/(app)/dashboard/penjual/[storeId]/menu/page.tsx');
test('satu kartu pembuka, bukan tiga kotak bertumpuk', () => {
    assert.match(PAGE, /function FlashSaleSummaryRow\(/);
    assert.match(PAGE, /<FlashSaleSummaryRow plan=\{plan\} quota=\{flashQuota\} used=\{flashUsed\}\/>/);
    assert.doesNotMatch(PAGE, /FlashSaleSectionHeader/);
    assert.doesNotMatch(PAGE, /rounded-2xl bg-secondary p-4/);
});
test('panel Flash Sale di kartu produk dipisah garis, bukan kotak bersarang', () => {
    assert.match(PAGE, /<div className="mt-3 border-t border-border\/70 pt-3">/);
    assert.match(PAGE, /mt-3 space-y-2 border-t border-border\/70 pt-3/);
    assert.doesNotMatch(PAGE, /<div className="mt-3 rounded-2xl bg-secondary p-3">/);
});
test('status Flash Sale diumumkan sekali saja', () => {
    assert.doesNotMatch(PAGE, /'Akan Datang'/);
    assert.match(PAGE, /<FlashStatusBadge status=\{status\}\/>/);
});
test('berkas halaman tidak mengekspor apa pun selain default', () => {
    const exported = PAGE.split('\n').filter((line) => line.startsWith('export '));
    assert.equal(exported.length, 1);
    assert.match(exported[0], /^export default function MenuSayaPage\(\)/);
});
