/**
 * Test pengurai Markdown panel chat (lib/chatbot/markdown-parse.ts).
 *
 * MENGAPA TES INI ADA
 * Cacat yang dilaporkan dari screenshot: balasan asisten menampilkan
 * `**Riwayat Pesanan**` dengan asterisk mentah. Perbaikannya tidak bisa
 * dibuktikan lewat screenshot saja, karena model kadang menjawab tanpa
 * Markdown sama sekali — sehingga tampilan "bersih" bisa berarti perbaikan
 * berhasil ATAU model kebetulan tidak memakai penanda.
 *
 * Tes ini memutuskan pertanyaan itu secara langsung: diberi teks yang
 * mengandung `**tebal**` dan `` `kode` ``, apakah penandanya dikenali?
 *
 * Jalankan: node --test tests/chatbot-markdown.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasMarkdown,
  parseInline,
  splitBlocks,
  stripDanglingMarkers,
} from '../lib/chatbot/markdown-parse.ts';

test('**tebal** dikenali sebagai segmen bold, bukan teks mentah', () => {
  const segments = parseInline('Buka menu **Riwayat Pesanan** sekarang.');

  assert.equal(segments.length, 3, 'harus terpecah menjadi teks-tebal-teks');
  assert.deepEqual(segments[0], { kind: 'text', text: 'Buka menu ' });
  assert.deepEqual(segments[1], { kind: 'bold', text: 'Riwayat Pesanan' });
  assert.deepEqual(segments[2], { kind: 'text', text: ' sekarang.' });

  // Inti cacatnya: asterisk tidak boleh tersisa pada teks mana pun.
  for (const segment of segments) {
    assert.ok(
      !segment.text.includes('**'),
      `asterisk mentah tersisa pada segmen: ${JSON.stringify(segment.text)}`
    );
  }
});

test('`kode` dikenali sebagai segmen code tanpa backtick', () => {
  const segments = parseInline('Buka di `/riwayatPesanan` ya.');

  assert.equal(segments.length, 3);
  assert.deepEqual(segments[1], { kind: 'code', text: '/riwayatPesanan' });

  for (const segment of segments) {
    assert.ok(
      !segment.text.includes('`'),
      `backtick mentah tersisa pada segmen: ${JSON.stringify(segment.text)}`
    );
  }
});

test('tebal dan kode dalam satu baris diproses berurutan', () => {
  const segments = parseInline('**Pesanan** ada di `/riwayatPesanan`.');
  const kinds = segments.map((s) => s.kind);

  assert.deepEqual(kinds, ['bold', 'text', 'code', 'text']);
  assert.equal(segments[0].text, 'Pesanan');
  assert.equal(segments[2].text, '/riwayatPesanan');
});

test('asterisk di dalam kode tidak dianggap penanda tebal', () => {
  const segments = parseInline('Pakai `a**b` sebagai contoh.');
  const code = segments.find((s) => s.kind === 'code');

  assert.ok(code, 'harus ada segmen code');
  assert.equal(code.text, 'a**b', 'isi kode dipertahankan apa adanya');
  assert.equal(
    segments.filter((s) => s.kind === 'bold').length,
    0,
    'tidak boleh ada segmen bold dari asterisk di dalam kode'
  );
});

test('teks tanpa penanda tetap satu segmen utuh', () => {
  const segments = parseInline('ReBites menjual makanan surplus.');
  assert.deepEqual(segments, [
    { kind: 'text', text: 'ReBites menjual makanan surplus.' },
  ]);
});

test('penanda tak berpasangan tidak memecah teks secara keliru', () => {
  // Model kadang terpotong; satu `**` liar tidak boleh menghasilkan segmen bold.
  const segments = parseInline('Harga ** belum ditentukan.');
  assert.equal(segments.filter((s) => s.kind === 'bold').length, 0);

  const cleaned = stripDanglingMarkers('Harga ** belum ditentukan.');
  assert.ok(!cleaned.includes('**'), 'penanda liar harus dibuang');
  assert.match(cleaned, /Harga\s+belum ditentukan/, 'kata tetap utuh');
});

test('daftar berbutir dikenali sebagai blok bullet', () => {
  const blocks = splitBlocks('- Buka Beranda\n- Pilih Pesanan');
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0], { kind: 'bullet', text: 'Buka Beranda' });
  assert.deepEqual(blocks[1], { kind: 'bullet', text: 'Pilih Pesanan' });
});

test('bullet menerima -, *, dan •', () => {
  for (const marker of ['-', '*', '•']) {
    const blocks = splitBlocks(`${marker} satu`);
    assert.equal(blocks[0].kind, 'bullet', `penanda "${marker}" harus dikenali`);
    assert.equal(blocks[0].text, 'satu');
  }
});

test('baris kosong menjadi blok spacer, paragraf tetap paragraf', () => {
  const blocks = splitBlocks('Paragraf satu.\n\nParagraf dua.');
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ['paragraph', 'spacer', 'paragraph']
  );
});

test('hasMarkdown mendeteksi penanda yang dikenali saja', () => {
  assert.equal(hasMarkdown('**tebal**'), true);
  assert.equal(hasMarkdown('`kode`'), true);
  assert.equal(hasMarkdown('teks biasa tanpa penanda'), false);
  assert.equal(hasMarkdown('harga Rp 25.000'), false);
});

test('teks kosong tidak menghasilkan blok yang merusak panel', () => {
  assert.deepEqual(splitBlocks(''), []);
  assert.deepEqual(parseInline(''), []);
});
