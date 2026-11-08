export const DUPLICATE_EMAIL_MESSAGE = 'Email sudah terdaftar. Silakan login menggunakan akun tersebut.';
const DUPLICATE_ERROR_CODES = ['user_already_exists', 'email_exists'];
const DUPLICATE_MESSAGE_HINTS = [
    'user already registered',
    'already been registered',
    'already registered',
];
export interface SignUpDuplicateInput {
    error?: unknown;
    identities?: unknown;
    hasSession?: boolean;
}
export function isDuplicateEmailSignUp(input: SignUpDuplicateInput): boolean {
    for (const signal of errorSignals(input.error)) {
        const text = signal.toLowerCase();
        if (DUPLICATE_ERROR_CODES.includes(text))
            return true;
        if (DUPLICATE_MESSAGE_HINTS.some((hint) => text.includes(hint)))
            return true;
    }
    return Array.isArray(input.identities) && input.identities.length === 0;
}
function errorSignals(error: unknown): string[] {
    if (error === null || error === undefined)
        return [];
    if (typeof error === 'string')
        return error ? [error] : [];
    if (typeof error !== 'object')
        return [];
    const source = error as {
        code?: unknown;
        error_code?: unknown;
        message?: unknown;
        error_description?: unknown;
    };
    return [source.code, source.error_code, source.message, source.error_description].filter((value): value is string => typeof value === 'string' && value.length > 0);
}
