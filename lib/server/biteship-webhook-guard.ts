export type BiteshipWebhookVerdict =
    | { action: 'probe' }
    | { action: 'misconfigured' }
    | { action: 'unauthorized' }
    | { action: 'invalid-json' }
    | { action: 'ready'; payload: Record<string, unknown> };

export interface BiteshipWebhookGuardInput {
    rawBody: string;
    providedSecret: string | null;
    expectedSecret: string | null;
}

function trimToNull(value: string | null): string | null {
    const trimmed = value?.trim() ?? '';
    return trimmed ? trimmed : null;
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length)
        return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

function hasEventShape(body: string): boolean {
    if (!body)
        return false;
    try {
        const parsed: unknown = JSON.parse(body);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            return false;
        const event = (parsed as Record<string, unknown>).event;
        return typeof event === 'string' && event.trim() !== '';
    }
    catch {
        return false;
    }
}

export function classifyBiteshipWebhookRequest(input: BiteshipWebhookGuardInput): BiteshipWebhookVerdict {
    const body = input.rawBody.trim();
    const provided = trimToNull(input.providedSecret);
    const expected = trimToNull(input.expectedSecret);
    if (!provided && !hasEventShape(body)) {
        return { action: 'probe' };
    }
    if (!expected) {
        return { action: 'misconfigured' };
    }
    if (!provided || !timingSafeEqual(provided, expected)) {
        return { action: 'unauthorized' };
    }
    if (!body) {
        return { action: 'probe' };
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    }
    catch {
        return { action: 'invalid-json' };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { action: 'invalid-json' };
    }
    return { action: 'ready', payload: parsed as Record<string, unknown> };
}
