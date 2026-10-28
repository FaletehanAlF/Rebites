/**
 * Batas waktu untuk operasi async di level UI — modul MURNI (tanpa impor
 * runtime) sehingga dapat diuji langsung dengan `node --test`.
 *
 * Kenapa tidak memakai `AbortSignal.timeout` saja: `fetchAdminMe()` dan
 * `fetchAdminWithAuth()` tidak menerima signal, jadi request-nya tidak dapat
 * dibatalkan. Pembungkus ini tetap mengembalikan kendali ke UI (status error +
 * tombol coba lagi) alih-alih membiarkan spinner menyala selamanya saat server
 * tidak menjawab.
 */

export class OperationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Operasi melewati batas waktu ${timeoutMs} ms.`);
    this.name = 'OperationTimeoutError';
  }
}

/**
 * Selesaikan dengan nilai `promise`, atau tolak dengan `OperationTimeoutError`
 * setelah `timeoutMs`. Penolakan asli dari `promise` diteruskan apa adanya.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const ms = Number.isFinite(timeoutMs) ? Math.max(1, Math.floor(timeoutMs)) : 1;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new OperationTimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
