import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}

const KERANGKA_DASBOR = [
    'app/components/admin/dashboard/dashboard-skeleton.tsx',
    'app/components/admin/dashboard/dashboard-analytics.tsx',
    'app/components/admin/dashboard/dashboard-visitors.tsx',
];

test('kerangka dashboard admin memakai kilau kaca, bukan denyut opacity', () => {
    for (const berkas of KERANGKA_DASBOR) {
        const sumber = readProjectFile(berkas);
        assert.match(sumber, /<Skeleton/, `${berkas} harus memakai komponen Skeleton berkilau`);
        assert.doesNotMatch(sumber, /animate-pulse/, `${berkas} masih memakai denyut opacity`);
    }
});

test('kerangka dashboard admin terbaca sebagai kartu wireframe, bukan kotak polos', () => {
    const skeleton = readProjectFile('app/components/admin/dashboard/dashboard-skeleton.tsx');
    assert.match(skeleton, /role="status"/);
    assert.match(skeleton, /aria-label="Memuat dasbor"/);
    const garis = (skeleton.match(/ring-1 ring-border\/50/g) ?? []).length;
    assert.ok(garis >= 4, `garis kartu wireframe kurang: ${garis}`);
    const kotakKpi = (skeleton.match(/Array\.from\(\{ length: 4 \}\)/g) ?? []).length;
    assert.equal(kotakKpi, 2, 'kerangka harus meniru dua baris KPI dashboard');
});

test('jalur memuat dashboard admin tidak memakai spinner berputar', () => {
    for (const berkas of KERANGKA_DASBOR) {
        const sumber = readProjectFile(berkas);
        assert.doesNotMatch(sumber, /animate-spin/, `${berkas} memakai spinner berputar`);
        assert.doesNotMatch(sumber, /Loader2/, `${berkas} memakai ikon pemutar`);
    }
});

test('penjaga bisa gagal: denyut opacity dan spinner ditolak', () => {
    const pola = (sumber: string) => /animate-pulse|animate-spin|Loader2/.test(sumber);
    assert.equal(pola('<div className="animate-pulse bg-sage-100/60"/>'), true);
    assert.equal(pola('<Loader2 className="animate-spin"/>'), true);
    assert.equal(pola('<Skeleton className="h-28 rounded-[var(--radius)] ring-1 ring-border/50"/>'), false);
});
