import { deflateRawSync } from 'node:zlib';
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
export function escapeXml(value: string): string {
    return value
        .replace(XML_INVALID, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
export function columnLetter(index: number): string {
    let n = index;
    let letters = '';
    while (n >= 0) {
        letters = String.fromCharCode((n % 26) + 65) + letters;
        n = Math.floor(n / 26) - 1;
    }
    return letters;
}
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
        let c = i;
        for (let k = 0; k < 8; k += 1) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c >>> 0;
    }
    return table;
})();
export function crc32(buffer: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i += 1) {
        crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
interface ZipEntry {
    name: string;
    data: Buffer;
}
export function buildZip(entries: readonly ZipEntry[]): Buffer {
    const chunks: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;
    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8');
        const crc = crc32(entry.data);
        const compressed = deflateRawSync(entry.data, { level: 6 });
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 6);
        local.writeUInt16LE(8, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0x21, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(entry.data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        chunks.push(local, name, compressed);
        const dir = Buffer.alloc(46);
        dir.writeUInt32LE(0x02014b50, 0);
        dir.writeUInt16LE(20, 4);
        dir.writeUInt16LE(20, 6);
        dir.writeUInt16LE(0, 8);
        dir.writeUInt16LE(8, 10);
        dir.writeUInt16LE(0, 12);
        dir.writeUInt16LE(0x21, 14);
        dir.writeUInt32LE(crc, 16);
        dir.writeUInt32LE(compressed.length, 20);
        dir.writeUInt32LE(entry.data.length, 24);
        dir.writeUInt16LE(name.length, 28);
        dir.writeUInt16LE(0, 30);
        dir.writeUInt16LE(0, 32);
        dir.writeUInt16LE(0, 34);
        dir.writeUInt16LE(0, 36);
        dir.writeUInt32LE(0, 38);
        dir.writeUInt32LE(offset, 42);
        central.push(dir, name);
        offset += local.length + name.length + compressed.length;
    }
    const centralBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);
    return Buffer.concat([...chunks, centralBuf, end]);
}
export interface XlsxColumn {
    header: string;
    width: number;
    wrap?: boolean;
}
export interface XlsxSheet {
    name: string;
    columns: readonly XlsxColumn[];
    rows: readonly (readonly (string | number | null | undefined)[])[];
}
function contentTypesXml(sheetCount: number): string {
    const sheets = Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>

<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">

<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>

<Default Extension="xml" ContentType="application/xml"/>

<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>

${sheets}

<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>

</Types>`;
}
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>

<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">

<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>

</Relationships>`;
function workbookRelsXml(sheetCount: number): string {
    const sheets = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>

<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">

${sheets}

<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>

</Relationships>`;
}
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>

<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">

<fonts count="2">

<font><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/></font>

<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>

</fonts>

<fills count="3">

<fill><patternFill patternType="none"/></fill>

<fill><patternFill patternType="gray125"/></fill>

<fill><patternFill patternType="solid"><fgColor rgb="FF25603A"/><bgColor indexed="64"/></patternFill></fill>

</fills>

<borders count="2">

<border><left/><right/><top/><bottom/><diagonal/></border>

<border><left/><right/><top/><bottom style="thin"><color rgb="FFD6D3D1"/></bottom><diagonal/></border>

</borders>

<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>

<cellXfs count="3">

<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>

<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>

<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>

</cellXfs>

<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>

</styleSheet>`;
function buildSheetXml(sheet: XlsxSheet): string {
    const lastCol = columnLetter(Math.max(sheet.columns.length - 1, 0));
    const lastRow = sheet.rows.length + 1;
    const dimension = `A1:${lastCol}${lastRow}`;
    const cols = sheet.columns
        .map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`)
        .join('');
    const headerCells = sheet.columns
        .map((column, index) => `<c r="${columnLetter(index)}1" s="1" t="inlineStr"><is><t>${escapeXml(column.header)}</t></is></c>`)
        .join('');
    const headerRow = `<row r="1" ht="30" customHeight="1">${headerCells}</row>`;
    const bodyRows = sheet.rows
        .map((row, rowIndex) => {
        const r = rowIndex + 2;
        const cells = sheet.columns
            .map((column, colIndex) => {
            const raw = row[colIndex];
            const ref = `${columnLetter(colIndex)}${r}`;
            const style = column.wrap ? 0 : 2;
            if (raw === null || raw === undefined || raw === '') {
                return `<c r="${ref}" s="${style}"/>`;
            }
            if (typeof raw === 'number' && Number.isFinite(raw)) {
                return `<c r="${ref}" s="${style}"><v>${raw}</v></c>`;
            }
            return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(raw))}</t></is></c>`;
        })
            .join('');
        return `<row r="${r}">${cells}</row>`;
    })
        .join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>

<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">

<dimension ref="${dimension}"/>

<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>

<sheetFormatPr defaultRowHeight="15"/>

<cols>${cols}</cols>

<sheetData>${headerRow}${bodyRows}</sheetData>

<autoFilter ref="A1:${lastCol}${lastRow}"/>

</worksheet>`;
}
export interface XlsxWorkbook {
    sheets: readonly XlsxSheet[];
}
export function buildXlsxWorkbook(workbook: XlsxWorkbook): Buffer {
    const sheets = workbook.sheets;
    if (sheets.length === 0) {
        throw new Error('Workbook perlu minimal satu sheet.');
    }
    const names = new Set<string>();
    for (const sheet of sheets) {
        const key = sheet.name.toLowerCase();
        if (names.has(key)) {
            throw new Error(`Nama sheet "${sheet.name}" dipakai lebih dari sekali.`);
        }
        names.add(key);
    }
    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>

<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">

<sheets>${sheets
        .map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
        .join('')}</sheets>

</workbook>`;
    return buildZip([
        {
            name: '[Content_Types].xml',
            data: Buffer.from(contentTypesXml(sheets.length), 'utf8'),
        },
        { name: '_rels/.rels', data: Buffer.from(ROOT_RELS, 'utf8') },
        { name: 'xl/workbook.xml', data: Buffer.from(workbookXml, 'utf8') },
        {
            name: 'xl/_rels/workbook.xml.rels',
            data: Buffer.from(workbookRelsXml(sheets.length), 'utf8'),
        },
        { name: 'xl/styles.xml', data: Buffer.from(STYLES, 'utf8') },
        ...sheets.map((sheet, index) => ({
            name: `xl/worksheets/sheet${index + 1}.xml`,
            data: Buffer.from(buildSheetXml(sheet), 'utf8'),
        })),
    ]);
}
export function buildXlsx(sheet: XlsxSheet): Buffer {
    return buildXlsxWorkbook({ sheets: [sheet] });
}
