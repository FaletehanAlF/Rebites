/**
 * Pengurai Markdown mini untuk balasan asisten.
 *
 * Modul MURNI (tanpa JSX, tanpa impor runtime) supaya dapat diuji langsung
 * dengan `node --test`. Logikanya dipisah dari komponen karena komponen `.tsx`
 * tidak dapat dimuat Node tanpa kompilasi JSX — dan justru logika inilah yang
 * harus dibuktikan: apakah `**tebal**` dan `` `kode` `` benar-benar dikenali,
 * bukan ikut tampil sebagai karakter mentah.
 *
 * Cakupan sengaja sempit: tebal, kode sebaris, dan daftar berbutir. Itu saja
 * yang dipakai model saat menjelaskan menu dan path. Markdown penuh akan
 * memerlukan pustaka dan menambah puluhan kilobyte ke panel yang dibuka di
 * setiap halaman.
 */

export type InlineKind = 'text' | 'bold' | 'code';

export interface InlineSegment {
  kind: InlineKind;
  text: string;
}

export type BlockKind = 'paragraph' | 'bullet' | 'spacer';

export interface Block {
  kind: BlockKind;
  /** Untuk `paragraph`, satu baris; untuk `bullet`, isi butirnya. */
  text: string;
}

/**
 * Pecah satu baris menjadi potongan biasa / tebal / kode.
 *
 * Pola `**tebal**` dan `` `kode` `` diproses dalam satu lintasan agar urutan
 * kemunculannya dipertahankan. Kode dicocokkan lebih dulu: asterisk di dalam
 * `` `a**b` `` tidak boleh dianggap penanda tebal.
 */
export function parseInline(line: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', text: line.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith('`')) {
      segments.push({ kind: 'code', text: token.slice(1, -1) });
    } else {
      segments.push({ kind: 'bold', text: token.slice(2, -2) });
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    segments.push({ kind: 'text', text: line.slice(lastIndex) });
  }

  return segments;
}

/**
 * Pecah teks multi-baris menjadi blok paragraf / butir / jarak.
 *
 * Butir berurutan digabung menjadi blok `bullet` terpisah agar dapat dirender
 * sebagai satu `<ul>` — bukan satu `<ul>` per butir.
 */
export function splitBlocks(text: string): Block[] {
  const blocks: Block[] = [];

  // Teks kosong tidak menghasilkan blok apa pun. Tanpa penjagaan ini,
  // ''.split('\n') menghasilkan [''] sehingga tepat satu blok `spacer`
  // terbuat — pesan kosong akan tampak punya jarak 1,5 baris tanpa isi.
  if (!text || !text.trim()) return blocks;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+$/, '');

    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      blocks.push({ kind: 'bullet', text: bullet[1] });
      continue;
    }

    if (!line.trim()) {
      blocks.push({ kind: 'spacer', text: '' });
      continue;
    }

    blocks.push({ kind: 'paragraph', text: line });
  }

  return blocks;
}

/** true bila baris memakai penanda Markdown yang dikenali. */
export function hasMarkdown(text: string): boolean {
  return /\*\*[^*]+\*\*|`[^`]+`/i.test(text ?? '');
}

/**
 * Buang sisa penanda yang tidak berpasangan, mis. `**` tunggal dari model yang
 * terpotong. Tanpa ini, satu asterisk liar tetap terlihat sebagai teks.
 */
export function stripDanglingMarkers(text: string): string {
  return (text ?? '').replace(/\*\*/g, '').replace(/(^|\s)`(\s|$)/g, '$1$2');
}
