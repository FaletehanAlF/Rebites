import { cn } from '@/lib/utils';
import { formatRupiah } from '@/lib/data';
import type { SellerReport } from '@/lib/seller-report';
export function SellerReportTable({ report, className, }: {
    report: SellerReport;
    className?: string;
}) {
    const rows = [...report.rows].reverse();
    const showScroll = rows.length > 12;
    return (<div className={cn('overflow-x-auto overflow-y-auto rounded-xl border border-border', showScroll && 'max-h-[26rem]', className)}>

      <table className="w-full min-w-[440px] text-left text-xs">

        <thead className="sticky top-0 z-10 bg-secondary text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">

          <tr>

            <th scope="col" className="px-4 py-2.5">Tanggal</th>

            <th scope="col" className="px-4 py-2.5 text-right">Pesanan</th>

            <th scope="col" className="px-4 py-2.5 text-right">Terjual</th>

            <th scope="col" className="px-4 py-2.5 text-right">Batal</th>

            <th scope="col" className="px-4 py-2.5 text-right">Pendapatan</th>

          </tr>

        </thead>

        <tbody className="divide-y divide-border">

          {rows.map((row) => (<tr key={row.dayKey} className="text-foreground">

              <th scope="row" className="px-4 py-2.5 font-semibold">{row.day}</th>

              <td className="px-4 py-2.5 text-right tabular-nums">{row.orders}</td>

              <td className="px-4 py-2.5 text-right tabular-nums">{row.porsi}</td>

              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">

                {row.cancelled}

              </td>

              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">

                {formatRupiah(row.revenue)}

              </td>

            </tr>))}

        </tbody>

        <tfoot className="border-t-2 border-border bg-secondary/60 text-xs font-bold text-foreground">

          <tr>

            <th scope="row" className="px-4 py-2.5">Total</th>

            <td className="px-4 py-2.5 text-right tabular-nums">{report.summary.orders}</td>

            <td className="px-4 py-2.5 text-right tabular-nums">{report.summary.porsi}</td>

            <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">

              {report.summary.cancelled}

            </td>

            <td className="px-4 py-2.5 text-right tabular-nums">

              {formatRupiah(report.summary.revenue)}

            </td>

          </tr>

        </tfoot>

      </table>

    </div>);
}
