'use client';

import { AuthError, getValidAuthHeader } from './auth-token';
import { isXlsxContentType } from './csv';
import type { SellerReportPeriod } from './seller-report';

export interface SellerReportExportResult {
  downloaded: boolean;
  rows: number;
  filename: string | null;
}

export class SellerReportExportError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'SellerReportExportError';
    this.status = status;
  }
}

function contentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1];
  const plain = /filename=([^;]+)/i.exec(header);
  return plain?.[1]?.trim() || null;
}

/**
 * Unduh laporan penjualan sebagai Excel (.xlsx).
 *
 * Berkas dibuat di SERVER: agregasi dan penulisan XLSX butuh `node:zlib`,
 * yang tidak ada di browser. Rentang yang dikirim sama persis dengan yang
 * sedang dilihat penjual di tabel, sehingga berkas tidak pernah memuat angka
 * dari rentang yang lain.
 *
 * Respons 204 berarti tidak ada pesanan pada rentang itu — bukan kegagalan,
 * jadi pemanggil menerima `downloaded: false` dan menampilkannya sebagai
 * informasi.
 */
export async function downloadSellerReportExcel(
  period: SellerReportPeriod
): Promise<SellerReportExportResult> {
  let authHeader: string;
  try {
    authHeader = await getValidAuthHeader();
  } catch (err) {
    if (err instanceof AuthError) {
      throw new SellerReportExportError(err.message, 401);
    }
    throw err;
  }

  const res = await fetch(
    `/api/seller/reports/export?periode=${encodeURIComponent(period)}`,
    {
      headers: { Authorization: authHeader },
      cache: 'no-store',
    }
  );

  if (res.status === 204) {
    return { downloaded: false, rows: 0, filename: null };
  }

  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new SellerReportExportError(
      json?.error ?? 'Gagal membuat ekspor laporan.',
      res.status
    );
  }

  if (!isXlsxContentType(res.headers.get('Content-Type'))) {
    throw new SellerReportExportError(
      'Respons ekspor bukan berkas Excel yang valid.',
      502
    );
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    throw new SellerReportExportError('File Excel kosong; ekspor dibatalkan.', 500);
  }

  const filename = contentDispositionFilename(res.headers.get('Content-Disposition'));
  const rawRows = Number(res.headers.get('X-Export-Row-Count') ?? '0');
  const rows = Number.isFinite(rawRows) && rawRows >= 0 ? rawRows : 0;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename ?? 'laporan-penjualan.xlsx';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);

  return { downloaded: true, rows, filename };
}
