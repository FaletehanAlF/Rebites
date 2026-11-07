import Link from 'next/link';
import { DashboardCard } from './primitives';
import type { AdminDashboardData } from '@/lib/admin-dashboard';
export function DashboardMonitoring({ data }: {
    data: AdminDashboardData;
}) {
    const rows = [
        { label: 'Laporan terbuka', value: data.reports.open, href: '/dashboard/admin/monitoring/laporan' },
        { label: 'Sedang ditinjau', value: data.reports.reviewing, href: '/dashboard/admin/monitoring/laporan' },
        { label: 'Peringatan 1/3', value: data.warnings.level1, href: '/dashboard/admin/monitoring/peringatan' },
        { label: 'Peringatan 2/3', value: data.warnings.level2, href: '/dashboard/admin/monitoring/peringatan' },
        { label: 'Peringatan 3/3', value: data.warnings.level3, href: '/dashboard/admin/monitoring/peringatan' },
        { label: 'Sanksi aktif', value: data.sanctions.active, href: '/dashboard/admin/monitoring/sanksi' },
    ];
    return (<DashboardCard>
      <ul className="divide-y divide-border">
        {rows.map((row) => (<li key={row.label}>
            <Link href={row.href} className="-mx-2 flex items-center justify-between rounded-[var(--radius)] px-2 py-2.5 transition-colors hover:bg-sage-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <span className="text-sm text-charcoal-700">{row.label}</span>
              <span className="text-sm font-semibold text-charcoal-900">{row.value}</span>
            </Link>
          </li>))}
      </ul>
    </DashboardCard>);
}
