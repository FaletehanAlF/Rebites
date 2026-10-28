/**
 * Sanitasi istilah pencarian untuk filter PostgREST — modul MURNI (tanpa
 * dependensi) sehingga dapat diuji langsung dengan `node --test`, seperti
 * `lib/admin-access.ts`.
 *
 * MENGAPA INI PERLU (kelas risiko yang tepat: BUKAN SQL injection):
 * `postgrest-js` tidak meng-escape argumen `.or()`. Implementasinya hanya:
 *
 *     or(filters) { this.url.searchParams.append('or', `(${filters})`); }
 *
 * Artinya seluruh string filter disusun dengan interpolasi, dan karakter
 * struktur PostgREST di dalam nilai pengguna akan terbaca sebagai STRUKTUR,
 * bukan sebagai teks yang dicari:
 *
 *   - `,`  memisahkan kondisi di dalam `or=(a,b)` → pengguna bisa menambah
 *          kondisi filter sendiri (mis. menyempitkan/meluaskan hasil).
 *   - `(` `)`  membuka grup bersarang dan dipakai bentuk `in.(...)`.
 *   - `%`  wildcard `ilike`; dibuang agar hasil pencarian literal dan tidak
 *          bisa dipakai menyusun pola pencarian yang tidak dimaksudkan.
 *
 * Nilai yang lolos tetap dieksekusi di bawah otorisasi RLS milik pemanggil,
 * jadi ini bukan SQL injection dan tidak memberi akses lintas pengguna. Yang
 * dicegah adalah MANIPULASI SINTAKS FILTER: input pengguna tidak boleh
 * mengubah bentuk query yang dibangun route.
 *
 * Tidak ada escaping "pintar" di sini — hanya penghapusan karakter struktur.
 * Pendekatan escaping kutip/ganti-nama operator akan bergantung pada detail
 * parser PostgREST yang tidak dijanjikan stabil oleh library; membuang
 * karakter struktur jauh lebih sulit salah.
 *
 * DUA MODE — dipilih agar perilaku tiap route TIDAK berubah saat helper
 * bersama ini diperkenalkan:
 *
 * - `sanitizeSearchTerm` (bawaan) MENGHAPUS karakter struktur. Ini perilaku
 *   asli enam route admin (`trim().slice(0,100).replace(/[%(),]/g,'')`).
 * - `sanitizeSearchTermKeepingWords` MENGGANTI karakter struktur dengan
 *   spasi. Ini perilaku asli route produk (`replace(/[%(),]/g,' ').trim()`),
 *   yang sengaja mempertahankan batas kata: "kopi,susu" tetap dicari sebagai
 *   dua kata, bukan digabung menjadi "kopisusu".
 */

/** Karakter yang mengubah struktur string filter PostgREST bila tidak dibuang. */
const STRUCTURAL_CHARS = /[%(),]/g;

/**
 * Buang karakter struktur dari istilah pencarian.
 *
 * Urutan operasi mengikuti implementasi asli route: `trim()` DULU, lalu
 * potong panjang, baru sanitasi. Membalik urutan itu mengubah hasil untuk
 * masukan berawalan spasi panjang (trim setelah potong membuang karakter
 * yang seharusnya masih tersisa).
 *
 * @param raw Nilai mentah dari query string (boleh null).
 * @param maxLength Batas panjang; default 100 seperti route aslinya.
 * @returns Istilah tanpa karakter struktur, atau '' bila tidak ada sisa.
 */
export function sanitizeSearchTerm(raw: string | null | undefined, maxLength = 100): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .slice(0, Math.max(0, maxLength))
    .replace(STRUCTURAL_CHARS, '');
}

/**
 * Sama seperti `sanitizeSearchTerm`, tetapi karakter struktur diganti spasi
 * sehingga batas kata tetap utuh. Dipakai route produk agar "kopi,susu" tetap
 * berarti dua kata, persis seperti perilaku lamanya.
 *
 * `trim()` di akhir membuang spasi yang mungkin muncul di tepi setelah
 * penggantian (mis. ",kopi" → " kopi" → "kopi"), supaya pola `ilike` tidak
 * membawa spasi liar di ujung.
 */
export function sanitizeSearchTermKeepingWords(
  raw: string | null | undefined,
  maxLength = 100
): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .slice(0, Math.max(0, maxLength))
    .replace(STRUCTURAL_CHARS, ' ')
    .trim();
}

/**
 * true bila istilah sudah bebas karakter struktur — dipakai tes dan sebagai
 * jaring pengaman agar regresi tidak lolos diam-diam.
 */
export function isStructuralSafe(term: string): boolean {
  return !/[%(),]/.test(term);
}
