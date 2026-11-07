'use client';
import { AdminAuthError, getAdminAuthHeader } from './admin-auth';
export const SANCTION_TYPES = ['suspend', 'ban', 'delete'] as const;
export type SanctionType = (typeof SANCTION_TYPES)[number];
export interface SanctionItem {
    id: string;
    userId: string | null;
    userName: string;
    userEmail: string | null;
    warningId: string | null;
    issuedBy: string | null;
    issuerName: string;
    issuerEmail: string | null;
    sanctionType: string;
    reason: string;
    startAt: string | null;
    endAt: string | null;
    createdAt: string;
}
export interface SanctionsResult {
    sanctions: SanctionItem[];
    total: number;
    limit: number;
    offset: number;
}
export class SanctionsApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'SanctionsApiError';
        this.status = status;
    }
}
async function authHeader(): Promise<string> {
    try {
        return await getAdminAuthHeader();
    }
    catch (err) {
        if (err instanceof AdminAuthError) {
            throw new SanctionsApiError(err.message, 401);
        }
        throw err;
    }
}
export async function fetchSanctions(limit = 20, offset = 0, sanctionType?: SanctionType, filters?: {
    userId?: string;
    warningId?: string;
    from?: string;
    to?: string;
}): Promise<SanctionsResult> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (sanctionType)
        params.set('sanctionType', sanctionType);
    if (filters?.userId)
        params.set('userId', filters.userId);
    if (filters?.warningId)
        params.set('warningId', filters.warningId);
    if (filters?.from)
        params.set('from', filters.from);
    if (filters?.to)
        params.set('to', filters.to);
    const res = await fetch(`/api/admin/sanctions?${params.toString()}`, {
        headers: { Authorization: await authHeader() },
    });
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new SanctionsApiError(json?.error ?? 'Gagal memuat sanksi.', res.status);
    }
    const json = (await res.json().catch(() => null)) as SanctionsResult | null;
    if (!json || !Array.isArray(json.sanctions)) {
        throw new SanctionsApiError('Respons sanksi tidak valid.', 500);
    }
    return json;
}
export async function issueSanction(input: {
    userId: string;
    sanctionType: SanctionType;
    reason: string;
    warningId?: string | null;
    endAt?: string | null;
    durationDays?: number | null;
    confirmText?: string;
}): Promise<void> {
    const res = await fetch('/api/admin/sanctions', {
        method: 'POST',
        headers: {
            Authorization: await authHeader(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new SanctionsApiError(json?.error ?? 'Gagal menyimpan sanksi.', res.status);
    }
}
export async function revokeAllActiveBlocks(blocks: readonly {
    id: string;
}[]): Promise<RevokeActiveBlocksResult> {
    const revoked: string[] = [];
    const failed: {
        id: string;
        message: string;
    }[] = [];
    for (const item of blocks) {
        try {
            await revokeSanction(item.id);
            revoked.push(item.id);
        }
        catch (err) {
            failed.push({
                id: item.id,
                message: err instanceof Error ? err.message : 'Gagal mencabut sanksi.',
            });
        }
    }
    return { revoked, failed };
}
export interface RevokeActiveBlocksResult {
    revoked: string[];
    failed: {
        id: string;
        message: string;
    }[];
}
export async function revokeSanction(sanctionId: string): Promise<{
    endedAt: string | null;
}> {
    const res = await fetch(`/api/admin/sanctions/${encodeURIComponent(sanctionId)}`, {
        method: 'PATCH',
        headers: {
            Authorization: await authHeader(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'revoke' }),
    });
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new SanctionsApiError(json?.error ?? 'Gagal mencabut sanksi.', res.status);
    }
    const json = (await res.json().catch(() => null)) as {
        sanction?: {
            endedAt?: string;
        };
    } | null;
    return { endedAt: json?.sanction?.endedAt ?? null };
}
