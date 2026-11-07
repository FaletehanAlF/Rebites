'use client';
import { supabase } from './supabase';
export const STORE_ACTIVATION_UPDATED_EVENT = 'rebites-store-activation-updated';
export type StoreActivationRequestStatus = 'pending' | 'approved' | 'rejected';
export interface StoreActivationRequest {
    id: string;
    status: StoreActivationRequestStatus;
    message: string;
    decisionNote: string | null;
    decidedAt: string | null;
    createdAt: string;
}
export interface StoreActivationState {
    umkmId: string;
    businessName: string;
    isActive: boolean;
    deactivationReason: string | null;
    deactivatedAt: string | null;
    request: StoreActivationRequest | null;
}
export function dispatchStoreActivationUpdated(): void {
    if (typeof window === 'undefined')
        return;
    window.dispatchEvent(new Event(STORE_ACTIVATION_UPDATED_EVENT));
}
type Row = Record<string, unknown>;
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
function rowToRequest(row: Row): StoreActivationRequest {
    const status = asString(row.status);
    return {
        id: asString(row.id) ?? '',
        status: status === 'approved' || status === 'rejected' ? status : 'pending',
        message: asString(row.message) ?? '',
        decisionNote: asString(row.decision_note),
        decidedAt: asString(row.decided_at),
        createdAt: asString(row.created_at) ?? '',
    };
}
export async function getStoreActivationState(): Promise<StoreActivationState | null> {
    const { data: { session }, } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid)
        return null;
    const { data: umkmRows, error: umkmErr } = await supabase
        .from('umkm_profiles')
        .select('id, business_name, is_active, deactivation_reason, deactivated_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(1);
    if (umkmErr) {
        console.error('[store-activation] gagal memuat status toko:', umkmErr.message);
        return null;
    }
    const umkm = (umkmRows?.[0] ?? null) as Row | null;
    if (!umkm)
        return null;
    const umkmId = asString(umkm.id);
    if (!umkmId)
        return null;
    const { data: requestRows, error: requestErr } = await supabase
        .from('store_activation_requests')
        .select('id, status, message, decision_note, decided_at, created_at')
        .eq('umkm_id', umkmId)
        .order('created_at', { ascending: false })
        .limit(1);
    if (requestErr) {
        console.error('[store-activation] gagal memuat permintaan aktivasi:', requestErr.message);
    }
    const request = ((requestRows?.[0] ?? null) as Row | null) ?? null;
    return {
        umkmId,
        businessName: asString(umkm.business_name) ?? '',
        isActive: umkm.is_active !== false,
        deactivationReason: asString(umkm.deactivation_reason),
        deactivatedAt: asString(umkm.deactivated_at),
        request: request ? rowToRequest(request) : null,
    };
}
export async function submitStoreActivationRequest(umkmId: string, message: string): Promise<{
    ok: true;
} | {
    ok: false;
    message: string;
}> {
    const { data: { session }, } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
        return { ok: false, message: 'Sesi tidak ditemukan. Silakan login ulang.' };
    }
    const { error } = await supabase.from('store_activation_requests').insert({
        umkm_id: umkmId,
        requested_by: uid,
        message: message.trim(),
    });
    if (error) {
        const code = (error as {
            code?: string;
        }).code ?? '';
        if (code === '23505') {
            return {
                ok: false,
                message: 'Permintaan aktivasi Anda sebelumnya masih menunggu keputusan admin.',
            };
        }
        if (code === '22023') {
            return { ok: false, message: 'Toko Anda sudah aktif; permintaan tidak diperlukan.' };
        }
        if (code === '42501') {
            return { ok: false, message: 'Hanya pemilik toko yang dapat mengajukan aktivasi.' };
        }
        console.error('[store-activation] gagal mengirim permintaan:', error.message);
        return { ok: false, message: 'Gagal mengirim permintaan. Periksa koneksi lalu coba lagi.' };
    }
    dispatchStoreActivationUpdated();
    return { ok: true };
}
