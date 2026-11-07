export interface VisitorDailyPoint {
    day: string;
    visitors: number;
    visits: number;
}
export interface VisitorPieSlice {
    key: string;
    days: number;
    aggregated: boolean;
    visitors: number;
}
export const MAX_PIE_SLICES = 12;
export function buildVisitorPieSlices(points: readonly VisitorDailyPoint[], maxSlices: number = MAX_PIE_SLICES): VisitorPieSlice[] {
    const limit = Math.max(2, Math.floor(maxSlices));
    const active = points
        .filter((point) => Number.isFinite(point.visitors) && point.visitors > 0)
        .map((point) => ({ day: point.day, visitors: Math.trunc(point.visitors) }))
        .sort((a, b) => b.visitors - a.visitors);
    if (active.length === 0)
        return [];
    if (active.length <= limit) {
        return active.map((point) => ({
            key: point.day,
            days: 1,
            aggregated: false,
            visitors: point.visitors,
        }));
    }
    const leading = active.slice(0, limit - 1);
    const rest = active.slice(limit - 1);
    return [
        ...leading.map((point) => ({
            key: point.day,
            days: 1,
            aggregated: false,
            visitors: point.visitors,
        })),
        {
            key: 'lainnya',
            days: rest.length,
            aggregated: true,
            visitors: rest.reduce((total, point) => total + point.visitors, 0),
        },
    ];
}
