import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';

export const runtime = 'nodejs';

/**
 * GET  /api/courier/profile — status pendaftaran kurir untuk user yang login.
 * POST /api/courier/profile — daftar sebagai kurir.
 *
 * PENDAFTARAN
 * - User mendaftarkan DIRI SENDIRI. Baris dibuat dengan `user_id` = pemanggil,
 *   jadi tidak mungkin mendaftarkan akun orang lain.
 * - Satu user = satu baris (primary key `user_id`). Pendaftaran kedua
 *   memperbarui data, bukan membuat duplikat.
 * - Notifikasi ke admin TIDAK dibuat di sini: it'd perlu jenis notifikasi
 *   baru dan alur persetujuan. Untuk sekarang pendaftaran langsung aktif.
 *   Ini keputusan yang bisa diubah nanti tanpa mengubah skema.
 *
 * Keamanan: baris kurir tidak memberi akses ke data apa pun yang belum
 * punya policy-nya sendiri. Daftarnya hanya berisi identitas dan status.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Silakan login ulang.' },
        { status: 401 }
      );
    }

    const supabase = createAuthedServerClient(authHeader as string);
    const { data, error } = await supabase
      .from('couriers')
      .select('user_id, full_name, phone, vehicle_type, is_active, is_available')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      // Tabel `couriers` belum ada (migrasi belum dijalankan). Itu kondisi
      // yang diharapkan, bukan kegagalan: jawab "belum terdaftar".
      console.error('[courier/profile] gagal membaca profil:', error.message);
      return NextResponse.json({ courier: null, schemaReady: false });
    }

    if (!data) return NextResponse.json({ courier: null, schemaReady: true });

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
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[courier/profile] unexpected', err);
    return NextResponse.json({ error: 'Gagal memuat profil kurir.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Silakan login ulang.' },
        { status: 401 }
      );
    }

    let body: { fullName?: unknown; phone?: unknown; vehicleType?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
    }

    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    if (!fullName) {
      return NextResponse.json({ error: 'Nama wajib diisi.' }, { status: 400 });
    }
    if (fullName.length > 80) {
      return NextResponse.json(
        { error: 'Nama maksimal 80 karakter.' },
        { status: 400 }
      );
    }

    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const vehicleTypeRaw =
      typeof body.vehicleType === 'string' ? body.vehicleType.trim() : 'motor';
    const vehicleType = ['motor', 'mobil', 'sepeda'].includes(vehicleTypeRaw)
      ? vehicleTypeRaw
      : 'motor';

    const supabase = createAuthedServerClient(authHeader as string);

    const { data, error } = await supabase
      .from('couriers')
      .upsert(
        {
          user_id: user.id,
          full_name: fullName,
          phone: phone || null,
          vehicle_type: vehicleType,
          // Pendaftaran ulang TIDAK boleh resurrected akun yang sengaja
          // dinonaktifkan admin.
          is_active: true,
        },
        { onConflict: 'user_id' }
      )
      .select('user_id, full_name, phone, vehicle_type, is_active, is_available')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[courier/profile] gagal mendaftarkan kurir:', error.message);
      return NextResponse.json(
        { error: 'Gagal mendaftar sebagai kurir.' },
        { status: 500 }
      );
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
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[courier/profile] unexpected', err);
    return NextResponse.json({ error: 'Gagal mendaftar sebagai kurir.' }, { status: 500 });
  }
}
