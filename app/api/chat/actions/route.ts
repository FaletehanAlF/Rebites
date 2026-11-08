import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser, createAuthedServerClient } from '@/lib/server/supabase';
import { actionErrorMessage, verifyAction } from '@/lib/chatbot/actions';
import { POST as approveProduct } from '@/app/api/admin/products/[id]/approve/route';
import { POST as rejectProduct } from '@/app/api/admin/products/[id]/reject/route';
import { POST as warnProduct } from '@/app/api/admin/products/[id]/warn/route';
import { POST as verifyUmkm } from '@/app/api/admin/umkm/[id]/verify/route';
import { PATCH as patchUmkm } from '@/app/api/admin/umkm/[id]/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    let admin: {
        id: string;
        email: string | null;
    } | null = null;
    try {
        admin = await getAdminUser(authHeader);
    }
    catch {
        return NextResponse.json({ error: 'Tidak dapat memverifikasi status admin saat ini. Coba lagi.' }, { status: 503 });
    }
    if (!admin) {
        return NextResponse.json({ error: 'Akses ditolak. Hanya admin yang dapat menjalankan aksi asisten.' }, { status: 403 });
    }
    if (!authHeader) {
        return NextResponse.json({ error: 'Sesi tidak ditemukan. Silakan login ulang.' }, { status: 401 });
    }
    let body: {
        token?: unknown;
    } | null = null;
    try {
        body = (await req.json()) as {
            token?: unknown;
        };
    }
    catch {
        return NextResponse.json({ error: 'Format permintaan tidak valid.' }, { status: 400 });
    }
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!token) {
        return NextResponse.json({ error: 'Token aksi wajib diisi.' }, { status: 400 });
    }
    let payload;
    try {
        payload = verifyAction(token, admin.id);
    }
    catch (err) {
        return NextResponse.json({ error: actionErrorMessage(err) }, { status: 400 });
    }
    const base = new URL(req.url);
    const headers = new Headers({ authorization: authHeader, 'content-type': 'application/json' });
    const result = await executeAction(payload.action, payload.payload, payload.reason, base, headers, authHeader);
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }
    try {
        const db = createAuthedServerClient(authHeader);
        const { error: auditErr } = await db.from('admin_audit_logs').insert({
            admin_id: admin.id,
            action: payload.action,
            target_type: result.targetType,
            target_id: result.targetId,
            reason: payload.reason,
            metadata: {
                via: 'chatbot',
                payload: payload.payload,
                nonce: payload.nonce,
            },
        });
        if (auditErr) {
            console.error('[chat/actions] audit insert error', auditErr.message);
            return NextResponse.json({
                ok: true,
                message: `${result.message} Namun jejak audit gagal dicatat; catat manual bila perlu.`,
                auditWritten: false,
            });
        }
    }
    catch (err) {
        console.error('[chat/actions] audit unexpected', err instanceof Error ? err.message : err);
        return NextResponse.json({
            ok: true,
            message: `${result.message} Namun jejak audit gagal dicatat; catat manual bila perlu.`,
            auditWritten: false,
        });
    }
    return NextResponse.json({ ok: true, message: result.message, auditWritten: true });
}
interface ExecResult {
    ok: boolean;
    status: number;
    error?: string;
    message: string;
    targetType: string;
    targetId: string | null;
}
async function executeAction(action: string, payload: Record<string, string | number | boolean | null>, reason: string, base: URL, headers: Headers, authHeader: string): Promise<ExecResult> {
    const id = (key: string) => {
        const value = payload[key];
        return typeof value === 'string' ? value.trim() : '';
    };
    const call = async (path: string, method: 'POST' | 'PATCH', body?: unknown): Promise<Response> => {
        const req = new NextRequest(new URL(path, base), {
            method,
            headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const params = { params: { id: id('produk_id') || id('umkm_id') } };
        if (path.startsWith('/api/admin/products') && path.endsWith('/approve')) {
            return approveProduct(req, params);
        }
        if (path.startsWith('/api/admin/products') && path.endsWith('/reject')) {
            return rejectProduct(req, params);
        }
        if (path.startsWith('/api/admin/products') && path.endsWith('/warn')) {
            return warnProduct(req, params);
        }
        if (path.endsWith('/verify')) {
            return verifyUmkm(req, params);
        }
        return patchUmkm(req, params);
    };
    const failure = (status: number, message: string, targetType: string, targetId: string | null): ExecResult => ({
        ok: false,
        status: status >= 400 ? status : 500,
        error: message,
        message,
        targetType,
        targetId,
    });
    const readError = async (res: Response): Promise<string> => {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        return json?.error ?? 'Aksi gagal dijalankan.';
    };
    switch (action) {
        case 'setujui_produk': {
            const produkId = id('produk_id');
            if (!produkId)
                return failure(400, 'ID produk tidak ada pada usulan.', 'product', null);
            const res = await call(`/api/admin/products/${produkId}/approve`, 'POST');
            if (!res.ok)
                return failure(res.status, await readError(res), 'product', produkId);
            return {
                ok: true,
                status: 200,
                message: 'Produk disetujui dan kini tayang di katalog.',
                targetType: 'product',
                targetId: produkId,
            };
        }
        case 'tolak_produk': {
            const produkId = id('produk_id');
            if (!produkId)
                return failure(400, 'ID produk tidak ada pada usulan.', 'product', null);
            const res = await call(`/api/admin/products/${produkId}/reject`, 'POST', { reason });
            if (!res.ok)
                return failure(res.status, await readError(res), 'product', produkId);
            return {
                ok: true,
                status: 200,
                message: 'Produk ditolak dan tidak lagi tayang. Alasan dikirim ke penjual.',
                targetType: 'product',
                targetId: produkId,
            };
        }
        case 'peringatkan_produk': {
            const produkId = id('produk_id');
            if (!produkId)
                return failure(400, 'ID produk tidak ada pada usulan.', 'product', null);
            const res = await call(`/api/admin/products/${produkId}/warn`, 'POST', {
                level: 1,
                category: 'Peringatan moderator',
                reason,
            });
            if (!res.ok)
                return failure(res.status, await readError(res), 'product', produkId);
            return {
                ok: true,
                status: 200,
                message: 'Peringatan terkirim ke penjual.',
                targetType: 'product',
                targetId: produkId,
            };
        }
        case 'set_umkm_aktif': {
            const umkmId = id('umkm_id');
            const aktif = payload.aktif === true;
            if (!umkmId)
                return failure(400, 'ID toko tidak ada pada usulan.', 'umkm', null);
            const res = await call(`/api/admin/umkm/${umkmId}`, 'PATCH', { is_active: aktif });
            if (!res.ok)
                return failure(res.status, await readError(res), 'umkm', umkmId);
            return {
                ok: true,
                status: 200,
                message: aktif
                    ? 'Toko diaktifkan kembali dan tampil di katalog pembeli.'
                    : 'Toko dinonaktifkan dan hilang dari katalog pembeli.',
                targetType: 'umkm',
                targetId: umkmId,
            };
        }
        case 'verifikasi_umkm': {
            const umkmId = id('umkm_id');
            const terverifikasi = payload.terverifikasi === true;
            if (!umkmId)
                return failure(400, 'ID toko tidak ada pada usulan.', 'umkm', null);
            const db = createAuthedServerClient(authHeader);
            const { data: current, error: readErr } = await db
                .from('umkm_profiles')
                .select('is_verified')
                .eq('id', umkmId)
                .maybeSingle();
            if (readErr)
                return failure(500, 'Gagal membaca status verifikasi toko.', 'umkm', umkmId);
            if (!current)
                return failure(404, 'Toko tidak ditemukan.', 'umkm', umkmId);
            const already = current.is_verified === true;
            if (already === terverifikasi) {
                return {
                    ok: true,
                    status: 200,
                    message: terverifikasi
                        ? 'Toko memang sudah terverifikasi; tidak ada perubahan.'
                        : 'Toko memang belum terverifikasi; tidak ada perubahan.',
                    targetType: 'umkm',
                    targetId: umkmId,
                };
            }
            const res = await call(`/api/admin/umkm/${umkmId}/verify`, 'POST');
            if (!res.ok)
                return failure(res.status, await readError(res), 'umkm', umkmId);
            return {
                ok: true,
                status: 200,
                message: terverifikasi ? 'Toko kini terverifikasi.' : 'Verifikasi toko dicabut.',
                targetType: 'umkm',
                targetId: umkmId,
            };
        }
        default:
            return failure(400, 'Jenis aksi tidak dikenali.', 'unknown', null);
    }
}
