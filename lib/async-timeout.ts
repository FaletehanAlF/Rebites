export class OperationTimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(`Operasi melewati batas waktu ${timeoutMs} ms.`);
        this.name = 'OperationTimeoutError';
    }
}
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const ms = Number.isFinite(timeoutMs) ? Math.max(1, Math.floor(timeoutMs)) : 1;
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new OperationTimeoutError(ms)), ms);
        promise.then((value) => {
            clearTimeout(timer);
            resolve(value);
        }, (error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}
