import type { CourierAiContent } from './gemini.ts';
export const HISTORY_MAX_MESSAGES = 10;
export const HISTORY_MAX_MESSAGE_CHARS = 300;
export const HISTORY_MAX_TOTAL_CHARS = 1800;
export interface CourierHistoryRow {
    senderKind: string;
    body: string;
}
export interface BuildHistoryOptions {
    maxMessages?: number;
    maxMessageChars?: number;
    maxTotalChars?: number;
}
export function buildHistoryContents(rows: CourierHistoryRow[], options: BuildHistoryOptions = {}): CourierAiContent[] {
    const maxMessages = options.maxMessages ?? HISTORY_MAX_MESSAGES;
    const maxMessageChars = options.maxMessageChars ?? HISTORY_MAX_MESSAGE_CHARS;
    const maxTotalChars = options.maxTotalChars ?? HISTORY_MAX_TOTAL_CHARS;
    const cleaned: CourierAiContent[] = [];
    for (const row of rows) {
        const role = row.senderKind === 'ai_courier' || row.senderKind === 'demo_courier'
            ? 'model'
            : 'user';
        const text = (row.body ?? '').replace(/\s+/g, ' ').trim();
        if (!text)
            continue;
        cleaned.push({
            role,
            parts: [{ text: text.slice(0, maxMessageChars) }],
        });
    }
    const recent = cleaned.slice(-maxMessages);
    let total = 0;
    for (let i = recent.length - 1; i >= 0; i -= 1) {
        const len = recent[i].parts[0].text.length;
        total += len;
        if (total > maxTotalChars) {
            recent.splice(0, i + 1);
            break;
        }
    }
    const merged: CourierAiContent[] = [];
    for (const item of recent) {
        const prev = merged[merged.length - 1];
        if (prev && prev.role === item.role) {
            prev.parts = [{ text: `${prev.parts[0].text}\n${item.parts[0].text}` }];
        }
        else {
            merged.push({ role: item.role, parts: [{ ...item.parts[0] }] });
        }
    }
    const firstUserIdx = merged.findIndex((item) => item.role === 'user');
    if (firstUserIdx === -1)
        return [];
    return merged.slice(firstUserIdx);
}
export function hasBuyerMessage(contents: CourierAiContent[]): boolean {
    return contents.some((c) => c.role === 'user');
}
