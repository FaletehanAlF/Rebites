import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const user = await getUserFromBearer(authHeader);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        const supabase = createAuthedServerClient(authHeader as string);
        const { data, error } = await supabase
            .from('couriers')
            .select('user_id, full_name, phone, vehicle_type, is_active, is_available')
            .eq('user_id', user.id)
            .maybeSingle();
        if (error) {
            console.error('[courier/profile] gagal membaca profil:', error.message);
            return NextResponse.json({ courier: null, schemaReady: false });
        }
        if (!data)
            return NextResponse.json({ courier: null, schemaReady: true });
        return NextResponse.json({
            courier: {
                fullName: String(data.full_name ?? ''),
                phone: data.phone ? String(data.phone) : null,
                vehicleType: String(data.vehicle_type ?? 'motor'),
                isActive: Boolean(data.is_active),
                isAvailable: Boolean(data.is_available),
            },
            schemaReady: true,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[courier/profile] unexpected', err);
        return NextResponse.json({ error: 'Gagal memuat profil kurir.' }, { status: 500 });
    }
}
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const user = await getUserFromBearer(authHeader);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        let body: {
            fullName?: unknown;
            phone?: unknown;
            vehicleType?: unknown;
        };
        try {
            body = await req.json();
        }
        catch {
            return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
        }
        const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
        if (!fullName) {
            return NextResponse.json({ error: 'Nama wajib diisi.' }, { status: 400 });
        }
        if (fullName.length > 80) {
            return NextResponse.json({ error: 'Nama maksimal 80 karakter.' }, { status: 400 });
        }
        const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
        const vehicleTypeRaw = typeof body.vehicleType === 'string' ? body.vehicleType.trim() : 'motor';
        const vehicleType = ['motor', 'mobil', 'sepeda'].includes(vehicleTypeRaw)
            ? vehicleTypeRaw
            : 'motor';
        const supabase = createAuthedServerClient(authHeader as string);
        const { data, error } = await supabase
            .from('couriers')
            .upsert({
            user_id: user.id,
            full_name: fullName,
            phone: phone || null,
            vehicle_type: vehicleType,
            is_active: true,
        }, { onConflict: 'user_id' })
            .select('user_id, full_name, phone, vehicle_type, is_active, is_available')
            .eq('user_id', user.id)
            .maybeSingle();
        if (error) {
            console.error('[courier/profile] gagal mendaftarkan kurir:', error.message);
            return NextResponse.json({ error: 'Gagal mendaftar sebagai kurir.' }, { status: 500 });
        }
        const row = (data ?? {}) as Record<string, unknown>;
        return NextResponse.json({
            courier: {
                fullName: String(row.full_name ?? fullName),
                phone: row.phone ? String(row.phone) : null,
                vehicleType: String(row.vehicle_type ?? vehicleType),
                isActive: Boolean(row.is_active),
                isAvailable: Boolean(row.is_available),
            },
            schemaReady: true,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[courier/profile] unexpected', err);
        return NextResponse.json({ error: 'Gagal mendaftar sebagai kurir.' }, { status: 500 });
    }
}
