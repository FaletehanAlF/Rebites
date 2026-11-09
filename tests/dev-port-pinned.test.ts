import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
function readProject(relative: string): string {
    return readFileSync(path.join(ROOT, relative), 'utf8');
}
test('skrip dev mengunci port 3000 secara eksplisit', () => {
    const pkg = JSON.parse(readProject('package.json')) as {
        scripts: Record<string, string>;
    };
    assert.match(pkg.scripts.dev, /next dev --turbo --port 3000/);
    assert.match(pkg.scripts['dev:webpack'], /next dev --port 3000/);
    assert.match(pkg.scripts['dev:reset'], /scripts\/dev-reset\.mjs/);
});
test('dev:reset hanya mematikan proses milik proyek ini', () => {
    const file = path.join(ROOT, 'scripts', 'dev-reset.mjs');
    assert.ok(existsSync(file), 'scripts/dev-reset.mjs harus ada');
    const source = readFileSync(file, 'utf8');
    assert.match(source, /command\.includes\(projectName\)/);
    assert.match(source, /taskkill/);
    assert.match(source, /BUKAN proses proyek ini/);
    assert.match(source, /process\.exit\(others\.length > 0 \? 1 : 0\)/);
});
test('README menyebut perintah dev:reset sebagai jalan keluar port terpakai', () => {
    const readme = readProject('README.md');
    assert.match(readme, /npm run dev:reset/);
    assert.match(readme, /EADDRINUSE/);
});
