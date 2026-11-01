/**
 * Test paritas antara TOOLS yang dimiliki asisten admin dan yang DIJANJIKAN
 * system prompt.
 *
 * MENGAPA TES INI ADA
 * Cacat yang dilaporkan admin: ia bertanya "aktivitas terakhir penjual atau
 * pembeli", dan asisten menjawab "saya tidak punya tool khusus untuk membaca
 * log aktivitas". Jawaban itu JUJUR — tool-nya memang tidak ada. Masalahnya
 * bukan model berbohong, melainkan cakupan tool yang tidak lengkap.
 *
 * Dua arah kesalahan yang sama-sama berbahaya, dan keduanya dijaga di sini:
 *   1. Prompt MENJANJIKAN tool yang tidak ada  -> model berjanji lalu gagal.
 *   2. Tool ADA tetapi tidak disebut di prompt -> model tidak pernah memakainya,
 *      lalu berkata "saya tidak punya akses" (persis bug yang dilaporkan).
 *
 * Berkas ini membaca SUMBER `lib/chatbot/tools.ts` sebagai teks, bukan
 * mengimpornya: modul itu memakai alias `@/...` dan klien Supabase server
 * yang tidak dapat dimuat `node --test`. Yang diuji adalah daftar nama dan
 * penanganannya, dan keduanya terbaca jelas dari teks sumber.
 *
 * Jalankan: node --test tests/chatbot-tools.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildSystemPrompt } from '../lib/chatbot/knowledge.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_PATH = path.resolve(HERE, '..', 'lib', 'chatbot', 'tools.ts');

// Normalisasi CRLF: di Windows dengan core.autocrlf=true isi berkas berbeda
// byte-nya, dan regex berjangkar `$` akan gagal pada kode yang benar.
const TOOLS_SRC = readFileSync(TOOLS_PATH, 'utf8').replace(/\r\n/g, '\n');

/** Tool yang hanya MENGAJUKAN aksi — sengaja tidak punya handler di sini. */
const PROPOSAL_PREFIX = 'ajukan_';

function definedToolNames(): string[] {
  const names: string[] = [];
  for (const match of TOOLS_SRC.matchAll(/name: '([a-z][a-z0-9_]*)'/g)) {
    names.push(match[1]);
  }
  return names;
}

function handledToolNames(): Set<string> {
  // Hanya badan `runReadTool`. `buildProposal` memakai `case 'ajukan_...'`
  // untuk membentuk usulan — itu bukan eksekusi, dan mencampurnya membuat
  // tes menyimpulkan tool aksi punya handler padahal tidak.
  const start = TOOLS_SRC.indexOf('export async function runReadTool');
  assert.ok(start >= 0, 'runReadTool tidak ditemukan di tools.ts');
  const body = TOOLS_SRC.slice(start);
  const end = body.indexOf('\n// ---------------------------------------------------------------------------\n// Bentuk usulan aksi');
  const scope = end > 0 ? body.slice(0, end) : body;

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
    assert.ok(
      handled.has(name),
      `tool baca "${name}" terdefinisi tetapi tidak ada case penanganannya — model dapat memanggilnya dan menerima "tidak dikenal"`
    );
  }
});

test('tool aksi tidak pernah punya handler eksekusi di tools.ts', () => {
  const handled = handledToolNames();
  for (const name of definedToolNames().filter((n) => n.startsWith(PROPOSAL_PREFIX))) {
    assert.ok(
      !handled.has(name),
      `tool aksi "${name}" tidak boleh dieksekusi langsung; harus lewat konfirmasi admin`
    );
  }
});

test('setiap tool baca disebut di system prompt admin', () => {
  const prompt = buildSystemPrompt('admin');
  for (const name of definedToolNames().filter((n) => !n.startsWith(PROPOSAL_PREFIX))) {
    assert.match(
      prompt,
      new RegExp(`\\b${name}\\b`),
      `tool "${name}" ada tetapi tidak disebut di prompt admin — model tidak akan tahu ia bisa memakainya`
    );
  }
});

test('prompt admin menyebut daftar_aktivitas (bug yang dilaporkan)', () => {
  const prompt = buildSystemPrompt('admin');
  assert.match(prompt, /\bdaftar_aktivitas\b/);
  assert.match(
    prompt,
    /aktivitas terbaru|aktivitas/i,
    'harus menjelaskan bahwa tool ini menjawab pertanyaan aktivitas'
  );
  assert.match(
    prompt,
    /Jangan pernah mengatakan tidak memiliki akses/i,
    'prompt harus melarang model mengaku tidak punya akses sebelum mencoba tool'
  );
});

test('profil non-admin tidak menyebut satu pun nama tool', () => {
  const readTools = definedToolNames().filter((n) => !n.startsWith(PROPOSAL_PREFIX));
  for (const profile of ['publik', 'anggota'] as const) {
    const prompt = buildSystemPrompt(profile);
    for (const name of readTools) {
      assert.ok(
        !prompt.includes(name),
        `prompt ${profile} tidak boleh menyebut tool "${name}" yang tidak dimilikinya`
      );
    }
  }
});

test('profil anggota dibatasi dari panel admin dan angka situs', () => {
  const prompt = buildSystemPrompt('anggota');

  assert.match(prompt, /BATAS AKSES PROFIL INI/, 'harus ada bagian batas akses');
  assert.ok(
    !prompt.includes('/dashboard/admin'),
    'prompt anggota tidak boleh membocorkan path panel admin'
  );
  assert.match(prompt, /data pengguna lain/i, 'harus melarang menyebut data pengguna lain');
  assert.match(prompt, /mengaku admin/i, 'harus mengatur jawaban bila penanya mengaku admin');
});

test('prompt admin tetap memuat seluruh kelompok halaman (lebih lengkap dari user)', () => {
  const prompt = buildSystemPrompt('admin');
  // Admin harus tahu lebih banyak: halaman publik, pembeli, penjual, dan admin.
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
