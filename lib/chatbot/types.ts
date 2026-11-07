export type ChatProfile = 'publik' | 'anggota' | 'admin';
export interface PendingAction {
    token: string;
    action: string;
    label: string;
    summary: string;
    targetType: string;
    targetId: string | null;
    expiresAt: string;
}
export interface ChatReply {
    reply: string;
    profile: ChatProfile;
    pendingActions: PendingAction[];
    toolsUnavailable: boolean;
    sessionId: string | null;
    blocked: boolean;
}
export interface ChatMessageView {
    role: 'user' | 'assistant';
    content: string;
    pendingActions?: PendingAction[];
    blocked?: boolean;
}
export const CHAT_MAX_INPUT_CHARS = 2000;
export const CHAT_CONTEXT_MESSAGES = 20;
export const CHAT_MAX_TOOL_ROUNDS = 3;
export function isChatProfile(value: unknown): value is ChatProfile {
    return value === 'publik' || value === 'anggota' || value === 'admin';
}
