export function formatNotificationTime(iso: string): string {
    if (!iso)
        return 'Baru saja';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then))
        return 'Baru saja';
    const now = Date.now();
    const diffMs = now - then;
    if (!Number.isFinite(diffMs) || diffMs < 0)
        return 'Baru saja';
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60)
        return 'Baru saja';
    if (minutes < 60)
        return `${minutes} menit lalu`;
    if (hours < 24)
        return `${hours} jam lalu`;
    if (days < 7)
        return `${days} hari lalu`;
    try {
        return new Date(iso).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    catch {
        return 'Baru saja';
    }
}
