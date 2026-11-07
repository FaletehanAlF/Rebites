import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildSystemPrompt } from '../lib/chatbot/knowledge.ts';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_PATH = path.resolve(HERE, '..', 'lib', 'chatbot', 'tools.ts');
const TOOLS_SRC = readFileSync(TOOLS_PATH, 'utf8').replace(/\r\n/g, '\n');
const PROPOSAL_PREFIX = 'ajukan_';
function definedToolNames(): string[] {
    const names: string[] = [];
    for (const match of TOOLS_SRC.matchAll(/name: '([a-z][a-z0-9_]*)'/g)) {
        names.push(match[1]);
    }
    return names;
}
function handledToolNames(): Set<string> {
    const start = TOOLS_SRC.indexOf('export async function runReadTool');
    assert.ok(start >= 0, 'runReadTool tidak ditemukan di tools.ts');
    const body = TOOLS_SRC.slice(start);
    const end = body.indexOf('export function buildProposal');
    assert.ok(end > 0, 'buildProposal tidak ditemukan di tools.ts');
    const scope = body.slice(0, end);
    const names = new Set<string>();
    for (const match of scope.matchAll(/case '([a-z][a-z0-9_]*)':/g)) {
        names.add(match[1]);
    }
    return names;
}
test('tidak ada nama tool duplikat', () => {
    const names = definedToolNames();
    const seen = new Set<string>();
    for (const name of names) {
        assert.ok(!seen.has(name), `tool "${name}" didefinisikan lebih dari sekali`);
        seen.add(name);
    }
    assert.ok(names.length > 0, 'harus ada tool yang terdefinisi');
});
test('setiap tool BACA punya penanganan di runReadTool', () => {
    const handled = handledToolNames();
    const readTools = definedToolNames().filter((name) => !name.startsWith(PROPOSAL_PREFIX));
    assert.ok(readTools.length >= 20, `tool baca terlalu sedikit: ${readTools.length}`);
    for (const name of readTools) {
        assert.ok(handled.has(name), `tool baca "${name}" terdefinisi tetapi tidak ada case penanganannya — model dapat memanggilnya dan menerima "tidak dikenal"`);
    }
});
test('tool aksi tidak pernah punya handler eksekusi di tools.ts', () => {
    const handled = handledToolNames();
    for (const name of definedToolNames().filter((n) => n.startsWith(PROPOSAL_PREFIX))) {
        assert.ok(!handled.has(name), `tool aksi "${name}" tidak boleh dieksekusi langsung; harus lewat konfirmasi admin`);
    }
});
test('setiap tool baca disebut di system prompt admin', () => {
    const prompt = buildSystemPrompt('admin');
    for (const name of definedToolNames().filter((n) => !n.startsWith(PROPOSAL_PREFIX))) {
        assert.match(prompt, new RegExp(`\\b${name}\\b`), `tool "${name}" ada tetapi tidak disebut di prompt admin — model tidak akan tahu ia bisa memakainya`);
    }
});
test('prompt admin menyebut daftar_aktivitas (bug yang dilaporkan)', () => {
    const prompt = buildSystemPrompt('admin');
    assert.match(prompt, /\bdaftar_aktivitas\b/);
    assert.match(prompt, /aktivitas terbaru|aktivitas/i, 'harus menjelaskan bahwa tool ini menjawab pertanyaan aktivitas');
    assert.match(prompt, /Jangan pernah mengatakan tidak memiliki akses/i, 'prompt harus melarang model mengaku tidak punya akses sebelum mencoba tool');
});
test('profil non-admin tidak menyebut satu pun nama tool', () => {
    const readTools = definedToolNames().filter((n) => !n.startsWith(PROPOSAL_PREFIX));
    for (const profile of ['publik', 'anggota'] as const) {
        const prompt = buildSystemPrompt(profile);
        for (const name of readTools) {
            assert.ok(!prompt.includes(name), `prompt ${profile} tidak boleh menyebut tool "${name}" yang tidak dimilikinya`);
        }
    }
});
test('profil anggota dibatasi dari panel admin dan angka situs', () => {
    const prompt = buildSystemPrompt('anggota');
    assert.match(prompt, /BATAS AKSES PROFIL INI/, 'harus ada bagian batas akses');
    assert.ok(!prompt.includes('/dashboard/admin'), 'prompt anggota tidak boleh membocorkan path panel admin');
    assert.match(prompt, /data pengguna lain/i, 'harus melarang menyebut data pengguna lain');
    assert.match(prompt, /mengaku admin/i, 'harus mengatur jawaban bila penanya mengaku admin');
});
test('prompt admin tetap memuat seluruh kelompok halaman (lebih lengkap dari user)', () => {
    const prompt = buildSystemPrompt('admin');
    assert.match(prompt, /HALAMAN PUBLIK/);
    assert.match(prompt, /HALAMAN ADMIN/);
    assert.match(prompt, /HALAMAN PEMBELI/);
    assert.match(prompt, /HALAMAN PENJUAL/);
    assert.match(prompt, /\/auth\/login/);
    assert.match(prompt, /\/dashboard\/admin\/moderasi/);
    assert.match(prompt, /\/riwayatPesanan/);
    assert.match(prompt, /\/dashboard\/penjual\/menu/);
});
test('prompt admin memuat aturan privasi data', () => {
    const prompt = buildSystemPrompt('admin');
    assert.match(prompt, /PRIVASI DATA/);
    assert.match(prompt, /tersamarkan/i, 'harus menjelaskan email disamarkan');
    assert.match(prompt, /nomor telepon/i, 'harus melarang menampilkan nomor telepon');
});
test('alat baca menyamarkan data pribadi sebelum dikirim ke model', () => {
    assert.match(TOOLS_SRC, /export function maskAddress\(/, 'maskAddress harus ada');
    const orderDetail = TOOLS_SRC.match(/\.from\('orders'\)\s*\.select\(\s*'([^']*delivery_address[^']*)'/);
    assert.ok(orderDetail, 'select detail_pesanan tidak ditemukan');
    assert.ok(!orderDetail[1].includes('buyer_id'), 'buyer_id tidak boleh diambil: UUID pembeli tidak menjawab pertanyaan operasional dan menambah permukaan kebocoran');
    assert.match(TOOLS_SRC, /delivery_address: maskAddress\(/, 'alamat pesanan wajib disamarkan sebelum dikembalikan ke model');
    assert.match(TOOLS_SRC, /'id, business_name, description, category, address, city, is_verified, is_active, is_open, open_hours, rating, slug, created_at'/);
    assert.match(TOOLS_SRC, /email: maskEmail\(/, 'email pengguna wajib disamarkan');
});
