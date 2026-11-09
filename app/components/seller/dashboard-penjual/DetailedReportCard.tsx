'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { FilterDropdown } from './FilterDropdown';
import { LockedFeatureCard } from './LockedFeatureCard';
import { SalesEmptyState, CardLinesSkeleton } from './SalesEmptyState';
import { SellerReportTable } from './SellerReportTable';
import { useSellerPlan } from '@/lib/seller-plan';
import { useSellerOrders } from '@/hooks/seller/use-seller-orders';
import {
  SELLER_REPORT_PERIODS,
  buildSellerReport,
  formatReportRangeLabel,
  sellerReportPeriodDays,
  type SellerReportPeriod,
} from '@/lib/seller-report';
import {
  SellerReportExportError,
  downloadSellerReportExcel,
} from '@/lib/seller-report-export';

// 'semua' tidak masuk akal di grafik.
export type StatsPeriod = '7-hari' | '14-hari' | '30-hari';

const PERIOD_HINT: Record<SellerReportPeriod, string> = {
  '7-hari': '7 hari terakhir',
  '14-hari': '14 hari terakhir',
  '30-hari': '30 hari terakhir',
  semua: 'sejak pesanan pertama masuk',
};

export function DetailedReportCard() {
  const { plan, hydrated } = useSellerPlan();
  const { orders, hasOrders } = useSellerOrders();
  const [period, setPeriod] = useState<SellerReportPeriod>('7-hari');
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

// Laporan dibangun dari SELURUH pesanan toko, lalu rentangnya dipilih di sini.
  const report = useMemo(
    () =>
      buildSellerReport(
        orders.map((order) => ({
          orderCode: order.orderId,
          createdAt: order.createdAt,
          productName: order.productName,
          quantity: order.quantity ?? 0,
          total: order.total ?? 0,
          orderStatus: order.orderStatus ?? null,
          status: order.status ?? null,
        })),
        { period }
      ),
    [orders, period]
  );

  const rangeLabel = useMemo(
    () =>
      formatReportRangeLabel(
        report.summary.firstDayKey,
        report.summary.lastDayKey
      ),
    [report.summary]
  );

  // Reset pesan saat ganti rentang.
  useEffect(() => {
    setExportMessage(null);
    setExportError(null);
  }, [period]);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setExportMessage(null);
    setExportError(null);
    try {
      const result = await downloadSellerReportExcel(period);
      if (result.downloaded) {
        setExportMessage(
          `Berkas Excel diunduh (${result.rows} pesanan, ${PERIOD_HINT[period]}).`
        );
      } else {
        setExportMessage('Belum ada pesanan pada rentang ini, jadi tidak ada berkas.');
      }
    } catch (err) {
      setExportError(
        err instanceof SellerReportExportError
          ? err.message
          : 'Gagal membuat ekspor laporan. Coba lagi.'
      );
    } finally {
      setExporting(false);
    }
  }

  if (!hydrated) {
    return (
      <Card>
        <div className="h-6 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="mt-4">
          <CardLinesSkeleton />
        </div>
      </Card>
    );
  }

  if (!plan.detailedReport) {
    return (
      <LockedFeatureCard
        title="Laporan Rinci Penjualan"
        description="Laporan harian per porsi beserta estimasi pendapatan per hari."
        requiredPlanLabel="Standar"
      />
    );
  }

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Laporan Rinci · {PERIOD_HINT[period]}
        </p>
        <h3 className="mt-1 flex items-center gap-1.5 font-display text-lg font-medium tracking-tight text-primary">
          <FileText className="h-4 w-4" />
          Penjualan Harian
        </h3>
      </div>
      <div className="flex items-center gap-2">
        <FilterDropdown
          value={period}
          onChange={(next) => setPeriod(next as SellerReportPeriod)}
          options={SELLER_REPORT_PERIODS}
          ariaLabel="Pilih rentang laporan penjualan"
        />
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground">
          Paket {plan.label}
        </span>
      </div>
    </div>
  );

  if (!hasOrders) {
    return (
      <Card>
        {header}
        <div className="mt-4">
          <SalesEmptyState
            title="Laporan belum tersedia"
            description="Rincian penjualan harian akan terisi otomatis setelah ada pesanan yang masuk ke tokomu."
          />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {header}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {report.summary.orders} pesanan
          {rangeLabel ? ` · ${rangeLabel}` : ''}
          {report.summary.cancelled > 0
            ? ` · ${report.summary.cancelled} dibatalkan (tidak dihitung)`
            : ''}
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exporting ? (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
          ) : (
            <Download aria-hidden className="h-3.5 w-3.5" />
          )}
          {exporting ? 'Menyiapkan…' : 'Ekspor Excel'}
        </button>
      </div>

      {(exportMessage || exportError) && (
        <p
          role="status"
          className={cn(
            'mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed',
            exportError ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {exportError && <AlertCircle aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />}
          {exportError ?? exportMessage}
        </p>
      )}

      <SellerReportTable report={report} className="mt-3" />

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Rentang &ldquo;Semua&rdquo; memuat seluruh riwayat tokomu sejak pesanan
        pertama. Ekspor Excel memuat rekap per bulan dan rincian harian pada
        rentang yang sedang dipilih
        {sellerReportPeriodDays(period) === null ? '.' : ` (${PERIOD_HINT[period]}).`}
      </p>
    </Card>
  );
}
