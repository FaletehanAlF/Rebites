import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getUserFromBearer } from '@/lib/server/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }
    const service = createServiceClient();
    const { data: store, error: storeError } = await service
        .from('umkm_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
    if (storeError) {
        console.error('[seller-role] gagal membaca toko', storeError.message);
        return NextResponse.json({ error: 'Gagal memeriksa toko.' }, { status: 500 });
    }
    if (!store) {
        return NextResponse.json({ error: 'Akun ini belum memiliki toko.' }, { status: 409 });
    }
    const { data: profile, error: profileError } = await service
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
    if (profileError) {
        console.error('[seller-role] gagal membaca peran', profileError.message);
        return NextResponse.json({ error: 'Gagal membaca peran akun.' }, { status: 500 });
    }
    const currentRole = (profile as {
        role?: string;
    } | null)?.role ?? '';
    if (currentRole === 'umkm' || currentRole === 'admin') {
        return NextResponse.json({ role: currentRole, changed: false });
    }
    if (currentRole !== 'buyer') {
        return NextResponse.json({ error: 'Peran akun ini tidak dapat dinaikkan dari sini.' }, { status: 409 });
    }
    const { data: updated, error: updateError } = await service
        .from('profiles')
        .update({ role: 'umkm' })
        .eq('id', user.id)
        .eq('role', 'buyer')
        .select('role')
        .maybeSingle();
    if (updateError) {
        console.error('[seller-role] gagal menaikkan peran', updateError.message);
        return NextResponse.json({ error: 'Gagal menaikkan peran akun.' }, { status: 500 });
    }
    return NextResponse.json({
        role: (updated as {
            role?: string;
        } | null)?.role ?? 'umkm',
        changed: true,
    });
}
