import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { sanitizeSupportSearch } from '@/lib/support';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const SEARCH_PROFILE_LIMIT = 100;
const THREAD_COLUMNS = [
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
    'created_at',
    'profile:profiles(id, full_name, email, role, account_status, avatar_url)',
].join(', ');
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const admin = await getAdminUser(authHeader);
        if (!admin) {
            const user = await getUserFromBearer(authHeader);
            return NextResponse.json({ error: user ? 'Hanya admin yang dapat membuka kotak pesan.' : 'Unauthorized' }, { status: user ? 403 : 401 });
        }
        const params = req.nextUrl.searchParams;
        const statusRaw = (params.get('status') ?? '').trim();
        const status = statusRaw === 'open' || statusRaw === 'closed' || statusRaw === 'unread'
            ? statusRaw
            : '';
        const limitRaw = Number.parseInt(params.get('limit') ?? '', 10);
        const limit = Number.isFinite(limitRaw)
            ? Math.min(MAX_LIMIT, Math.max(1, limitRaw))
            : DEFAULT_LIMIT;
        const offsetRaw = Number.parseInt(params.get('offset') ?? '', 10);
        const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
        const search = sanitizeSupportSearch(params.get('search'));
        const service = createServiceClient(REQUEST_TIMEOUT_MS);
        let query = service
            .from('support_threads')
            .select(THREAD_COLUMNS, { count: 'exact' });
        if (search) {
            const { data: matches } = await service
                .from('profiles')
                .select('id')
                .ilike('full_name', `%${search}%`)
                .limit(SEARCH_PROFILE_LIMIT);
            const ids = ((matches ?? []) as Array<Record<string, unknown>>)
                .map((row) => String(row.id))
                .filter((id) => id.length > 0);
            const filters = [`email.ilike.%${search}%`];
            if (ids.length > 0)
                filters.push(`profile_id.in.(${ids.join(',')})`);
            query = query.or(filters.join(','));
        }
        if (status === 'open' || status === 'closed') {
            query = query.eq('status', status);
        }
        else if (status === 'unread') {
            query = query.gt('admin_unread_count', 0);
        }
        const { data: threads, error, count } = await query
            .order('last_message_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) {
            console.error('[admin/chat/threads] gagal memuat percakapan:', error.message);
            return NextResponse.json({ error: 'Gagal memuat daftar percakapan.' }, { status: 500 });
        }
        const rows = (threads ?? []) as unknown as Array<Record<string, unknown>>;
        const threadIds = rows.map((row) => String(row.id));
        const appealStatusByThread = new Map<string, string>();
        if (threadIds.length > 0) {
            const { data: appeals, error: appealError } = await service
                .from('support_appeals')
                .select('thread_id, status, created_at')
                .in('thread_id', threadIds)
                .order('created_at', { ascending: false })
                .limit(200);
            if (appealError) {
                console.warn('[admin/chat/threads] gagal memuat status banding:', appealError.message);
            }
            for (const appeal of (appeals ?? []) as Array<Record<string, unknown>>) {
                const threadId = String(appeal.thread_id);
                if (!appealStatusByThread.has(threadId)) {
                    appealStatusByThread.set(threadId, String(appeal.status));
                }
            }
        }
        return NextResponse.json({
            threads: rows.map((row) => {
                const profile = (row.profile ?? null) as Record<string, unknown> | null;
                return {
                    id: String(row.id),
                    email: String(row.email ?? ''),
                    status: String(row.status ?? 'open'),
                    origin: String(row.origin ?? 'chat'),
                    profileId: row.profile_id ? String(row.profile_id) : null,
                    userName: profile?.full_name ? String(profile.full_name) : null,
                    userRole: profile?.role ? String(profile.role) : null,
                    userAccountStatus: profile?.account_status
                        ? String(profile.account_status)
                        : null,
                    userAvatarUrl: profile?.avatar_url ? String(profile.avatar_url) : null,
                    lastMessageAt: row.last_message_at ? String(row.last_message_at) : null,
                    lastMessagePreview: row.last_message_preview
                        ? String(row.last_message_preview)
                        : null,
                    lastSenderKind: row.last_sender_kind ? String(row.last_sender_kind) : null,
                    adminUnreadCount: Number(row.admin_unread_count ?? 0),
                    userUnreadCount: Number(row.user_unread_count ?? 0),
                    latestAppealStatus: appealStatusByThread.get(String(row.id)) ?? null,
                };
            }),
            total: count ?? rows.length,
            limit,
            offset,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/chat/threads] unexpected', err);
        return NextResponse.json({ error: 'Gagal memuat daftar percakapan.' }, { status: 500 });
    }
}
