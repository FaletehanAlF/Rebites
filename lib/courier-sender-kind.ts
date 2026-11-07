export type CourierSenderKind = 'user' | 'demo_courier' | 'ai_courier';
export function normalizeCourierSenderKind(kind: unknown): CourierSenderKind {
    if (kind === 'demo_courier' || kind === 'ai_courier')
        return kind;
    return 'user';
}
export function isAutomatedSenderKind(kind: unknown): boolean {
    return normalizeCourierSenderKind(kind) !== 'user';
}
export function courierSenderLabel(kind: unknown): string {
    switch (normalizeCourierSenderKind(kind)) {
        case 'demo_courier':
            return 'Kurir Demo';
        case 'ai_courier':
            return 'Kurir AI';
        default:
            return 'Kurir';
    }
}
