import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getUserFromBearer } from '@/lib/server/supabase';
import { AVATAR_ALLOWED_EXTENSIONS, avatarExtension, avatarFileError, } from '@/lib/admin-avatar';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }
    let form: FormData;
    try {
        form = await req.formData();
    }
    catch {
        return NextResponse.json({ error: 'Body harus multipart/form-data.' }, { status: 400 });
    }
    const file = form.get('file');
    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Field `file` wajib diisi.' }, { status: 400 });
    }
    const masalah = avatarFileError(file);
    if (masalah) {
        return NextResponse.json({ error: masalah }, { status: 400 });
    }
    const ext = avatarExtension(file);
    const path = `${user.id}/avatar.${ext}`;
    const service = createServiceClient();
    const { error: uploadError } = await service.storage
        .from('avatars')
        .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
    });
    if (uploadError) {
        console.error('[profile/avatar] upload error', uploadError.message);
        return NextResponse.json({ error: 'Gagal upload foto.' }, { status: 500 });
    }
    const { data: { publicUrl }, } = service.storage.from('avatars').getPublicUrl(path);
    const finalUrl = `${publicUrl}?t=${Date.now()}`;
    const { data: updated, error: updErr } = await service
        .from('profiles')
        .update({ avatar_url: finalUrl })
        .eq('id', user.id)
        .select('id, email, full_name, role, phone, avatar_url, is_verified, created_at')
        .maybeSingle();
    let profile = updated as Record<string, unknown> | null;
    if (!profile && !updErr) {
        const { data: inserted, error: insErr } = await service
            .from('profiles')
            .insert({
            id: user.id,
            email: user.email ?? '',
            avatar_url: finalUrl,
        } as Record<string, unknown>)
            .select('id, email, full_name, role, phone, avatar_url, is_verified, created_at')
            .maybeSingle();
        if (insErr) {
            console.error('[profile/avatar] insert profiles error', insErr.message);
            return NextResponse.json({ error: 'Gagal menyimpan ke profil.' }, { status: 500 });
        }
        profile = inserted as Record<string, unknown> | null;
    }
    else if (updErr) {
        console.error('[profile/avatar] update profiles error', updErr.message);
        return NextResponse.json({ error: 'Gagal menyimpan ke profil.' }, { status: 500 });
    }
    try {
        await service.auth.admin.updateUserById(user.id, {
            user_metadata: { avatar_url: finalUrl },
        });
    }
    catch (e) {
        console.error('[profile/avatar] metadata sync error', e);
    }
    return NextResponse.json({ publicUrl: finalUrl, profile });
}
export async function DELETE(req: NextRequest) {
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }
    const service = createServiceClient();
    const paths = AVATAR_ALLOWED_EXTENSIONS.map((ext) => `${user.id}/avatar.${ext}`);
    const { error: removeError } = await service.storage.from('avatars').remove(paths);
    if (removeError) {
        console.error('[profile/avatar] remove error', removeError.message);
        return NextResponse.json({ error: 'Gagal menghapus foto.' }, { status: 500 });
    }
    const { error: updErr } = await service
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);
    if (updErr) {
        console.error('[profile/avatar] clear avatar_url error', updErr.message);
        return NextResponse.json({ error: 'Gagal menyimpan perubahan profil.' }, { status: 500 });
    }
    try {
        await service.auth.admin.updateUserById(user.id, {
            user_metadata: { avatar_url: null },
        });
    }
    catch (e) {
        console.error('[profile/avatar] metadata sync error', e);
    }
    return NextResponse.json({ avatar_url: null });
}
