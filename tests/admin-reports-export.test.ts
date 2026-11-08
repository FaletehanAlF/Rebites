import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyReportFiltersToQuery, buildReportFilterSearchParams, parseReportFilters, reportExportDate, } from '../lib/report-filters.ts';
import { contentDispositionFilename, createCsvDocument, escapeCsvCell, isCsvContentType, protectCsvFormula, } from '../lib/csv.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}
function parse(query: Record<string, string>) {
    return parseReportFilters(new URLSearchParams(query));
}
test('parseReportFilters: filter valid dipetakan ke batas hari WIB', () => {
    const parsed = parse({
        status: 'open',
        severity: 'critical',
        category: 'Spam',
        assigned: 'unassigned',
        q: 'penipuan',
        from: '2026-10-01',
        to: '2026-10-31',
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok)
        return;
    assert.equal(parsed.filters.status, 'open');
    assert.equal(parsed.filters.severity, 'critical');
    assert.equal(parsed.filters.category, 'Spam');
    assert.equal(parsed.filters.assigned, 'unassigned');
    assert.equal(parsed.filters.q, 'penipuan');
    assert.equal(parsed.filters.fromIso, '2026-09-30T17:00:00.000Z');
    assert.equal(parsed.filters.toExclusiveIso, '2026-10-31T17:00:00.000Z');
});
test('parseReportFilters: status/severity/assigned di luar allowlist ditolak', () => {
    for (const [name, value] of [
        ['status', 'archived'],
        ['severity', 'urgent'],
        ['assigned', 'maybe'],
    ] as const) {
        const parsed = parse({ [name]: value });
        assert.equal(parsed.ok, false, `${name}=${value} harus ditolak`);
    }
});
test('parseReportFilters: tanggal kalender tidak valid dan rentang terbalik ditolak', () => {
    const impossible = parse({ from: '2026-02-31' });
    assert.equal(impossible.ok, false);
    const reverse = parse({ from: '2026-10-31', to: '2026-10-01' });
    assert.equal(reverse.ok, false);
    const badShape = parse({ to: '2026/10/01' });
    assert.equal(badShape.ok, false);
    const oneDay = parse({ from: '2026-10-01', to: '2026-10-01' });
    assert.equal(oneDay.ok, true);
});
test('parseReportFilters: istilah pencarian dibersihkan dari struktur PostgREST', () => {
    const parsed = parse({ q: '  kopi,susu(manis)  ', category: 'Spam, Bot' });
    assert.equal(parsed.ok, true);
    if (!parsed.ok)
        return;
    assert.equal(parsed.filters.q, 'kopi susu manis');
    assert.equal(parsed.filters.category, 'Spam  Bot');
});
test('buildReportFilterSearchParams: hanya parameter aktif yang dikirim', () => {
    assert.equal(buildReportFilterSearchParams({}).toString(), '');
    const params = buildReportFilterSearchParams({
        status: 'resolved',
        severity: 'high',
        assigned: 'assigned',
        category: 'Spam',
        q: 'penipuan',
        from: '2026-10-01',
        to: '2026-10-31',
    });
    assert.equal(params.get('status'), 'resolved');
    assert.equal(params.get('severity'), 'high');
    assert.equal(params.get('assigned'), 'assigned');
    assert.equal(params.get('category'), 'Spam');
    assert.equal(params.get('q'), 'penipuan');
    assert.equal(params.get('from'), '2026-10-01');
    assert.equal(params.get('to'), '2026-10-31');
});
test('applyReportFiltersToQuery: status, tanggal eksklusif, penugasan, dan pencarian', () => {
    class FakeQuery {
        calls: unknown[][] = [];
        eq(column: string, value: string) {
            this.calls.push(['eq', column, value]);
            return this;
        }
        ilike(column: string, pattern: string) {
            this.calls.push(['ilike', column, pattern]);
            return this;
        }
        not(column: string, operator: string, value: null) {
            this.calls.push(['not', column, operator, value]);
            return this;
        }
        is(column: string, value: null) {
            this.calls.push(['is', column, value]);
            return this;
        }
        gte(column: string, value: string) {
            this.calls.push(['gte', column, value]);
            return this;
        }
        lt(column: string, value: string) {
            this.calls.push(['lt', column, value]);
            return this;
        }
        or(filters: string) {
            this.calls.push(['or', filters]);
            return this;
        }
    }
    const parsed = parse({
        status: 'reviewing',
        severity: 'medium',
        category: 'Spam',
        assigned: 'assigned',
        q: 'tipu',
        from: '2026-10-01',
        to: '2026-10-31',
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok)
        return;
    const fake = new FakeQuery();
    const result = applyReportFiltersToQuery(fake, parsed.filters);
    assert.equal(result, fake);
    assert.deepEqual(fake.calls, [
        ['eq', 'status', 'reviewing'],
        ['eq', 'severity', 'medium'],
        ['ilike', 'category', '%Spam%'],
        ['not', 'assigned_to', 'is', null],
        ['gte', 'created_at', '2026-09-30T17:00:00.000Z'],
        ['lt', 'created_at', '2026-10-31T17:00:00.000Z'],
        ['or', 'description.ilike.%tipu%,category.ilike.%tipu%'],
    ]);
});
test('CSV: kutip, newline, koma, dan karakter formula aman', () => {
    assert.equal(escapeCsvCell('a,b'), '"a,b"');
    assert.equal(escapeCsvCell('kata "kutip"'), '"kata ""kutip"""');
    assert.equal(escapeCsvCell('baris1\nbaris2'), '"baris1\nbaris2"');
    assert.equal(escapeCsvCell(12), '"12"');
    assert.equal(escapeCsvCell(-5), '"-5"');
    assert.equal(escapeCsvCell(null), '""');
    assert.equal(escapeCsvCell(undefined), '""');
    for (const dangerous of [
        '=SUM(A1:A2)',
        '+cmd',
        '-2+3',
        '@user',
        '\tvalue',
        '\rvalue',
        '  =cmd',
        '\u0000=cmd',
        '\u000B=cmd',
        '\u007F=cmd',
        '\u00A0=cmd',
    ]) {
        const protectedValue = `'${dangerous}`;
        assert.equal(protectCsvFormula(dangerous), protectedValue);
        assert.equal(escapeCsvCell(dangerous), `"${protectedValue.replace(/"/g, '""')}"`);
    }
    assert.equal(escapeCsvCell('-5'), "\"'-5\"");
});
test('CSV: hanya content-type CSV yang boleh diunduh', () => {
    assert.equal(isCsvContentType('text/csv'), true);
    assert.equal(isCsvContentType('text/csv; charset=utf-8'), true);
    assert.equal(isCsvContentType('TEXT/CSV;charset=UTF-8'), true);
    assert.equal(isCsvContentType('application/json'), false);
    assert.equal(isCsvContentType('text/html; charset=utf-8'), false);
    assert.equal(isCsvContentType(null), false);
});
test('contentDispositionFilename: dibaca dari header, null bila nama tidak ada', () => {
    assert.equal(contentDispositionFilename('attachment; filename="pengguna-rebites-2026-11-06.xlsx"'), 'pengguna-rebites-2026-11-06.xlsx');
    assert.equal(contentDispositionFilename('attachment; filename=laporan.xlsx'), 'laporan.xlsx');
    assert.equal(contentDispositionFilename('attachment'), null);
    assert.equal(contentDispositionFilename(''), null);
    assert.equal(contentDispositionFilename(null), null);
});
test('CSV: dokumen memakai BOM UTF-8, CRLF, header, dan baris kosong', () => {
    const csv = createCsvDocument(['Nama', 'Catatan'], [['Budi', 'baris1\nbaris2']]);
    assert.equal(csv, '\uFEFF"Nama","Catatan"\r\n"Budi","baris1\nbaris2"\r\n');
    const empty = createCsvDocument(['A', 'B'], []);
    assert.equal(empty, '\uFEFF"A","B"\r\n');
});
test('reportExportDate: nama file memakai tanggal WIB', () => {
    assert.equal(reportExportDate(Date.parse('2026-10-26T16:59:59.000Z')), '2026-10-26');
    assert.equal(reportExportDate(Date.parse('2026-10-26T17:00:00.000Z')), '2026-10-27');
});
test('route ekspor: otorisasi server, XLSX, limit eksplisit, tanpa service role', () => {
    const source = readProjectFile('app/api/admin/reports/export/route.ts');
    assert.match(source, /getAdminUser/);
    assert.match(source, /createAuthedServerClient/);
    assert.match(source, /parseReportFilters/);
    assert.match(source, /applyReportFiltersToQuery/);
    assert.match(source, /count: 'exact'/);
    assert.match(source, /EXPORT_MAX_ROWS/);
    assert.match(source, /status: 413/);
    assert.match(source, /status: 204/);
    assert.match(source, /Gagal menghitung jumlah laporan/);
    assert.ok(source.includes("'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'"));
    assert.match(source, /buildXlsx/);
    assert.match(source, /\.xlsx/);
    assert.ok(source.includes('Content-Disposition'));
    assert.ok(source.includes('attachment; filename='));
    assert.match(source, /X-Export-Row-Count/);
    assert.doesNotMatch(source, /createServiceClient|service_role|SERVICE_ROLE/);
});
test('client ekspor: wrapper auth, validasi XLSX, dan abort saat filter berubah', () => {
    const client = readProjectFile('lib/admin-reports.ts');
    const shared = readProjectFile('lib/admin-export.ts');
    const view = readProjectFile('app/components/admin/reports-view.tsx');
    const session = readProjectFile('app/components/admin/admin-session.ts');
    assert.match(client, /fetchAdminWithAuth/);
    assert.doesNotMatch(client, /getAdminAuthHeader|AdminAuthError|Authorization:/);
    assert.match(client, /downloadAdminExport/);
    assert.match(client, /AdminExportApiError/);
    assert.doesNotMatch(client, /isXlsxContentType|blob\.size === 0/);
    assert.match(shared, /fetchAdminWithAuth/);
    assert.match(shared, /contentDispositionFilename/);
    assert.match(shared, /isXlsxContentType/);
    assert.match(shared, /blob\.size === 0/);
    assert.match(shared, /AbortSignal/);
    assert.match(shared, /signal\?\.aborted/);
    assert.match(view, /new AbortController/);
    assert.match(view, /controller\.signal/);
    assert.match(view, /isAbortError/);
    assert.match(view, /Ekspor dibatalkan karena filter berubah/);
    assert.match(view, /lastRequestedOffsetRef\.current/);
    assert.match(view, /redirectIfSessionExpired/);
    assert.doesNotMatch(view, /async function redirectIfSessionExpired\(/);
    assert.match(session, /router\.replace\('\/auth\/login'\)/);
});
test('UI dan API memakai kontrak filter yang sama untuk daftar dan ekspor', () => {
    const clientSource = readProjectFile('lib/admin-reports.ts');
    const viewSource = readProjectFile('app/components/admin/reports-view.tsx');
    const listRoute = readProjectFile('app/api/admin/reports/route.ts');
    const builderUses = clientSource.match(/buildReportFilterSearchParams/g) ?? [];
    assert.ok(builderUses.length >= 2, 'daftar dan ekspor harus memakai builder yang sama');
    assert.match(viewSource, /downloadReportsExcel\(statusFilter, filterOptions, controller\.signal\)/);
    assert.match(viewSource, /fetchReports\(\s*PAGE_LIMIT,\s*nextOffset,\s*statusFilter \?\? undefined,\s*filterOptions\s*\)/);
    assert.match(listRoute, /parseReportFilters/);
    assert.match(listRoute, /applyReportFiltersToQuery/);
    assert.match(listRoute, /Gagal menghitung total laporan/);
    assert.match(viewSource, /Tidak ada laporan yang cocok dengan filter saat ini/);
    assert.match(viewSource, /role=\{exportFeedback\.tone === 'error' \? 'alert' : 'status'\}/);
    assert.match(viewSource, /5\.000 laporan/);
});
