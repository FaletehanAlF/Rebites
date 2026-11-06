/**
 * Test panel chat bisa di-scroll.
 *
 * CACAT YANG DILAPORKAN
 * "ketika saya nanya tidak bisa di scroll halaman chat nya". Setelah balasan
 * cukup panjang, isi panel terpotong dan tidak ada cara menggulirnya.
 *
 * AKARNYA FLEXBOX, BUKAN OVERFLOW
 * Panel memakai `flex-col` dengan tinggi tetap, dan daftar pesan adalah anak
 * `flex-1`. Masalahnya `min-height` bawaan flex item adalah `auto`, yang
 * membuat batas minimumnya = tinggi ISI. Akibatnya daftar tidak pernah benar
 * benar menyusut: ia tumbuh melewati panel, `overflow-y-auto` tidak pernah
 * aktif karena elemennya sendiri setinggi isinya, lalu sisanya dipotong
 * `overflow-hidden` milik panel. Form input ikut terdorong keluar layar.
 *
 * Perbaikannya satu kelas: `min-h-0`. Tanpa itu, `overflow-y-auto` + `flex-1`
 * hanya tampak benar di kode dan tidak berbuat apa-apa di layar.
 *
 * Tes ini membaca sumber karena perilaku itu tidak bisa dibuktikan lewat build:
 * build tetap hijau walau panelnya tidak bisa digulir sama sekali.
 *
 * Jalankan: node --test tests/chatbot-panel-scroll.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Baca berkas sebagai teks berakhiran LF.
 * Di Windows dengan core.autocrlf=true checkout berupa CRLF; pemeriksaan
 * berbasis baris akan gagal pada kode yang benar tanpa penyeragaman ini.
 */
function readProjectFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(
    /\r\n/g,
    '\n'
  );
}

const SOURCE = readProjectFile('app/components/chatbot/chatbot-widget.tsx');

/**
 * Ambil atribut className dari elemen yang memuat penanda tertentu.
 *
 * Bukan sekadar "potong 400 karakter": atribut className pada elemen panel
 * datang SETELAH ref, aria-label, initial, animate, exit, dan transition,
 * sehingga jendela tetap melewatkannya. Fungsi ini mencari `className=` lalu
 * membaca sampai penutup yang seimbang.
 */
function classNamesAround(marker: string): string {
  const index = SOURCE.indexOf(marker);
  assert.ok(index >= 0, `penanda tidak ditemukan di sumber: ${marker}`);

  const attributeStart = SOURCE.indexOf('className=', index);
  assert.ok(attributeStart >= 0, `className tidak ditemukan setelah: ${marker}`);

  // Bentuk `className="..."`.
  //
  // Perhatikan panjang prefiksnya (11 karakter). Potongan yang lebih pendek
  // membuat pemeriksaan ini selalu gagal dan bentuk string jatuh ke cabang
  // `{...}` — yang lalu membaca blok jauh di bawahnya dan menguji kelas yang
  // salah.
  const STRING_PREFIX = 'className="';
  if (SOURCE.startsWith(STRING_PREFIX, attributeStart)) {
    const from = attributeStart + STRING_PREFIX.length;
    const to = SOURCE.indexOf('"', from);
    return SOURCE.slice(from, to);
  }

  // Bentuk `className={cn(...)}` — kurung harus dihitung agar string di dalam
  // cn() yang memuat kurung tidak memotong pembacaan lebih awal.
  const open = SOURCE.indexOf('{', attributeStart);
  assert.ok(open >= 0, `kurung kurawal pembuka tidak ditemukan: ${marker}`);

  let depth = 0;
  for (let i = open; i < SOURCE.length; i += 1) {
    const char = SOURCE[i];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return SOURCE.slice(open, i + 1);
    }
  }

  assert.fail(`kurung kurawal tidak seimbang pada: ${marker}`);
}

test('daftar pesan memakai min-h-0 agar flex-1 benar-benar menyusut', () => {
  const classes = classNamesAround('ref={listRef}');

  assert.match(
    classes,
    /overflow-y-auto/,
    'daftar pesan harus bisa digulir vertikal'
  );
  assert.match(
    classes,
    /\bmin-h-0\b/,
    'TANPA min-h-0 daftar pesan tumbuh melewati panel dan tidak bisa digulir'
  );
});

test('daftar pesan menahan guliran agar tidak merembet ke halaman di belakang', () => {
  const classes = classNamesAround('ref={listRef}');
  assert.match(
    classes,
    /overscroll-contain/,
    'guliran di dalam panel tidak boleh ikut menggulir halaman di belakangnya'
  );
});

test('panel tetap kolom flex dengan tinggi terbatas dan isi terpotong', () => {
  const classes = classNamesAround('role="dialog"');

  assert.match(classes, /flex-col/, 'panel harus kolom flex');
  assert.match(classes, /overflow-hidden/, 'panel harus memotong isi yang keluar');
  assert.match(classes, /h-\[70vh\]/, 'panel harus punya tinggi terbatas');
  assert.match(classes, /max-h-\[560px\]/, 'tinggi maksimum menjaga panel tidak terlalu tinggi');
});

test('form input berada di luar area gulir sehingga selalu terlihat', () => {
  // Bila form ikut masuk ke dalam wadah bergulir, ia bisa terdorong keluar
  // layar saat percakapan panjang — pengguna kehilangan cara mengirim pesan.
  const listStart = SOURCE.indexOf('ref={listRef}');
  const formStart = SOURCE.indexOf('<form');
  assert.ok(listStart >= 0 && formStart >= 0);
  assert.ok(formStart > listStart, 'form harus dirender setelah daftar pesan');

  const between = SOURCE.slice(listStart, formStart);
  // Daftar ditutup sebelum form dimulai (form bukan anak dari div daftar).
  assert.match(
    between,
    /<\/div>\s*\n\s*\{error &&/,
    'daftar pesan harus ditutup sebelum blok error dan form dimulai'
  );
});
