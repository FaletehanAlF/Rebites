import { createServiceClient } from '@/lib/server/supabase';
import type { ChatProfile, PendingAction } from './types';
import { CHAT_CONTEXT_MESSAGES } from './types';
const DB_TIMEOUT_MS = 12000;
export interface StoredMessage {
    role: 'user' | 'assistant';
    content: string;
    pendingActions?: PendingAction[];
}
export class ChatHistoryUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChatHistoryUnavailableError';
    }
}
function storableProfile(profile: ChatProfile): 'anggota' | 'admin' | null {
    if (profile === 'anggota')
        return 'anggota';
    if (profile === 'admin')
        return 'admin';
    return null;
}
export async function ensureSession(userId: string, profile: ChatProfile, sessionId?: string | null): Promise<string | null> {
    const stored = storableProfile(profile);
    if (!stored)
        return null;
    const db = createServiceClient(DB_TIMEOUT_MS);
    if (sessionId) {
        const { data: existing, error } = await db
            .from('chat_sessions')
            .select('id, user_id')
            .eq('id', sessionId)
            .maybeSingle();
        if (error)
            throw new ChatHistoryUnavailableError(error.message);
        if (existing && existing.user_id === userId) {
            await db
                .from('chat_sessions')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', sessionId);
            return sessionId;
        }
    }
    const { data, error } = await db
        .from('chat_sessions')
        .insert({ user_id: userId, profile: stored })
        .select('id')
        .single();
    if (error)
        throw new ChatHistoryUnavailableError(error.message);
    return (data?.id as string) ?? null;
}
export async function appendMessage(sessionId: string, message: StoredMessage): Promise<boolean> {
    const db = createServiceClient(DB_TIMEOUT_MS);
    const { error } = await db.from('chat_messages').insert({
        session_id: sessionId,
        role: message.role,
        content: message.content,
        pending_actions: message.pendingActions?.length ? message.pendingActions : null,
    });
    if (error)
        return false;
    await db
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    return true;
}
export async function loadRecentMessages(sessionId: string): Promise<StoredMessage[]> {
    const db = createServiceClient(DB_TIMEOUT_MS);
    const { data, error } = await db
        .from('chat_messages')
        .select('role, content, pending_actions, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(CHAT_CONTEXT_MESSAGES);
    if (error)
        return [];
    return (data ?? [])
        .slice()
        .reverse()
        .map((row) => ({
        role: row.role as 'user' | 'assistant',
        content: String(row.content ?? ''),
        pendingActions: Array.isArray(row.pending_actions)
            ? (row.pending_actions as PendingAction[])
            : undefined,
    }));
}
