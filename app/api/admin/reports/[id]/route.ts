import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';

export const runtime = 'nodejs';

/**
 * PATCH /api/admin/reports/:id
 * Perbarui workflow case laporan:
 *   { status?: 'open'|'reviewing'|'resolved'|'dismissed',
 *     severity?: 'low'|'medium'|'high'|'critical'|null,
 *     assignedTo?: string|null,
 *     reason?: string }
 *
 * - Status resolved/dismissed diatribusi otomatis via trigger DB
 *   (resolved_by dipaksa ke admin pelaksana) dan diaudit otomatis
 *   oleh trigger audit_report_resolution.
 * - Perubahan severity / assignment TIDAK dicakup trigger audit,
 *   sehingga dicatat manual di sini (satu audit per PATCH yang
 *   mengubah severity atau assignment). Alasan manual opsional.
 */

const VALID_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const;
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

/**
 * UUID longgar: hanya menerima bentuk UUID sebelum dikirim ke kolom
 * `assigned_to`. Sebelumnya string apa pun diterima, sehingga nilai
 * non-UUID berakhir sebagai error DB 500 yang tidak informatif — atau
 * lebih buruk, tersimpan bila kolomnya ternyata `text`.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REPORT_SELECT = [
  'id',
  'reported_user_id',
  'reported_by',
  'activity_id',
  'category',
  'description',
  'status',
  'resolved_by',
  'resolved_at',
  'severity',
  'assigned_to',
  'created_at',
  'reportedUser:profiles!reports_reported_user_id_fkey(id, full_name, email)',
  'reporter:profiles!reports_reported_by_fkey(id, full_name, email)',
  'assignedTo:profiles!reports_assigned_to_fkey(id, full_name, email)',
].join(', ');

type ReportRow = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * GET /api/admin/reports/:id — detail satu laporan. Mapping identik dengan
 * GET /api/admin/reports (daftar) karena membaca tabel & join yang sama.
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

    const db = createAuthedServerClient(authHeader);
    const { data, error } = await db
      .from('reports')
      .select(REPORT_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('[admin/reports/:id] fetch error', error.message);
      return NextResponse.json({ error: 'Gagal memuat laporan.' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Laporan tidak ditemukan.' }, { status: 404 });
    }

    const r = data as unknown as ReportRow;
    const reportedUser = asRecord(r.reportedUser);
    const reporter = asRecord(r.reporter);
    const assignedTo = asRecord(r.assignedTo);
    return NextResponse.json({
      report: {
        id: asString(r.id) ?? '',
        reportedUserId: asString(r.reported_user_id) ?? asString(reportedUser?.id),
        reportedUserName:
          asString(reportedUser?.full_name) ?? asString(reportedUser?.email) ?? 'Tidak diketahui',
        reportedUserEmail: asString(reportedUser?.email),
        reportedBy: asString(r.reported_by) ?? asString(reporter?.id),
        reporterName:
          asString(reporter?.full_name) ?? asString(reporter?.email) ?? 'Tidak diketahui',
        reporterEmail: asString(reporter?.email),
        activityId: asString(r.activity_id),
        category: asString(r.category) ?? '',
        description: asString(r.description) ?? '',
        status: asString(r.status) ?? 'open',
        severity: asString(r.severity),
        assignedToId: asString(r.assigned_to) ?? asString(assignedTo?.id),
        assignedToName: assignedTo
          ? asString(assignedTo.full_name) ?? asString(assignedTo.email) ?? 'Tidak diketahui'
          : null,
        assignedToEmail: asString(assignedTo?.email),
        resolvedBy: asString(r.resolved_by),
        resolvedAt: asString(r.resolved_at),
        createdAt: asString(r.created_at) ?? '',
      },
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/reports/:id] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses laporan." }, { status: 500 });
  }
}

export async function PATCH(
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

    const body = (await req.json().catch(() => null)) as {
      status?: unknown;
      severity?: unknown;
      assignedTo?: unknown;
      reason?: unknown;
    } | null;
    if (!body) {
      return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    const auditNotes: Record<string, unknown> = {};

    if (body.status !== undefined) {
      const next = typeof body.status === 'string' ? body.status.trim() : '';
      if (!(VALID_STATUSES as readonly string[]).includes(next)) {
        return NextResponse.json(
          { error: `Status tidak valid. Gunakan: ${VALID_STATUSES.join(', ')}.` },
          { status: 400 }
        );
      }
      update.status = next;
    }

    if (body.severity !== undefined) {
      if (body.severity === null) {
        update.severity = null;
        auditNotes.severity_to = null;
      } else {
        const sev = typeof body.severity === 'string' ? body.severity.trim() : '';
        if (!(VALID_SEVERITIES as readonly string[]).includes(sev)) {
          return NextResponse.json(
            { error: `Severity tidak valid. Gunakan: ${VALID_SEVERITIES.join(', ')}.` },
            { status: 400 }
          );
        }
        update.severity = sev;
        auditNotes.severity_to = sev;
      }
    }

    if (body.assignedTo !== undefined) {
      if (body.assignedTo === null) {
        update.assigned_to = null;
        auditNotes.assigned_to = null;
      } else {
        const assignee = typeof body.assignedTo === 'string' ? body.assignedTo.trim() : '';
        if (!assignee) {
          return NextResponse.json({ error: 'assignedTo tidak valid.' }, { status: 400 });
        }
        // Harus UUID: mencegah nilai sembarang masuk ke kolom relasi
        // (mis. email atau nama) yang kemudian gagal sebagai 500 samar.
        if (!UUID_RE.test(assignee)) {
          return NextResponse.json(
            { error: 'assignedTo harus berupa UUID admin yang valid.' },
            { status: 400 }
          );
        }
        update.assigned_to = assignee;
        auditNotes.assigned_to = assignee;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Tidak ada perubahan.' }, { status: 400 });
    }

    const db = createAuthedServerClient(authHeader);
    const { data: existing, error: fetchErr } = await db
      .from('reports')
      .select('id, status, severity, assigned_to')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) {
      console.error('[admin/reports/patch] fetch error', fetchErr.message);
      return NextResponse.json({ error: 'Gagal memuat laporan.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Laporan tidak ditemukan.' }, { status: 404 });
    }

    const old = existing;

    // Idempoten: menandai 'reviewing' dua kali adalah no-op (409), mencegah
    // klik ganda memicu audit ganda.
    if (body.status === 'reviewing' && old.status === 'reviewing') {
      return NextResponse.json({ error: "Status sudah 'reviewing'." }, { status: 409 });
    }

    const { data: updated, error: updErr } = await db
      .from('reports')
      .update(update)
      .eq('id', id)
      .select('id, status, severity, assigned_to, resolved_by, resolved_at')
      .maybeSingle();
    if (updErr) {
      console.error('[admin/reports/patch] update error', updErr.message);
      return NextResponse.json({ error: 'Gagal memperbarui laporan.' }, { status: 500 });
    }

    // Audit manual untuk perubahan severity / assignment (trigger audit DB
    // hanya mencakup resolve/dismiss, warning, sanction, account_status).
    const triageChanged =
      (body.severity !== undefined && old.severity !== update.severity) ||
      (body.assignedTo !== undefined && old.assigned_to !== update.assigned_to);
    if (triageChanged) {
      const reason =
        typeof body.reason === 'string' && body.reason.trim().length > 0
          ? body.reason.trim()
          : null;
      const { error: auditErr } = await db.from('admin_audit_logs').insert({
        admin_id: admin.id,
        action: 'update_report_triage',
        target_type: 'report',
        target_id: id,
        reason: reason ?? 'Triage laporan diperbarui admin',
        metadata: {
          auto: !reason,
          from: {
            status: old.status,
            severity: old.severity,
            assigned_to: old.assigned_to,
          },
          to: {
            status: update.status ?? old.status,
            severity: update.severity ?? old.severity,
            assigned_to: update.assigned_to ?? old.assigned_to,
          },
        },
      });
      if (auditErr) {
        console.error('[admin/reports/patch] audit error', auditErr.message);
      }
    }

    const row = updated;
    return NextResponse.json({
      report: {
        id,
        status: row?.status ?? update.status ?? old.status,
        severity: row?.severity ?? update.severity ?? old.severity,
        assignedToId: row?.assigned_to ?? update.assigned_to ?? old.assigned_to,
        resolvedBy: row?.resolved_by ?? null,
        resolvedAt: row?.resolved_at ?? null,
      },
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/reports/patch] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses laporan." }, { status: 500 });
  }
}
