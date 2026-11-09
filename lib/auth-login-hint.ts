export const EMAIL_NOT_REGISTERED_MESSAGE = 'Email ini belum terdaftar di ReBites. Silakan daftar akun dulu, lalu masuk.';
export const INVALID_CREDENTIALS_MESSAGE = 'Email atau kata sandi salah.';

export function isInvalidCredentialsMessage(rawMessage: string): boolean {
    const msg = (rawMessage || '').toLowerCase();
    return msg.includes('invalid login credentials') || msg.includes('invalid_credentials');
}

export async function lookupEmailRegistered(email: string): Promise<boolean | null> {
    const target = email.trim();
    if (!target)
        return null;
    try {
        const res = await fetch('/api/auth/login-hint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: target }),
        });
        if (!res.ok)
            return null;
        const json = (await res.json().catch(() => null)) as {
            registered?: unknown;
        } | null;
        return typeof json?.registered === 'boolean' ? json.registered : null;
    }
    catch {
        return null;
    }
}

export function loginErrorMessageFor(rawMessage: string, registered: boolean | null): string {
    if (isInvalidCredentialsMessage(rawMessage) && registered === false) {
        return EMAIL_NOT_REGISTERED_MESSAGE;
    }
    if (isInvalidCredentialsMessage(rawMessage)) {
        return INVALID_CREDENTIALS_MESSAGE;
    }
    return rawMessage;
}
