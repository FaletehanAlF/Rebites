export type CsvCell = string | number | boolean | null | undefined;
export const CSV_BOM = '\uFEFF';
export const CSV_LINE_END = '\r\n';
const LEADING_CONTROL = /^[\u0000-\u001F\u007F]/;
const FORMULA_AFTER_PADDING = /^[\s\u0000-\u001F\u007F]*[=+\-@]/;
export function protectCsvFormula(value: string): string {
    if (LEADING_CONTROL.test(value) || FORMULA_AFTER_PADDING.test(value)) {
        return `'${value}`;
    }
    return value;
}
export function isCsvContentType(value: string | null): boolean {
    if (!value)
        return false;
    return value.split(';', 1)[0]?.trim().toLowerCase() === 'text/csv';
}
export function isXlsxContentType(value: string | null): boolean {
    if (!value)
        return false;
    return (value.split(';', 1)[0]?.trim().toLowerCase() ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
export function contentDispositionFilename(header: string | null): string | null {
    if (!header)
        return null;
    const quoted = /filename="([^"]+)"/i.exec(header);
    if (quoted?.[1])
        return quoted[1];
    const plain = /filename=([^;]+)/i.exec(header);
    return plain?.[1]?.trim() || null;
}
export function escapeCsvCell(value: CsvCell): string {
    if (value === null || value === undefined)
        return '""';
    if (typeof value === 'number') {
        return Number.isFinite(value) ? `"${value}"` : '""';
    }
    if (typeof value === 'boolean')
        return `"${value}"`;
    const safe = protectCsvFormula(value);
    return `"${safe.replace(/"/g, '""')}"`;
}
export function createCsvDocument(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
    const lines = [
        headers.map(escapeCsvCell).join(','),
        ...rows.map((row) => row.map(escapeCsvCell).join(',')),
    ];
    return `${CSV_BOM}${lines.join(CSV_LINE_END)}${CSV_LINE_END}`;
}
