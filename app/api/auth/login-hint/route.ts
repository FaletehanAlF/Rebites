import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/server/supabase';

export const runtime = 'nodejs';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const MAX_PAGES = 5;
const PAGE_SIZE = 1000;

type Bucket = {
    count: number;
    resetAt: number;
};

const buckets = new Map<string, Bucket>();

function clientKey(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) {
        const first = forwarded.split(',')[0]?.trim();
        if (first)
            return first;
    }
    return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function overLimit(key: string): boolean {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return false;
    }
    bucket.count += 1;
    return bucket.count > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
    if (overLimit(clientKey(req))) {
        return NextResponse.json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' }, { status: 429 });
    }
    const body = (await req.json().catch(() => null)) as {
        email?: string;
    } | null;
    const raw = body?.email?.trim() ?? '';
    if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
    }
    const target = raw.toLowerCase();
    const service = createServiceClient();
    try {
        for (let page = 1; page <= MAX_PAGES; page += 1) {
            const { data, error } = await service.auth.admin.listUsers({
                page,
                perPage: PAGE_SIZE,
            });
            if (error) {
                console.error('[login-hint] gagal membaca daftar akun', error.message);
                return NextResponse.json({ error: 'Gagal memeriksa email.' }, { status: 500 });
            }
            const users = data?.users ?? [];
            if (users.some((u) => (u.email ?? '').toLowerCase() === target)) {
                return NextResponse.json({ registered: true });
            }
            if (users.length < PAGE_SIZE)
                return NextResponse.json({ registered: false });
        }
    }
    catch (err) {
        console.error('[login-hint] tidak dapat menghubungi Supabase', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Gagal memeriksa email.' }, { status: 500 });
    }
    return NextResponse.json({ registered: false });
}
