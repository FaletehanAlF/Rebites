export class SupabaseUnavailableError extends Error {
    constructor(cause: unknown) {
        super('Supabase tidak terjangkau');
        this.name = 'SupabaseUnavailableError';
        this.cause = cause;
    }
}
function toErrorShape(value: unknown): {
    name?: unknown;
    status?: unknown;
    message?: unknown;
    code?: unknown;
} | null {
    if (typeof value !== 'object' || value === null)
        return null;
    return value as {
        name?: unknown;
        status?: unknown;
        message?: unknown;
        code?: unknown;
    };
}
export function isTransportFailure(error: unknown): boolean {
    const err = toErrorShape(error);
    if (!err)
        return false;
    const code = typeof err.code === 'string' ? err.code.trim() : '';
    if (code)
        return false;
    const message = typeof err.message === 'string' ? err.message : '';
    if (!message)
        return false;
    return (/fetch failed/i.test(message) ||
        /UNABLE_TO_VERIFY_LEAF_SIGNATURE|CERT_HAS_EXPIRED|DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN|ERR_TLS_CERT_ALTNAME_INVALID|CERT_UNTRUSTED/i.test(message) ||
        /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR_/i.test(message) ||
        /AbortError|TimeoutError/i.test(message));
}
export function isSupabaseUnavailable(error: unknown): boolean {
    if (!error)
        return false;
    if (error instanceof SupabaseUnavailableError)
        return true;
    const err = toErrorShape(error);
    if (!err)
        return false;
    if (err.name === 'SupabaseUnavailableError')
        return true;
    if (err.name === 'AuthRetryableFetchError')
        return true;
    if (err.name === 'TimeoutError' || err.name === 'AbortError')
        return true;
    if (typeof err.status === 'number' && err.status === 0)
        return true;
    if (err.message === 'fetch failed')
        return true;
    return isTransportFailure(err);
}
export function firstFailedQuery(entries: ReadonlyArray<readonly [
    string,
    unknown
]>): {
    label: string;
    error: unknown;
} | null {
    for (const [label, result] of entries) {
        if (typeof result !== 'object' || result === null)
            continue;
        if (!('error' in result))
            continue;
        const error = (result as {
            error?: unknown;
        }).error;
        if (error)
            return { label, error };
    }
    return null;
}
export class AdminProfileQueryError extends Error {
    constructor(cause: unknown) {
        super('Query profil admin gagal');
        this.name = 'AdminProfileQueryError';
        this.cause = cause;
    }
}
const REVOKED_ACCOUNT_STATUSES = ['suspended', 'banned'] as const;
export type AdminProfileVerdict = {
    status: 'admin';
} | {
    status: 'not-admin';
} | {
    status: 'unavailable';
    error: unknown;
} | {
    status: 'profile-error';
    error: unknown;
};
export function classifyAdminProfile(data: unknown, error: unknown): AdminProfileVerdict {
    if (error) {
        return isSupabaseUnavailable(error)
            ? { status: 'unavailable', error }
            : { status: 'profile-error', error };
    }
    if (typeof data !== 'object' || data === null)
        return { status: 'not-admin' };
    const profile = data as {
        role?: unknown;
        account_status?: unknown;
        deleted_at?: unknown;
    };
    if (profile.role !== 'admin')
        return { status: 'not-admin' };
    const deletedAt = profile.deleted_at;
    if (deletedAt !== null && deletedAt !== undefined) {
        if (typeof deletedAt !== 'string' || deletedAt.trim() !== '') {
            return { status: 'not-admin' };
        }
    }
    const accountStatus = typeof profile.account_status === 'string'
        ? profile.account_status.trim().toLowerCase()
        : null;
    if (accountStatus !== null &&
        (REVOKED_ACCOUNT_STATUSES as readonly string[]).includes(accountStatus)) {
        return { status: 'not-admin' };
    }
    return { status: 'admin' };
}
