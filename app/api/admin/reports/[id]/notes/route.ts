import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';

export const runtime = 'nodejs';

const NOTES_SELECT = [
  'id',
  'report_id',
  'admin_id',
  'note',
  'created_at',
  'admin:profiles!report_notes_admin_id_fkey(id, full_name, email)',
].join(', ');

type NoteRow = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * GET /api/admin/reports/:id/notes?limit&offset
 * Daftar catatan internal untuk satu report (admin only).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const id = params.id?.trim();
    if (!id) {
      return NextResponse.json({ error: 'ID laporan wajib.' }, { status: 400 });
    }

    const searchParams = req.nextUrl.searchParams;
    const rawLimit = Number(searchParams.get('limit') ?? '50');
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 50;
    const rawOffset = Number(searchParams.get('offset') ?? '0');
    const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;

    const db = createAuthedServerClient(authHeader);
    const { data, error, count } = await db
      .from('report_notes')
      .select(NOTES_SELECT, { count: 'exact' })
      .eq('report_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[admin/reports/notes] fetch error', error.message);
      return NextResponse.json({ error: 'Gagal memuat catatan.' }, { status: 500 });
    }

    const notes = (data ?? []).map((row) => {
      const r = row as unknown as NoteRow;
      const adminRow = asRecord(r.admin);
      return {
        id: asString(r.id) ?? '',
        reportId: asString(r.report_id) ?? '',
        adminId: asString(r.admin_id) ?? asString(adminRow?.id),
        adminName:
          asString(adminRow?.full_name) ?? asString(adminRow?.email) ?? 'Tidak diketahui',
        adminEmail: asString(adminRow?.email),
        note: asString(r.note) ?? '',
        createdAt: asString(r.created_at) ?? '',
      };
    });

    return NextResponse.json({ notes, total: count ?? notes.length, limit, offset });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/reports/notes] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses laporan." }, { status: 500 });
  }
}

/**
 * POST /api/admin/reports/:id/notes
 * Tambah catatan internal: { note: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const id = params.id?.trim();
    if (!id) {
      return NextResponse.json({ error: 'ID laporan wajib.' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { note?: unknown } | null;
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    if (!note) {
      return NextResponse.json({ error: 'Catatan wajib diisi.' }, { status: 400 });
    }
    if (note.length > 2000) {
      return NextResponse.json({ error: 'Catatan maksimal 2000 karakter.' }, { status: 400 });
    }

    const db = createAuthedServerClient(authHeader);
    const { data: report, error: reportErr } = await db
      .from('reports')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (reportErr) {
      console.error('[admin/reports/notes] report check error', reportErr.message);
      return NextResponse.json({ error: 'Gagal memvalidasi laporan.' }, { status: 500 });
    }
    if (!report) {
      return NextResponse.json({ error: 'Laporan tidak ditemukan.' }, { status: 404 });
    }

    const { data: inserted, error: insertErr } = await db
      .from('report_notes')
      .insert({ report_id: id, admin_id: admin.id, note })
      .select(NOTES_SELECT)
      .single();

    if (insertErr) {
      console.error('[admin/reports/notes] insert error', insertErr.message);
      return NextResponse.json({ error: 'Gagal menyimpan catatan.' }, { status: 500 });
    }

    const r = inserted as unknown as NoteRow;
    const adminRow = asRecord(r.admin);
    return NextResponse.json(
      {
        note: {
          id: asString(r.id) ?? '',
          reportId: asString(r.report_id) ?? '',
          adminId: asString(r.admin_id) ?? asString(adminRow?.id),
          adminName:
            asString(adminRow?.full_name) ?? asString(adminRow?.email) ?? 'Tidak diketahui',
          adminEmail: asString(adminRow?.email),
          note: asString(r.note) ?? '',
          createdAt: asString(r.created_at) ?? '',
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/reports/notes] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses laporan." }, { status: 500 });
  }
}
