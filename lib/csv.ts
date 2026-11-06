/**
 * Pembuat CSV murni untuk ekspor admin.
 *
 * Aturan yang dijaga:
 * - Semua sel dikutip, sehingga koma, kutip ganda, dan newline aman.
 * - Sel teks yang diawali karakter kontrol atau whitespace lalu formula
 *   Excel (`= + - @`) diberi apostrof agar tidak dieksekusi sebagai formula
 *   saat dibuka di spreadsheet. Karakter kontrol C0/DEL di awal juga
 *   dilindungi agar tidak dipakai menyamarkan formula.
 * - Angka tetap dikirim sebagai angka (termasuk negatif) tanpa apostrof.
 * - Dokumen memakai BOM UTF-8 + CRLF agar karakter Indonesia tampil benar di
 *   Excel dan format baris konsisten.
 */

export type CsvCell = string | number | boolean | null | undefined;

export const CSV_BOM = '\uFEFF';
export const CSV_LINE_END = '\r\n';

const LEADING_CONTROL = /^[\u0000-\u001F\u007F]/;
const FORMULA_AFTER_PADDING = /^[\s\u0000-\u001F\u007F]*[=+\-@]/;

/** Cegah formula injection tanpa merusak angka negatif yang bertipe number. */
export function protectCsvFormula(value: string): string {
  if (LEADING_CONTROL.test(value) || FORMULA_AFTER_PADDING.test(value)) {
    return `'${value}`;
  }
  return value;
}

/** True hanya untuk respons CSV; mencegah HTML/JSON galat diunduh sebagai .csv. */
export function isCsvContentType(value: string | null): boolean {
  if (!value) return false;
  return value.split(';', 1)[0]?.trim().toLowerCase() === 'text/csv';
}

/** True hanya untuk respons Excel .xlsx. */
export function isXlsxContentType(value: string | null): boolean {
  if (!value) return false;
  return (
    value.split(';', 1)[0]?.trim().toLowerCase() ===
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `"${value}"` : '""';
  }
  if (typeof value === 'boolean') return `"${value}"`;
  const safe = protectCsvFormula(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Bangun dokumen CSV lengkap (header + baris), termasuk BOM dan CRLF. */
export function createCsvDocument(
  headers: readonly string[],
  rows: readonly (readonly CsvCell[])[]
): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return `${CSV_BOM}${lines.join(CSV_LINE_END)}${CSV_LINE_END}`;
}
