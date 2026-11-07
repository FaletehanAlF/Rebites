export type DemoStageStatus = 'processing' | 'out_for_delivery' | 'ready_for_pickup' | 'completed';
export interface DemoStage {
    status: DemoStageStatus;
    afterMinutes: number;
    note: string;
    assignmentStatus: 'assigned' | 'picked_up' | 'delivering' | 'completed';
}
export const DEMO_DELIVERY_SCHEDULE: readonly DemoStage[] = [
    {
        status: 'processing',
        afterMinutes: 0,
        note: 'Penjual mulai menyiapkan pesanan (kurir demo).',
        assignmentStatus: 'assigned',
    },
    {
        status: 'out_for_delivery',
        afterMinutes: 2,
        note: 'Kurir demo mulai mengantar ke alamat tujuan.',
        assignmentStatus: 'delivering',
    },
    {
        status: 'completed',
        afterMinutes: 6,
        note: 'Pesanan tiba di tujuan (kurir demo).',
        assignmentStatus: 'completed',
    },
];
export const DEMO_PICKUP_SCHEDULE: readonly DemoStage[] = [
    {
        status: 'processing',
        afterMinutes: 0,
        note: 'Penjual mulai menyiapkan pesanan (demo).',
        assignmentStatus: 'assigned',
    },
    {
        status: 'ready_for_pickup',
        afterMinutes: 3,
        note: 'Pesanan siap diambil pembeli (demo).',
        assignmentStatus: 'delivering',
    },
    {
        status: 'completed',
        afterMinutes: 8,
        note: 'Pesanan diambil pembeli (demo).',
        assignmentStatus: 'completed',
    },
];
const DEMOABLE_STATUSES = new Set([
    'paid',
    'processing',
    'out_for_delivery',
    'ready_for_pickup',
]);
const PHASE_RANK: Record<string, number> = {
    pending: 0,
    paid: 1,
    processing: 2,
    out_for_delivery: 3,
    ready_for_pickup: 3,
    completed: 4,
    cancelled: 4,
    refunded: 4,
    failed: 4,
};
export function demoScheduleFor(fulfillment: string): readonly DemoStage[] {
    return fulfillment === 'pickup' ? DEMO_PICKUP_SCHEDULE : DEMO_DELIVERY_SCHEDULE;
}
export function resolveDemoTarget({ currentStatus, fulfillment, startedAtIso, now, }: {
    currentStatus: string;
    fulfillment: string;
    startedAtIso: string | null | undefined;
    now: number;
}): DemoStage | null {
    if (!DEMOABLE_STATUSES.has(currentStatus))
        return null;
    if (!startedAtIso)
        return null;
    const startedAt = new Date(startedAtIso).getTime();
    if (!Number.isFinite(startedAt) || !Number.isFinite(now))
        return null;
    const elapsedMinutes = (now - startedAt) / 60000;
    if (elapsedMinutes < 0)
        return null;
    const schedule = demoScheduleFor(fulfillment);
    const currentRank = PHASE_RANK[currentStatus] ?? 0;
    let target: DemoStage | null = null;
    for (const stage of schedule) {
        if (elapsedMinutes < stage.afterMinutes)
            break;
        if ((PHASE_RANK[stage.status] ?? 0) > currentRank)
            target = stage;
    }
    return target;
}
export function demoGreeting(orderCode: string): string {
    return (`Halo! Saya Kurir Demo untuk pesanan #${orderCode}. ` +
        'Pesan ini dikirim otomatis sebagai simulasi, bukan dari kurir sungguhan. ' +
        'Silakan tanya apa saja untuk menguji fitur chat.');
}
const REPLIES_BY_STAGE: Record<string, readonly string[]> = {
    processing: [
        'Pesananmu sedang disiapkan di toko. Saya berangkat begitu siap, ya.',
        'Saya masih menunggu pesanan selesai dikemas. Terima kasih sudah sabar.',
    ],
    out_for_delivery: [
        'Saya sedang menuju alamatmu. Tolong pastikan nomor telepon aktif.',
        'Pesanan sudah saya bawa. Kalau ada patokan lokasi, tulis di sini ya.',
    ],
    ready_for_pickup: [
        'Pesananmu sudah siap diambil di toko.',
        'Sudah siap diambil, silakan datang ke toko saat sempat.',
    ],
    completed: [
        'Pesanan sudah sampai. Terima kasih sudah memesan di ReBites!',
        'Pengantaran selesai. Semoga makanannya cocok!',
    ],
};
export function buildDemoCourierReply({ message, stage, orderCode, }: {
    message: string;
    stage: string;
    orderCode: string;
}): string {
    const pool = REPLIES_BY_STAGE[stage] ?? REPLIES_BY_STAGE.processing;
    const text = message.trim();
    if (/berapa\s+lama|estimasi|kapan\s+sampai|berapa\s+menit/i.test(text)) {
        return stage === 'completed'
            ? `Pesanan #${orderCode} sudah sampai. Terima kasih sudah menunggu!`
            : `Untuk pesanan #${orderCode}, perkiraan tiba bisa dilihat di panel status pesananmu. Saya kabari lagi kalau ada perubahan.`;
    }
    if (/di\s*mana|lokasi|posisi/i.test(text)) {
        return stage === 'out_for_delivery'
            ? 'Saya sedang di jalan menuju alamatmu. Posisi saya bisa dilihat di peta pesanan.'
            : `Saya belum berangkat untuk pesanan #${orderCode}. Status terbaru ada di halaman pesananmu.`;
    }
    if (/terima\s*kasih|makasih|thanks/i.test(text)) {
        return 'Sama-sama! Senang bisa membantu.';
    }
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash * 31 + text.charCodeAt(i)) % 100000;
    }
    return pool[hash % pool.length];
}
