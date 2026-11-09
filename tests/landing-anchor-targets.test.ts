import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildSystemPrompt } from '../lib/chatbot/knowledge.ts';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', 'app');
function readApp(relative: string): string {
    return readFileSync(path.join(APP, relative), 'utf8');
}
test('setiap anchor /tentang-kami#... di navbar punya target di halaman', () => {
    const navbar = readApp('components/landing/LandingNavbar.tsx');
    const about = readApp('(landing)/tentang-kami/page.tsx');
    const anchors = [...navbar.matchAll(/\/tentang-kami#([a-z0-9-]+)/g)].map((match) => match[1]);
    assert.ok(anchors.length >= 2, `navbar harus menautkan minimal dua anchor, ditemukan ${anchors.length}`);
    for (const anchor of anchors) {
        assert.ok(about.includes(`id="${anchor}"`), `anchor #${anchor} tidak punya target id di halaman tentang-kami`);
    }
});
test('TeamLanyardRail meneruskan id ke elemen section', () => {
    const rail = readApp('components/landing/team-lanyard-rail.tsx');
    assert.match(rail, /<section/);
    assert.match(rail, /\{\.\.\.rest\}/);
});
test('fakta navigasi bawah pada prompt cocok dengan MobileBottomNav', () => {
    const nav = readApp('components/shared/MobileBottomNav.tsx');
    const labels = [...nav.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(labels, ['Beranda', 'Pesanan', 'Profil']);
    const prompt = buildSystemPrompt('anggota');
    assert.match(prompt, /Navigasi bawah pada ponsel berisi Beranda, Pesanan, dan Profil\./);
});
test('knowledge tidak menunjuk seksi profil yang tidak ada', () => {
    const knowledge = readFileSync(path.resolve(HERE, '..', 'lib', 'chatbot', 'knowledge.ts'), 'utf8');
    assert.ok(!knowledge.includes('sukai-makanan'), 'anchor #sukai-makanan tidak punya target di halaman profil');
    const profile = readApp('components/shared/user-profile.tsx');
    for (const id of ['dampak', 'riwayat', 'toko-diikuti', 'rebites-coin', 'alamat']) {
        assert.ok(profile.includes(`id="${id}"`), `seksi #${id} hilang dari halaman profil`);
    }
});
test('ikon aplikasi disajikan dari app/icon.svg', () => {
    const icon = path.join(APP, 'icon.svg');
    assert.ok(existsSync(icon), 'app/icon.svg harus ada agar /favicon.ico tidak 404');
    const svg = readFileSync(icon, 'utf8');
    assert.match(svg, /<svg[^>]*viewBox/);
    assert.match(svg, /<rect/);
});
