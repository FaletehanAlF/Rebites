export type InvoiceState = 'not_started' | 'inflight' | 'unknown' | 'attached' | 'failed';
export const INVOICE_STATES: readonly InvoiceState[] = [
    'not_started',
    'inflight',
    'unknown',
    'attached',
    'failed',
];
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
export function normalizeIdempotencyKey(raw: unknown): string | null {
    if (typeof raw !== 'string')
        return null;
    const key = raw.trim();
    if (key.length === 0 || key.length > IDEMPOTENCY_KEY_MAX_LENGTH)
        return null;
    return key;
}
export function canTransitionInvoiceState(from: InvoiceState | null | undefined, to: InvoiceState): boolean {
    switch (from ?? null) {
        case null:
            return false;
        case 'not_started':
            return to === 'inflight' || to === 'failed';
        case 'inflight':
            return to === 'unknown' || to === 'attached' || to === 'failed';
        case 'unknown':
            return to === 'inflight' || to === 'failed';
        case 'attached':
            return to === 'failed';
        case 'failed':
            return false;
        default:
            return false;
    }
}
export type InvoiceErrorClass = 'unknown' | 'definitive';
function getExplicitHttpStatus(err: unknown): number | null {
    if (typeof err !== 'object' || err === null)
        return null;
    const candidate = err as {
        status?: unknown;
        statusCode?: unknown;
    };
    for (const value of [candidate.status, candidate.statusCode]) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && /^\d{3}$/.test(value.trim())) {
            return Number(value.trim());
        }
    }
    return null;
}
export function classifyInvoiceError(err: unknown): InvoiceErrorClass {
    const explicitStatus = getExplicitHttpStatus(err);
    if (explicitStatus !== null) {
        if (explicitStatus === 429 || explicitStatus >= 500)
            return 'unknown';
        if (explicitStatus >= 400 && explicitStatus < 500)
            return 'definitive';
    }
    const msg = err instanceof Error ? err.message : String(err ?? '');
    if (/timeout|timed\s*out|abort|fetch\s*failed|network|ECONN|ETIMEDOUT|socket|EAI_AGAIN/i.test(msg)) {
        return 'unknown';
    }
    const statusMatch = msg.match(/Xendit error (\d{3})/);
    if (statusMatch) {
        const status = Number(statusMatch[1]);
        if (status === 429 || status >= 500)
            return 'unknown';
        if (status >= 400 && status < 500)
            return 'definitive';
    }
    if (/rate.?limit|RATE_LIMIT_EXCEEDED/i.test(msg))
        return 'unknown';
    if (/(?:status(?:code)?|HTTP|error)\D{0,10}\b(40[01]|402|403|404|422)\b/i.test(msg)) {
        return 'definitive';
    }
    return 'unknown';
}
export type KeyedFailurePhase = 'pre_gate' | 'post_gate';
export interface KeyedFailureCompensation {
    clearCoinSnapshot: boolean;
    releasePromo: boolean;
}
export function planKeyedFailureCompensation(phase: KeyedFailurePhase, promoClaimed: boolean): KeyedFailureCompensation {
    if (phase === 'pre_gate') {
        return { clearCoinSnapshot: true, releasePromo: false };
    }
    return { clearCoinSnapshot: false, releasePromo: promoClaimed };
}
export interface TerminalPromoReleasePlan {
    release: boolean;
    promoCode: string | null;
}
export function planTerminalPromoRelease(opts: {
    updateWon: boolean;
    promoCode: unknown;
}): TerminalPromoReleasePlan {
    if (!opts.updateWon)
        return { release: false, promoCode: null };
    if (typeof opts.promoCode !== 'string') {
        return { release: false, promoCode: null };
    }
    const promoCode = opts.promoCode.trim().toUpperCase();
    if (promoCode.length === 0)
        return { release: false, promoCode: null };
    return { release: true, promoCode };
}
export type ReplayClass = 'success' | 'attached_unpaid' | 'checking' | 'failed_final';
export interface ReplayRow {
    payment_status?: string | null;
    order_status?: string | null;
    invoice_state?: InvoiceState | null;
    xendit_invoice_id?: string | null;
}
export function classifyReplay(row: ReplayRow): ReplayClass {
    const payment = (row.payment_status ?? 'unpaid') as string;
    const order = (row.order_status ?? 'pending') as string;
    if (payment === 'paid')
        return 'success';
    if (payment === 'failed' ||
        payment === 'refunded' ||
        order === 'cancelled' ||
        order === 'refunded' ||
        order === 'failed') {
        return 'failed_final';
    }
    if (row.xendit_invoice_id)
        return 'attached_unpaid';
    if (row.invoice_state === 'attached' && !row.xendit_invoice_id) {
        return 'checking';
    }
    return 'checking';
}
export type OrderWriteErrorClass = 'definitive' | 'unknown';
export function classifyOrderWriteError(err: unknown): OrderWriteErrorClass {
    if (typeof err !== 'object' || err === null)
        return 'unknown';
    const { code } = err as {
        code?: unknown;
    };
    if (typeof code === 'string' && code.trim().length > 0)
        return 'definitive';
    return 'unknown';
}
export type ReserveOutcome = 'reserved' | 'insufficient_stock' | 'technical_error';
export function classifyReserveOutcome(opts: {
    reserved: unknown;
    error: unknown;
    markerSet: boolean;
}): ReserveOutcome {
    if (opts.markerSet)
        return 'reserved';
    if (opts.error)
        return 'technical_error';
    if (opts.reserved === false)
        return 'insufficient_stock';
    if (opts.reserved === true)
        return 'reserved';
    return 'technical_error';
}
export type AbandonHoldReason = 'transition_unconfirmed' | 'stock_not_released' | 'compensation_pending';
export interface AbandonDeletionPlan {
    transitionConfirmed: boolean;
    stockReleased: boolean | null;
    mayDelete: boolean;
    hold: AbandonHoldReason | null;
}
export function planAbandonDeletion(opts: {
    transitionConfirmed: boolean;
    stockReservedAt?: string | null;
    stockReleasedAt?: string | null;
    compensationSettled: boolean;
}): AbandonDeletionPlan {
    if (!opts.transitionConfirmed) {
        return {
            transitionConfirmed: false,
            stockReleased: null,
            mayDelete: false,
            hold: 'transition_unconfirmed',
        };
    }
    const stockReservedAt = opts.stockReservedAt ?? null;
    const stockReleasedAt = opts.stockReleasedAt ?? null;
    const stockReleased = stockReservedAt == null || stockReleasedAt != null;
    if (!stockReleased) {
        return {
            transitionConfirmed: true,
            stockReleased: false,
            mayDelete: false,
            hold: 'stock_not_released',
        };
    }
    if (!opts.compensationSettled) {
        return {
            transitionConfirmed: true,
            stockReleased: true,
            mayDelete: false,
            hold: 'compensation_pending',
        };
    }
    return { transitionConfirmed: true, stockReleased: true, mayDelete: true, hold: null };
}
export function isInvoiceStateColumnMissingError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null)
        return false;
    const { code, message } = err as {
        code?: unknown;
        message?: unknown;
    };
    const msg = typeof message === 'string' ? message : '';
    const mentionsColumn = /invoice_state/i.test(msg);
    if (code === '42703' || code === 'PGRST204') {
        return mentionsColumn || msg.trim() === '';
    }
    if (typeof code !== 'string' || code.trim() === '') {
        return mentionsColumn && /column|schema/i.test(msg);
    }
    return false;
}
export type CompensationRpcVerdict = {
    ok: boolean;
    reason: 'ok' | 'rpc_error' | 'data_not_true';
};
export function classifyCompensationRpcResult(opts: {
    data: unknown;
    error: {
        message?: string | null;
    } | null | undefined;
    requireSuccessData: boolean;
}): CompensationRpcVerdict {
    if (opts.error)
        return { ok: false, reason: 'rpc_error' };
    if (opts.requireSuccessData && opts.data !== true) {
        return { ok: false, reason: 'data_not_true' };
    }
    return { ok: true, reason: 'ok' };
}
