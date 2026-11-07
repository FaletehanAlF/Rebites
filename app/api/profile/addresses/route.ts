import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getUserFromBearer } from '@/lib/server/supabase';
import { validateCoordinatePairFields } from '@/lib/location-validation';
export const runtime = 'nodejs';
const ALLOWED_LABELS = ['Rumah', 'Kos', 'Sekolah', 'Lainnya'];
const ADDRESS_COLUMNS = [
    'id',
    'user_id',
    'label',
    'receiver_name',
    'phone',
    'province',
    'city',
    'district',
    'full_address',
    'note',
    'is_selected',
    'postal_code',
    'latitude',
    'longitude',
    'created_at',
].join(', ');
const POSTAL_CODE_RE = /^[0-9]{5}$/;
type AddressPayload = {
    label?: string;
    receiver_name?: string;
    phone?: string;
    province?: string;
    city?: string;
    district?: string;
    full_address?: string;
    note?: string | null;
    is_selected?: boolean;
    postal_code?: string | null;
    latitude?: number | null;
    longitude?: number | null;
};
function pickFields(body: Record<string, unknown>): AddressPayload {
    const out: AddressPayload = {};
    if (typeof body.label === 'string' && ALLOWED_LABELS.includes(body.label))
        out.label = body.label;
    if (typeof body.receiver_name === 'string')
        out.receiver_name = body.receiver_name;
    if (typeof body.phone === 'string')
        out.phone = body.phone;
    if (typeof body.province === 'string')
        out.province = body.province;
    if (typeof body.city === 'string')
        out.city = body.city;
    if (typeof body.district === 'string')
        out.district = body.district;
    if (typeof body.full_address === 'string')
        out.full_address = body.full_address;
    if (typeof body.note === 'string' || body.note === null)
        out.note = body.note as string | null;
    if (typeof body.is_selected === 'boolean')
        out.is_selected = body.is_selected;
    if (typeof body.postal_code === 'string') {
        const trimmed = body.postal_code.trim();
        out.postal_code = trimmed === '' ? null : trimmed;
    }
    else if (body.postal_code === null) {
        out.postal_code = null;
    }
    const coordinatePair = validateCoordinatePairFields(body.latitude, body.longitude);
    if (!coordinatePair.ok) {
        (out as Record<string, unknown>).__coordinatePairError = coordinatePair.error;
    }
    else if (coordinatePair.provided) {
        out.latitude = coordinatePair.latitude;
        out.longitude = coordinatePair.longitude;
    }
    return out;
}
function validateLocationFields(fields: AddressPayload): string | null {
    const raw = fields as Record<string, unknown>;
    if (typeof raw.__coordinatePairError === 'string') {
        return raw.__coordinatePairError;
    }
    if (fields.postal_code !== undefined && fields.postal_code !== null) {
        if (!POSTAL_CODE_RE.test(fields.postal_code)) {
            return 'Kode pos harus 5 digit angka (cth. 16424).';
        }
    }
    return null;
}
async function clearOtherSelected(service: ReturnType<typeof createServiceClient>, userId: string, keepId?: string) {
    let query = service
        .from('addresses')
        .update({ is_selected: false } as Record<string, unknown>)
        .eq('user_id', userId);
    if (keepId)
        query = query.neq('id', keepId);
    await query;
}
export async function GET(req: NextRequest) {
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }
    const service = createServiceClient();
    const { data, error } = await service
        .from('addresses')
        .select(ADDRESS_COLUMNS)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
    if (error) {
        console.error('[profile/addresses] GET error', error.message);
        return NextResponse.json({ error: 'Gagal mengambil alamat.' }, { status: 500 });
    }
    return NextResponse.json({ addresses: data ?? [] });
}
export async function POST(req: NextRequest) {
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
        return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 });
    }
    const fields = pickFields(body);
    const locationError = validateLocationFields(fields);
    delete (fields as Record<string, unknown>).__coordinatePairError;
    if (locationError) {
        return NextResponse.json({ error: locationError }, { status: 400 });
    }
    if (!fields.label || !fields.receiver_name || !fields.full_address) {
        return NextResponse.json({ error: 'label, receiver_name, dan full_address wajib diisi.' }, { status: 400 });
    }
    const service = createServiceClient();
    const { count } = await service
        .from('addresses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
    if (fields.is_selected === undefined) {
        fields.is_selected = (count ?? 0) === 0;
    }
    if (fields.is_selected) {
        await clearOtherSelected(service, user.id);
    }
    const { data, error } = await service
        .from('addresses')
        .insert({ user_id: user.id, ...fields } as Record<string, unknown>)
        .select(ADDRESS_COLUMNS)
        .maybeSingle();
    if (error || !data) {
        console.error('[profile/addresses] POST error', error?.message);
        return NextResponse.json({ error: 'Gagal menambah alamat.' }, { status: 500 });
    }
    return NextResponse.json({ address: data }, { status: 201 });
}
export async function PUT(req: NextRequest) {
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.id !== 'string' || !body.id) {
        return NextResponse.json({ error: 'id alamat wajib diisi.' }, { status: 400 });
    }
    const fields = pickFields(body);
    const locationError = validateLocationFields(fields);
    delete (fields as Record<string, unknown>).__coordinatePairError;
    if (locationError) {
        return NextResponse.json({ error: locationError }, { status: 400 });
    }
    if (Object.keys(fields).length === 0) {
        return NextResponse.json({ error: 'Tidak ada perubahan.' }, { status: 400 });
    }
    const service = createServiceClient();
    if (fields.is_selected) {
        await clearOtherSelected(service, user.id, body.id);
    }
    const { data, error } = await service
        .from('addresses')
        .update(fields as Record<string, unknown>)
        .eq('id', body.id)
        .eq('user_id', user.id)
        .select(ADDRESS_COLUMNS)
        .maybeSingle();
    if (error || !data) {
        console.error('[profile/addresses] PUT error', error?.message);
        return NextResponse.json({ error: 'Gagal memperbarui alamat.' }, { status: 500 });
    }
    return NextResponse.json({ address: data });
}
export async function DELETE(req: NextRequest) {
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }
    const id = req.nextUrl.searchParams.get('id')?.trim();
    if (!id) {
        return NextResponse.json({ error: 'Query param `id` wajib diisi.' }, { status: 400 });
    }
    const service = createServiceClient();
    const { error, count } = await service
        .from('addresses')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('user_id', user.id);
    if (error) {
        console.error('[profile/addresses] DELETE error', error.message);
        return NextResponse.json({ error: 'Gagal menghapus alamat.' }, { status: 500 });
    }
    if ((count ?? 0) === 0) {
        return NextResponse.json({ error: 'Alamat tidak ditemukan.' }, { status: 404 });
    }
    return NextResponse.json({ deleted: count ?? 0 });
}
