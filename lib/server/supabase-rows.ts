export const POSTGREST_PAGE_SIZE = 1000;
export interface PostgrestPage<T> {
    data: T[] | null;
    error: unknown | null;
}
export class PageQueryError extends Error {
    readonly label: string;
    readonly queryError: unknown;
    constructor(label: string, queryError: unknown) {
        super(`Query halaman "${label}" gagal.`);
        this.name = 'PageQueryError';
        this.label = label;
        this.queryError = queryError;
    }
}
export class PageLimitError extends Error {
    readonly label: string;
    readonly maxRows: number;
    readonly observedAtLeast: number;
    constructor(label: string, observedAtLeast: number, maxRows: number) {
        super(`Data "${label}" melebihi batas ${maxRows} baris.`);
        this.name = 'PageLimitError';
        this.label = label;
        this.observedAtLeast = observedAtLeast;
        this.maxRows = maxRows;
    }
}
export interface FetchAllPagesOptions {
    pageSize?: number;
    maxRows: number;
    label: string;
}
export async function fetchAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<PostgrestPage<T>>, options: FetchAllPagesOptions): Promise<T[]> {
    const pageSize = Math.max(1, Math.floor(options.pageSize ?? POSTGREST_PAGE_SIZE));
    const maxRows = Math.max(1, Math.floor(options.maxRows));
    const rows: T[] = [];
    let from = 0;
    for (;;) {
        const result = await fetchPage(from, from + pageSize - 1);
        if (result.error)
            throw new PageQueryError(options.label, result.error);
        const page = result.data ?? [];
        if (page.length === 0)
            break;
        if (rows.length + page.length > maxRows) {
            throw new PageLimitError(options.label, rows.length + page.length, maxRows);
        }
        rows.push(...page);
        from += page.length;
    }
    return rows;
}
