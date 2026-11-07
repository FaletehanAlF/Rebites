import { sanitizeSearchTermKeepingWords } from './filter-search.ts';
import { DAY_MS, parseWibDateOnly, wibDayKey } from './wib-time.ts';
export const REPORT_FILTER_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const;
export type ReportFilterStatus = (typeof REPORT_FILTER_STATUSES)[number];
export const REPORT_FILTER_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type ReportFilterSeverity = (typeof REPORT_FILTER_SEVERITIES)[number];
export type ReportAssignedFilter = 'assigned' | 'unassigned';
export interface ReportFilterInput {
    status?: string | null;
    severity?: string | null;
    category?: string | null;
    assigned?: string | null;
    q?: string | null;
    from?: string | null;
    to?: string | null;
}
export interface ReportFilters {
    status: ReportFilterStatus | null;
    severity: ReportFilterSeverity | null;
    category: string;
    assigned: ReportAssignedFilter | null;
    q: string;
    from: string | null;
    to: string | null;
    fromIso: string | null;
    toExclusiveIso: string | null;
}
export type ParseReportFiltersResult = {
    ok: true;
    filters: ReportFilters;
} | {
    ok: false;
    error: string;
};
function readParam(input: {
    get: (name: string) => string | null;
}, name: string): string {
    return (input.get(name) ?? '').trim();
}
function includes<T extends string>(values: readonly T[], raw: string): raw is T {
    return (values as readonly string[]).includes(raw);
}
export function parseReportFilters(input: {
    get: (name: string) => string | null;
}): ParseReportFiltersResult {
    const rawStatus = readParam(input, 'status');
    if (rawStatus && !includes(REPORT_FILTER_STATUSES, rawStatus)) {
        return {
            ok: false,
            error: `Status tidak valid. Gunakan salah satu: ${REPORT_FILTER_STATUSES.join(', ')}.`,
        };
    }
    const rawSeverity = readParam(input, 'severity');
    if (rawSeverity && !includes(REPORT_FILTER_SEVERITIES, rawSeverity)) {
        return {
            ok: false,
            error: `Severity tidak valid. Gunakan salah satu: ${REPORT_FILTER_SEVERITIES.join(', ')}.`,
        };
    }
    const rawAssigned = readParam(input, 'assigned');
    if (rawAssigned && rawAssigned !== 'assigned' && rawAssigned !== 'unassigned') {
        return {
            ok: false,
            error: "Parameter assigned harus 'assigned' atau 'unassigned'.",
        };
    }
    const from = readParam(input, 'from') || null;
    const to = readParam(input, 'to') || null;
    let fromIso: string | null = null;
    let toExclusiveIso: string | null = null;
    if (from) {
        const ms = parseWibDateOnly(from);
        if (ms === null) {
            return { ok: false, error: 'Parameter from harus berupa tanggal YYYY-MM-DD yang valid.' };
        }
        fromIso = new Date(ms).toISOString();
    }
    if (to) {
        const ms = parseWibDateOnly(to);
        if (ms === null) {
            return { ok: false, error: 'Parameter to harus berupa tanggal YYYY-MM-DD yang valid.' };
        }
        toExclusiveIso = new Date(ms + DAY_MS).toISOString();
    }
    if (from && to && from > to) {
        return { ok: false, error: 'Tanggal from tidak boleh setelah tanggal to.' };
    }
    return {
        ok: true,
        filters: {
            status: rawStatus ? (rawStatus as ReportFilterStatus) : null,
            severity: rawSeverity ? (rawSeverity as ReportFilterSeverity) : null,
            category: sanitizeSearchTermKeepingWords(readParam(input, 'category'), 100),
            assigned: rawAssigned ? (rawAssigned as ReportAssignedFilter) : null,
            q: sanitizeSearchTermKeepingWords(readParam(input, 'q'), 100),
            from,
            to,
            fromIso,
            toExclusiveIso,
        },
    };
}
export function buildReportFilterSearchParams(input: ReportFilterInput): URLSearchParams {
    const params = new URLSearchParams();
    const status = input.status?.trim();
    const severity = input.severity?.trim();
    const category = input.category?.trim();
    const assigned = input.assigned?.trim();
    const q = input.q?.trim();
    const from = input.from?.trim();
    const to = input.to?.trim();
    if (status)
        params.set('status', status);
    if (severity)
        params.set('severity', severity);
    if (category)
        params.set('category', category);
    if (assigned)
        params.set('assigned', assigned);
    if (q)
        params.set('q', q);
    if (from)
        params.set('from', from);
    if (to)
        params.set('to', to);
    return params;
}
export interface ReportFilterQuery {
    eq(column: string, value: string): ReportFilterQuery;
    ilike(column: string, pattern: string): ReportFilterQuery;
    not(column: string, operator: string, value: null): ReportFilterQuery;
    is(column: string, value: null): ReportFilterQuery;
    gte(column: string, value: string): ReportFilterQuery;
    lt(column: string, value: string): ReportFilterQuery;
    or(filters: string): ReportFilterQuery;
}
export function applyReportFiltersToQuery<Q>(query: Q, filters: ReportFilters): Q {
    let next = query as unknown as ReportFilterQuery;
    if (filters.status)
        next = next.eq('status', filters.status);
    if (filters.severity)
        next = next.eq('severity', filters.severity);
    if (filters.category)
        next = next.ilike('category', `%${filters.category}%`);
    if (filters.assigned === 'assigned')
        next = next.not('assigned_to', 'is', null);
    if (filters.assigned === 'unassigned')
        next = next.is('assigned_to', null);
    if (filters.fromIso)
        next = next.gte('created_at', filters.fromIso);
    if (filters.toExclusiveIso)
        next = next.lt('created_at', filters.toExclusiveIso);
    if (filters.q) {
        next = next.or(`description.ilike.%${filters.q}%,category.ilike.%${filters.q}%`);
    }
    return next as unknown as Q;
}
export function reportExportDate(now: Date | number = Date.now()): string {
    return wibDayKey(now) ?? 'tanpa-tanggal';
}
