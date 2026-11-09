import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));
const MOUNT_PATTERN = /<Toaster(?![A-Za-z])/g;

function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            sourceFiles(full, out);
            continue;
        }
        if (/\.tsx?$/.test(entry.name))
            out.push(full);
    }
    return out;
}

function mountCount(source: string): number {
    return source.match(MOUNT_PATTERN)?.length ?? 0;
}

test('hanya layout akar yang memasang <Toaster/>', () => {
    const mounts = sourceFiles(APP_DIR)
        .filter((file) => mountCount(readFileSync(file, 'utf8')) > 0)
        .map((file) => relative(APP_DIR, file).split(sep).join('/'))
        .sort();
    assert.deepEqual(mounts, ['layout.tsx'], 'dua Toaster membaca store yang sama, jadi tiap toast tampil dua kali');
});

test('layout akar memasang Toaster tepat sekali', () => {
    const source = readFileSync(join(APP_DIR, 'layout.tsx'), 'utf8');
    assert.equal(mountCount(source), 1);
});
