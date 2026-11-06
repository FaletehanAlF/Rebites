import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
  isSupabaseUnavailable,
  queryFailureResponse,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';
import {
  PageLimitError,
  PageQueryError,
  fetchAllPages,
  type PostgrestPage,
} from '@/lib/server/supabase-rows';
import {
  applyReportFiltersToQuery,
  parseReportFilters,
  reportExportDate,
} from '@/lib/report-filters';
import { buildXlsx, type XlsxColumn } from '@/lib/xlsx';
import { formatWibDateTime } from '@/lib/wib-time';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/reports/export
 *
 * CSV laporan mengikuti filter yang sama dengan GET /api/admin/reports.
 * Otorisasi diperiksa server pada setiap request; data dibaca memakai sesi
 * admin (RLS aktif), bukan service-role. Maksimum 5.000 baris — bila lebih,
 * request ditolak dengan pesan jelas, tidak dipotong diam-diam.
 */

const EXPORT_MAX_ROWS = 5_000;
const EXPORT_SELECT = [
  'id',
  'category',
  'description',
  'status',
  'severity',
  'resolved_at',
  'created_at',
  'reportedUser:profiles!reports_reported_user_id_fkey(full_name)',
  'reporter:profiles!reports_reported_by_fkey(full_name)',
  'assignedTo:profiles!reports_assigned_to_fkey(full_name)',
].join(', ');

type ReportExportRow = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function profileName(value: unknown): string {
  const record = asRecord(value);
  return asString(record?.full_name)?.trim() || 'Tidak diketahui';
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Terbuka',
  reviewing: 'Ditinjau',
  resolved: 'Selesai',
  dismissed: 'Ditolak',
};

const SEVERITY_LABEL: Record<string, string> = {
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
  critical: 'Kritis',
};

function statusLabel(value: string | null): string {
  return value ? (STATUS_LABEL[value] ?? value) : '';
}

function severityLabel(value: string | null): string {
  return value ? (SEVERITY_LABEL[value] ?? value) : '';
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const admin = await getAdminUser(authHeader);
    if (!admin) {
      const user = await getUserFromBearer(authHeader);
      return NextResponse.json(
        { error: user ? 'Akses ditolak. Hanya admin.' : 'Unauthorized. Silakan login ulang.' },
        { status: user ? 403 : 401 }
      );
    }
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }

    const parsedFilters = parseReportFilters(req.nextUrl.searchParams);
    if (!parsedFilters.ok) {
      return NextResponse.json({ error: parsedFilters.error }, { status: 400 });
    }

    const db = createAuthedServerClient(authHeader);
    const filters = parsedFilters.filters;

    const countQuery = applyReportFiltersToQuery(
      db.from('reports').select('id', { count: 'exact', head: true }),
      filters
    );
    const countResult = await countQuery;
    if (countResult.error) {
      console.error('[admin/reports/export] count error', countResult.error.message);
      return queryFailureResponse(countResult.error, 'Gagal membuat ekspor laporan.');
    }

    const count = countResult.count;
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
      console.error('[admin/reports/export] exact count tidak tersedia');
      return NextResponse.json(
        { error: 'Gagal menghitung jumlah laporan.' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const total = count;
    if (total === 0) {
      return new NextResponse(null, {
        status: 204,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (total > EXPORT_MAX_ROWS) {
      return NextResponse.json(
        {
          error: `Jumlah laporan (${total.toLocaleString('id-ID')}) melebihi batas ekspor ${EXPORT_MAX_ROWS.toLocaleString('id-ID')} baris. Persempit filter tanggal atau status.`,
        },
        { status: 413, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let rows: ReportExportRow[];
    try {
      rows = await fetchAllPages<ReportExportRow>(
        (from, to) => {
          const query = applyReportFiltersToQuery(
            db
              .from('reports')
              .select(EXPORT_SELECT)
              .order('created_at', { ascending: false })
              .order('id', { ascending: false }),
            filters
          );
          return query.range(from, to) as unknown as PromiseLike<PostgrestPage<ReportExportRow>>;
        },
        { maxRows: EXPORT_MAX_ROWS, label: 'ekspor laporan' }
      );
    } catch (err) {
      if (err instanceof PageLimitError) {
        return NextResponse.json(
          {
            error: `Jumlah laporan melebihi batas ekspor ${EXPORT_MAX_ROWS.toLocaleString('id-ID')} baris. Persempit filter tanggal atau status.`,
          },
          { status: 413, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      if (err instanceof PageQueryError) {
        console.error('[admin/reports/export] page error', err.label, err.queryError);
        return queryFailureResponse(err.queryError, 'Gagal membuat ekspor laporan.');
      }
      throw err;
    }

    if (rows.length === 0) {
      return new NextResponse(null, {
        status: 204,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // Kolom Excel: lebar eksplisit per kolom. `wrap` untuk teks yang bisa
    // panjang (deskripsi, nama) agar tidak meluber menutupi sel tetangga.
    const columns: XlsxColumn[] = [
      { header: 'ID Laporan', width: 38 },
      { header: 'Dibuat (WIB)', width: 20 },
      { header: 'Kategori', width: 22, wrap: true },
      { header: 'Deskripsi', width: 60, wrap: true },
      { header: 'Status', width: 12 },
      { header: 'Tingkat', width: 12 },
      { header: 'Pelapor', width: 24, wrap: true },
      { header: 'Terlapor', width: 24, wrap: true },
      { header: 'Ditugaskan', width: 24, wrap: true },
      { header: 'Diselesaikan (WIB)', width: 20 },
    ];

    const dataRows = rows.map((row) => {
      const createdAt = asString(row.created_at);
      const resolvedAt = asString(row.resolved_at);
      return [
        asString(row.id) ?? '',
        createdAt ? (formatWibDateTime(createdAt) ?? '') : '',
        asString(row.category) ?? '',
        asString(row.description) ?? '',
        statusLabel(asString(row.status)),
        severityLabel(asString(row.severity)),
        profileName(row.reporter),
        profileName(row.reportedUser),
        row.assignedTo ? profileName(row.assignedTo) : 'Belum ditugaskan',
        resolvedAt ? (formatWibDateTime(resolvedAt) ?? '') : '',
      ];
    });

    const filename = `laporan-rebites-${reportExportDate()}.xlsx`;
    const workbook = buildXlsx({
      name: 'Laporan',
      columns,
      rows: dataRows,
    });

    return new NextResponse(new Uint8Array(workbook), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Export-Row-Count': String(rows.length),
      },
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/reports/export] unexpected', err);
    return NextResponse.json({ error: 'Gagal membuat ekspor laporan.' }, { status: 500 });
  }
}
