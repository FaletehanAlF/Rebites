'use client';
import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';
export interface AdminSupportThread {
    id: string;
    email: string;
    status: 'open' | 'closed' | string;
    origin: string;
    profileId: string | null;
    userName: string | null;
    userRole: string | null;
    userAccountStatus: string | null;
    userAvatarUrl?: string | null;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    lastSenderKind: string | null;
    adminUnreadCount: number;
    userUnreadCount: number;
    latestAppealStatus: string | null;
}
export interface AdminSupportThreadsResult {
    threads: AdminSupportThread[];
    total: number;
    limit: number;
    offset: number;
}
export interface AdminSupportThreadFilters {
    limit?: number;
    offset?: number;
    search?: string;
    status?: '' | 'open' | 'closed' | 'unread';
}
export interface AdminSupportMessage {
    id: string;
    senderKind: string;
    senderUserId: string | null;
    channel: string;
    body: string;
    createdAt: string | null;
}
export interface AdminSupportAppeal {
    id: string;
    email: string;
    status: string;
    message: string;
    decisionNote: string | null;
    decidedAt: string | null;
    createdAt: string;
}
export interface AdminSupportActiveBlock {
    id: string;
    sanctionType: string;
    reason: string;
    endAt: string | null;
}
export interface AdminSupportThreadDetail {
    thread: {
        id: string;
        email: string;
        status: string;
        origin: string;
        profileId: string | null;
        adminUnreadCount: number;
        createdAt: string | null;
        lastMessageAt: string | null;
    };
    profile: {
        id: string;
        fullName: string | null;
        email: string | null;
        role: string | null;
        accountStatus: string | null;
        deletedAt: string | null;
        avatarUrl?: string | null;
    } | null;
    messages: AdminSupportMessage[];
    appeals: AdminSupportAppeal[];
    activeBlocks: AdminSupportActiveBlock[];
}
export class AdminSupportApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'AdminSupportApiError';
        this.status = status;
    }
}
async function request(path: string, init?: RequestInit): Promise<Response> {
    try {
        return await fetchAdminWithAuth(path, { cache: 'no-store', ...init });
    }
    catch (err) {
        if (err instanceof AuthError) {
            throw new AdminSupportApiError(err.message, err.status);
        }
        throw err;
    }
}
async function readError(res: Response, fallback: string): Promise<never> {
    const json = (await res.json().catch(() => null)) as {
        error?: string;
    } | null;
    throw new AdminSupportApiError(json?.error ?? fallback, res.status);
}
export async function fetchAdminSupportThreads(filters: AdminSupportThreadFilters = {}): Promise<AdminSupportThreadsResult> {
    const { limit = 20, offset = 0, search = '', status = '' } = filters;
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search.trim())
        params.set('search', search.trim());
    if (status)
        params.set('status', status);
    const res = await request(`/api/admin/chat/threads?${params.toString()}`);
    if (!res.ok)
        await readError(res, 'Gagal memuat daftar percakapan.');
    const json = (await res.json().catch(() => null)) as AdminSupportThreadsResult | null;
    if (!json || !Array.isArray(json.threads)) {
        throw new AdminSupportApiError('Respons daftar percakapan tidak valid.', 500);
    }
    return {
        threads: json.threads,
        total: json.total ?? json.threads.length,
        limit: json.limit ?? limit,
        offset: json.offset ?? offset,
    };
}
export async function fetchAdminSupportThread(id: string): Promise<AdminSupportThreadDetail> {
    const res = await request(`/api/admin/chat/threads/${encodeURIComponent(id)}`);
    if (!res.ok)
        await readError(res, 'Gagal memuat percakapan.');
    const json = (await res.json().catch(() => null)) as AdminSupportThreadDetail | null;
    if (!json?.thread || !Array.isArray(json.messages)) {
        throw new AdminSupportApiError('Respons percakapan tidak valid.', 500);
    }
    return {
        ...json,
        appeals: Array.isArray(json.appeals) ? json.appeals : [],
        activeBlocks: Array.isArray(json.activeBlocks) ? json.activeBlocks : [],
    };
}
export async function sendAdminSupportReply(id: string, message: string): Promise<AdminSupportMessage> {
    const res = await request(`/api/admin/chat/threads/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    });
    if (!res.ok)
        await readError(res, 'Gagal mengirim balasan.');
    const json = (await res.json().catch(() => null)) as {
        message?: AdminSupportMessage;
    } | null;
    if (!json?.message) {
        throw new AdminSupportApiError('Respons balasan tidak valid.', 500);
    }
    return json.message;
}
export async function markAdminSupportRead(id: string): Promise<void> {
    const res = await request(`/api/admin/chat/threads/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read' }),
    });
    if (!res.ok)
        await readError(res, 'Gagal menandai sudah dibaca.');
}
export async function setAdminSupportThreadStatus(id: string, action: 'close' | 'reopen'): Promise<void> {
    const res = await request(`/api/admin/chat/threads/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
    });
    if (!res.ok)
        await readError(res, 'Gagal mengubah status percakapan.');
}
export async function decideAdminSupportAppeal(threadId: string, input: {
    appealId: string;
    status: 'reviewing' | 'approved' | 'rejected';
    note: string;
}): Promise<void> {
    const res = await request(`/api/admin/chat/threads/${encodeURIComponent(threadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'appeal_decision',
            appealId: input.appealId,
            status: input.status,
            note: input.note,
        }),
    });
    if (!res.ok)
        await readError(res, 'Gagal menyimpan keputusan banding.');
}
