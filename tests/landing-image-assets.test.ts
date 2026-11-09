import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const LANDING_DIR = new URL('../app/components/landing/', import.meta.url);
const PUBLIC_DIR = new URL('../public/', import.meta.url);

function landingSources(): { file: string; source: string }[] {
    return readdirSync(LANDING_DIR)
        .filter((name) => name.endsWith('.tsx'))
        .map((name) => ({
            file: `app/components/landing/${name}`,
            source: readFileSync(new URL(name, LANDING_DIR), 'utf8'),
        }));
}

/**
 * Rujukan gambar statis di dalam sebuah komponen: literal string yang diawali
 * garis miring dan berakhiran ekstensi gambar. Rujukan yang dibangun dari
 * variabel tidak tertangkap di sini, dan itu memang di luar jangkauan tes.
 */
function imageRefs(source: string): string[] {
    const found = new Set<string>();
    const pattern = /["'`]\/([A-Za-z0-9._/-]+\.(?:avif|jpg|jpeg|png|webp|svg))["'`]/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) found.add(match[1]);
    return [...found];
}

test('setiap gambar statis di komponen landing benar-benar ada di public', () => {
    const missing: string[] = [];
    for (const { file, source } of landingSources()) {
        for (const ref of imageRefs(source)) {
            if (!existsSync(new URL(ref, PUBLIC_DIR))) missing.push(`${file} -> /${ref}`);
        }
    }
    assert.deepEqual(missing, [], `rujukan gambar tanpa berkas:\n${missing.join('\n')}`);
});

test('section "Pilihan Hemat, Manfaat Lebih Besar." memakai berkas yang ada', () => {
    const source = readFileSync(new URL('WhyReBitesSection.tsx', LANDING_DIR), 'utf8');
    assert.match(source, /src="\/terselamatkan\.avif"/);
    assert.equal(existsSync(new URL('terselamatkan.avif', PUBLIC_DIR)), true);
});

test('penjaga bisa gagal: ekstensi yang salah terdeteksi sebagai berkas hilang', () => {
    const source = readFileSync(new URL('WhyReBitesSection.tsx', LANDING_DIR), 'utf8');
    const rusak = source.replace('/terselamatkan.avif', '/terselamatkan.jpg');
    assert.notEqual(rusak, source);

    const cek = (input: string): string[] =>
        imageRefs(input).filter((ref) => !existsSync(new URL(ref, PUBLIC_DIR)));

    assert.deepEqual(cek(source), []);
    assert.deepEqual(cek(rusak), ['terselamatkan.jpg']);
});
