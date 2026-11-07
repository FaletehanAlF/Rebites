import { NextResponse } from 'next/server';
import { buildXlsx, type XlsxSheet } from '@/lib/xlsx';
export interface AdminExportResponseOptions {
    filename: string;
    sheet: XlsxSheet;
}
export function buildAdminExportResponse({ filename, sheet, }: AdminExportResponseOptions): NextResponse {
    if (sheet.rows.length === 0) {
        return new NextResponse(null, {
            status: 204,
            headers: { 'Cache-Control': 'no-store' },
        });
    }
    const workbook = buildXlsx(sheet);
    return new NextResponse(new Uint8Array(workbook), {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Export-Row-Count': String(sheet.rows.length),
        },
    });
}
