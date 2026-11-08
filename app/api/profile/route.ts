import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getUserFromBearer } from '@/lib/server/supabase';
export const runtime = 'nodejs';
type ProfileRow = {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    phone: string | null;
    avatar_url: string | null;
    is_verified: boolean;
    created_at: string;
};
export async function GET(req: NextRequest) {
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }
    const service = createServiceClient();
    const { data: row, error } = await service
        .from('profiles')
        .select('id, email, full_name, role, phone, avatar_url, is_verified, created_at')
        .eq('id', user.id)
        .maybeSingle();
    if (error) {
        console.error('[profile] GET error', error.message);
        return NextResponse.json({ error: 'Gagal mengambil profil.' }, { status: 500 });
    }
    if (row) {
        return NextResponse.json({ profile: row as ProfileRow });
    }
    const { data: authUser } = await service.auth.admin.getUserById(user.id);
    const meta = (authUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
    return NextResponse.json({
        profile: {
            id: user.id,
            email: user.email ?? '',
            full_name: (meta.full_name as string | undefined) ?? null,
            role: (meta.role as string | undefined) ?? 'buyer',
            phone: (meta.phone as string | undefined) ?? null,
            avatar_url: (meta.avatar_url as string | undefined) ?? null,
            is_verified: false,
            created_at: authUser?.user?.created_at ?? new Date().toISOString(),
        } satisfies ProfileRow,
    });
}
export async function PATCH(req: NextRequest) {
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }
    const body = (await req.json().catch(() => null)) as {
        fullName?: string;
        phone?: string;
    } | null;
    const fullName = body?.fullName?.trim();
    const phone = body?.phone?.trim();
    if (fullName !== undefined && fullName !== null && fullName.length === 0) {
        return NextResponse.json({ error: 'Nama tidak boleh kosong.' }, { status: 400 });
    }
    const service = createServiceClient();
    const update: Record<string, unknown> = {};
    if (fullName)
        update.full_name = fullName;
    if (phone !== undefined && phone !== null)
        update.phone = phone || null;
    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'Tidak ada perubahan.' }, { status: 400 });
    }
    const { data: updated, error: updErr } = await service
        .from('profiles')
        .update(update)
        .eq('id', user.id)
        .select('id, email, full_name, role, phone, avatar_url, is_verified, created_at')
        .maybeSingle();
    let profile = updated as ProfileRow | null;
    if (!profile && !updErr) {
        const { data: authUser } = await service.auth.admin.getUserById(user.id);
        const meta = (authUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
        const { data: inserted, error: insErr } = await service
            .from('profiles')
            .insert({
            id: user.id,
            email: user.email ?? '',
            full_name: fullName ?? (meta.full_name as string | undefined) ?? null,
            phone: phone ?? (meta.phone as string | undefined) ?? null,
        } as Record<string, unknown>)
            .select('id, email, full_name, role, phone, avatar_url, is_verified, created_at')
            .maybeSingle();
        if (insErr) {
            console.error('[profile] PATCH insert error', insErr.message);
            return NextResponse.json({ error: 'Gagal menyimpan profil.' }, { status: 500 });
        }
        profile = inserted as ProfileRow | null;
    }
    else if (updErr) {
        console.error('[profile] PATCH update error', updErr.message);
        return NextResponse.json({ error: 'Gagal menyimpan profil.' }, { status: 500 });
    }
    const metaUpdate: Record<string, unknown> = {};
    if (fullName)
        metaUpdate.full_name = fullName;
    if (phone !== undefined && phone !== null)
        metaUpdate.phone = phone || null;
    if (Object.keys(metaUpdate).length > 0) {
        const { error: metaErr } = await service.auth.admin.updateUserById(user.id, {
            user_metadata: metaUpdate,
        });
        if (metaErr) {
            console.error('[profile] PATCH metadata sync error', metaErr.message);
        }
    }
    return NextResponse.json({ profile });
}
