/**
 * Validator path internal (redirect / next) — modul murni & mudah diuji.
 *
 * Latar belakang keamanan (open redirect):
 * - `//evil.com` adalah URL protocol-relative → keluar dari origin.
 * - Browser memperlakukan backslash seperti slash pada URL special scheme,
 *   sehingga `/\evil.com` juga menjadi `//evil.com` → open redirect.
 * - Parser URL MENGHAPUS karakter tab/newline dari input, sehingga
 *   `/<tab>/evil.com` menjadi `//evil.com` → open redirect.
 * - Varian terenkode dari dua pola di atas (`/%5C...`, `/%2F...` di awal)
 *   ditolak sebagai pencegahan berlapis bila nilai diproses ulang
 *   (double decode) oleh konsumen lain.
 *
 * Fungsi ini HANYA menerima path internal absolut yang diawali tepat satu '/'.
 */

/** C0 control + DEL (termasuk tab/newline yang dihapus parser URL). */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function isSafeInternalPath(path: string | null | undefined): path is string {
  if (typeof path !== 'string' || path.length === 0) return false;
  // Harus absolut terhadap origin: diawali '/'...
  if (path[0] !== '/') return false;
  // ...tetapi bukan protocol-relative ('//') .
  if (path.startsWith('//')) return false;
  // Backslash mentah di mana pun (browser menganggapnya '/').
  if (path.includes('\\')) return false;
  // Karakter kontrol (tab/newline dihapus parser; sisanya berbahaya/tak wajar).
  if (CONTROL_CHARS.test(path)) return false;
  // Varian terenkode: backslash terenkode ('%5c') ditolak di mana pun
  // (konsisten dengan backslash mentah), dan '/' terenkode di awal path
  // ('/%2f...') ditolak karena setara dengan protocol-relative '//'.
  const lower = path.toLowerCase();
  if (lower.includes('%5c')) return false;
  if (lower.startsWith('/%2f')) return false;
  return true;
}
