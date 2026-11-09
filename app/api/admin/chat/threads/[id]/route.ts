import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { isActiveBlockSanction } from '@/lib/account-block';
import { SUPPORT_MESSAGE_MAX } from '@/lib/support';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const REQUEST_TIMEOUT_MS = 10000;
const MESSAGE_LIMIT = 300;
const THREAD_DETAIL_COLUMNS = [
    'id',
    'profile_id',
    'email',
    'status',
    'origin',
    'last_message_at',
    'last_message_preview',
    'last_sender_kind',
    'admin_unread_count',
    'user_unread_count',
    'admin_read_at',
    'user_read_at',
    'created_at',
    'updated_at',
    'profile:profiles(id, full_name, email, role, account_status, deleted_at, avatar_url, phone)',
].join(', ');
const MESSAGE_COLUMNS = 'id, sender_kind, sender_user_id, channel, body, created_at';
const APPEAL_DECISIONS = ['reviewing', 'approved', 'rejected'] as const;
type AppealDecision = (typeof APPEAL_DECISIONS)[number];
interface ThreadActionBody {
    action?: unknown;
    appealId?: unknown;
    status?: unknown;
    note?: unknown;
}
function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}
async function requireAdmin(authHeader: string | null) {
    const admin = await getAdminUser(authHeader);
    if (admin)
        return { ok: true as const, admin };
    const user = await getUserFromBearer(authHeader);
    return {
        ok: false as const,
        response: NextResponse.json({ error: user ? 'Hanya admin yang dapat membuka kotak pesan.' : 'Unauthorized' }, { status: user ? 403 : 401 }),
    };
}
export async function GET(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const guard = await requireAdmin(req.headers.get('authorization'));
        if (!guard.ok)
            return guard.response;
        const id = params.id?.trim();
        if (!id) {
            return NextResponse.json({ error: 'ID percakapan wajib diisi.' }, { status: 400 });
        }
        const service = createServiceClient(REQUEST_TIMEOUT_MS);
        const { data: thread, error: threadError } = await service
            .from('support_threads')
            .select(THREAD_DETAIL_COLUMNS)
            .eq('id', id)
            .maybeSingle();
        if (threadError) {
            console.error('[admin/chat/thread] gagal memuat percakapan:', threadError.message);
            return NextResponse.json({ error: 'Gagal memuat percakapan.' }, { status: 500 });
        }
        if (!thread) {
            return NextResponse.json({ error: 'Percakapan tidak ditemukan.' }, { status: 404 });
        }
        const threadRow = thread as unknown as Record<string, unknown>;
        const profileId = threadRow.profile_id ? String(threadRow.profile_id) : null;
        const [messagesResult, appealsResult] = await Promise.all([
            service
                .from('support_messages')
                .select(MESSAGE_COLUMNS)
                .eq('thread_id', id)
                .order('created_at', { ascending: true })
                .limit(MESSAGE_LIMIT),
            service
                .from('support_appeals')
                .select('id, email, status, message, decision_note, decided_by, decided_at, created_at')
                .eq('thread_id', id)
                .order('created_at', { ascending: false })
                .limit(20),
        ]);
        if (messagesResult.error) {
            console.error('[admin/chat/thread] gagal memuat pesan:', messagesResult.error.message);
            return NextResponse.json({ error: 'Gagal memuat pesan.' }, { status: 500 });
        }
        let activeBlocks: Array<Record<string, unknown>> = [];
        if (profileId) {
            const { data: sanctions, error: sanctionError } = await service
                .from('sanctions')
                .select('id, sanction_type, reason, end_at, created_at')
                .eq('user_id', profileId)
                .in('sanction_type', ['suspend', 'ban'])
                .order('created_at', { ascending: false })
                .limit(50);
            if (sanctionError) {
                console.warn('[admin/chat/thread] gagal memuat sanksi:', sanctionError.message);
            }
            const now = Date.now();
            activeBlocks = ((sanctions ?? []) as Array<Record<string, unknown>>).filter((row) => isActiveBlockSanction({ sanctionType: row.sanction_type, endAt: row.end_at }, now));
        }
        const profile = asRecord(threadRow.profile);
        return NextResponse.json({
            thread: {
                id: String(threadRow.id),
                email: String(threadRow.email ?? ''),
                status: String(threadRow.status ?? 'open'),
                origin: String(threadRow.origin ?? 'chat'),
                profileId,
                adminUnreadCount: Number(threadRow.admin_unread_count ?? 0),
                createdAt: threadRow.created_at ? String(threadRow.created_at) : null,
                lastMessageAt: threadRow.last_message_at ? String(threadRow.last_message_at) : null,
            },
            profile: profile
                ? {
                    id: String(profile.id),
                    fullName: profile.full_name ? String(profile.full_name) : null,
                    email: profile.email ? String(profile.email) : null,
                    role: profile.role ? String(profile.role) : null,
                    accountStatus: profile.account_status ? String(profile.account_status) : null,
                    deletedAt: profile.deleted_at ? String(profile.deleted_at) : null,
                    avatarUrl: profile.avatar_url ? String(profile.avatar_url) : null,
                    phone: profile.phone ? String(profile.phone) : null,
                }
                : null,
            messages: ((messagesResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
                id: String(row.id),
                senderKind: String(row.sender_kind ?? 'user'),
                senderUserId: row.sender_user_id ? String(row.sender_user_id) : null,
                channel: String(row.channel ?? 'app'),
                body: String(row.body ?? ''),
                createdAt: row.created_at ? String(row.created_at) : null,
            })),
            appeals: ((appealsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
                id: String(row.id),
                email: String(row.email ?? ''),
                status: String(row.status ?? 'pending'),
                message: String(row.message ?? ''),
                decisionNote: row.decision_note ? String(row.decision_note) : null,
                decidedAt: row.decided_at ? String(row.decided_at) : null,
                createdAt: String(row.created_at ?? ''),
            })),
            activeBlocks: activeBlocks.map((row) => ({
                id: String(row.id),
                sanctionType: String(row.sanction_type ?? ''),
                reason: String(row.reason ?? ''),
                endAt: row.end_at ? String(row.end_at) : null,
            })),
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/chat/thread] unexpected', err);
        return NextResponse.json({ error: 'Gagal memuat percakapan.' }, { status: 500 });
    }
}
export async function POST(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const guard = await requireAdmin(req.headers.get('authorization'));
        if (!guard.ok)
            return guard.response;
        const id = params.id?.trim();
        if (!id) {
            return NextResponse.json({ error: 'ID percakapan wajib diisi.' }, { status: 400 });
        }
        let body: {
            message?: unknown;
        } | null = null;
        try {
            body = (await req.json()) as {
                message?: unknown;
            } | null;
        }
        catch {
            body = null;
        }
        const message = (typeof body?.message === 'string' ? body.message : '').trim();
        if (!message) {
            return NextResponse.json({ error: 'Pesan tidak boleh kosong.' }, { status: 400 });
        }
        if (message.length > SUPPORT_MESSAGE_MAX) {
            return NextResponse.json({ error: `Pesan maksimal ${SUPPORT_MESSAGE_MAX} karakter.` }, { status: 400 });
        }
        const service = createServiceClient(REQUEST_TIMEOUT_MS);
        const { data: existing, error: readError } = await service
            .from('support_threads')
            .select('id, status')
            .eq('id', id)
            .maybeSingle();
        if (readError) {
            console.error('[admin/chat/thread] gagal membaca percakapan:', readError.message);
            return NextResponse.json({ error: 'Gagal mengirim balasan.' }, { status: 500 });
        }
        if (!existing) {
            return NextResponse.json({ error: 'Percakapan tidak ditemukan.' }, { status: 404 });
        }
        const { data: inserted, error: insertError } = await service
            .from('support_messages')
            .insert({
            thread_id: id,
            sender_kind: 'admin',
            sender_user_id: guard.admin.id,
            channel: 'admin',
            body: message,
        })
            .select(MESSAGE_COLUMNS)
            .maybeSingle();
        if (insertError || !inserted) {
            console.error('[admin/chat/thread] gagal menyimpan balasan:', insertError?.message);
            return NextResponse.json({ error: 'Gagal mengirim balasan.' }, { status: 500 });
        }
        const row = inserted as Record<string, unknown>;
        return NextResponse.json({
            message: {
                id: String(row.id),
                senderKind: String(row.sender_kind ?? 'admin'),
                senderUserId: row.sender_user_id ? String(row.sender_user_id) : null,
                channel: String(row.channel ?? 'admin'),
                body: String(row.body ?? ''),
                createdAt: row.created_at ? String(row.created_at) : null,
            },
        }, { status: 201 });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/chat/thread] unexpected', err);
        return NextResponse.json({ error: 'Gagal mengirim balasan.' }, { status: 500 });
    }
}
export async function PATCH(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const guard = await requireAdmin(req.headers.get('authorization'));
        if (!guard.ok)
            return guard.response;
        const id = params.id?.trim();
        if (!id) {
            return NextResponse.json({ error: 'ID percakapan wajib diisi.' }, { status: 400 });
        }
        let body: ThreadActionBody | null = null;
        try {
            body = (await req.json()) as ThreadActionBody | null;
        }
        catch {
            body = null;
        }
        const action = typeof body?.action === 'string' ? body.action.trim() : '';
        const service = createServiceClient(REQUEST_TIMEOUT_MS);
        if (action === 'mark_read') {
            const { error } = await service
                .from('support_threads')
                .update({ admin_unread_count: 0, admin_read_at: new Date().toISOString() })
                .eq('id', id);
            if (error) {
                console.error('[admin/chat/thread] gagal menandai baca:', error.message);
                return NextResponse.json({ error: 'Gagal menandai sudah dibaca.' }, { status: 500 });
            }
            return NextResponse.json({ ok: true });
        }
        if (action === 'close' || action === 'reopen') {
            const { data, error } = await service
                .from('support_threads')
                .update({ status: action === 'close' ? 'closed' : 'open' })
                .eq('id', id)
                .select('id, status')
                .maybeSingle();
            if (error) {
                console.error('[admin/chat/thread] gagal mengubah status:', error.message);
                return NextResponse.json({ error: 'Gagal mengubah status percakapan.' }, { status: 500 });
            }
            if (!data) {
                return NextResponse.json({ error: 'Percakapan tidak ditemukan.' }, { status: 404 });
            }
            return NextResponse.json({ thread: { id: String(data.id), status: String(data.status) } });
        }
        if (action === 'appeal_decision') {
            const appealId = typeof body?.appealId === 'string' ? body.appealId.trim() : '';
            const status = typeof body?.status === 'string' ? body.status.trim() : '';
            const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) : '';
            if (!appealId) {
                return NextResponse.json({ error: 'ID banding wajib diisi.' }, { status: 400 });
            }
            if (!(APPEAL_DECISIONS as readonly string[]).includes(status)) {
                return NextResponse.json({ error: 'Keputusan banding tidak dikenal.' }, { status: 400 });
            }
            const { data: appeal, error: appealError } = await service
                .from('support_appeals')
                .update({
                status,
                decision_note: note || null,
                decided_by: guard.admin.id,
                decided_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
                .eq('id', appealId)
                .eq('thread_id', id)
                .select('id, status, decision_note, decided_at')
                .maybeSingle();
            if (appealError) {
                console.error('[admin/chat/thread] gagal menyimpan keputusan:', appealError.message);
                return NextResponse.json({ error: 'Gagal menyimpan keputusan banding.' }, { status: 500 });
            }
            if (!appeal) {
                return NextResponse.json({ error: 'Banding tidak ditemukan.' }, { status: 404 });
            }
            const decisionText: Record<AppealDecision, string> = {
                reviewing: 'Banding sedang ditinjau admin.',
                approved: 'Banding disetujui admin. Blokir akun dibuka.',
                rejected: 'Banding ditolak admin.',
            };
            const systemBody = `${decisionText[status as AppealDecision]}${note ? ` Catatan: ${note}` : ''}`;
            const { error: systemError } = await service.from('support_messages').insert({
                thread_id: id,
                sender_kind: 'system',
                sender_user_id: null,
                channel: 'system',
                body: systemBody,
            });
            if (systemError) {
                console.warn('[admin/chat/thread] keputusan tersimpan tetapi pesan sistem gagal:', systemError.message);
            }
            return NextResponse.json({
                appeal: {
                    id: String(appeal.id),
                    status: String(appeal.status),
                    decisionNote: appeal.decision_note ? String(appeal.decision_note) : null,
                    decidedAt: appeal.decided_at ? String(appeal.decided_at) : null,
                },
                systemMessageRecorded: !systemError,
            });
        }
        return NextResponse.json({ error: 'Tindakan tidak dikenal.' }, { status: 400 });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/chat/thread] unexpected', err);
        return NextResponse.json({ error: 'Tindakan gagal diproses.' }, { status: 500 });
    }
}
