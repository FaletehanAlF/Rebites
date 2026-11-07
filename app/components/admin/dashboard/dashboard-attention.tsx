import Link from 'next/link';
import { AlertTriangle, Gavel, ShieldAlert, Truck, Wallet, XCircle, ShieldCheck } from 'lucide-react';
import { DashboardCard } from './primitives';
import type { AdminDashboardData } from '@/lib/admin-dashboard';
interface AttentionItem {
    level: 'attention' | 'info';
    icon: typeof ShieldAlert;
    title: string;
    description: string;
    count: number;
    actionHref: string;
    actionLabel: string;
}
export function DashboardAttention({ data }: {
    data: AdminDashboardData;
}) {
    const items: AttentionItem[] = [];
    if (data.reports.staleOpen > 0) {
        items.push({
            level: 'attention',
            icon: ShieldAlert,
            title: 'Laporan belum ditangani lebih dari 24 jam',
            description: `${data.reports.staleOpen} laporan menunggu lebih dari sehari.`,
            count: data.reports.staleOpen,
            actionHref: '/dashboard/admin/monitoring/laporan',
            actionLabel: 'Tinjau',
        });
    }
    if (data.reports.open > 0) {
        items.push({
            level: 'info',
            icon: ShieldAlert,
            title: 'Laporan terbuka',
            description: `${data.reports.open} laporan menunggu ditinjau.`,
            count: data.reports.open,
            actionHref: '/dashboard/admin/monitoring/laporan',
            actionLabel: 'Lihat',
        });
    }
    if (data.warnings.usersAtThree > 0) {
        items.push({
            level: 'attention',
            icon: AlertTriangle,
            title: 'Pengguna mencapai peringatan 3/3',
            description: 'Perlu keputusan admin: sanksi atau tidak.',
            count: data.warnings.usersAtThree,
            actionHref: '/dashboard/admin/monitoring/peringatan',
            actionLabel: 'Tinjau',
        });
    }
    if (data.sanctions.active > 0) {
        items.push({
            level: 'info',
            icon: Gavel,
            title: 'Sanksi aktif',
            description: 'Pantau akun yang sedang disanksi.',
            count: data.sanctions.active,
            actionHref: '/dashboard/admin/monitoring/sanksi',
            actionLabel: 'Lihat',
        });
    }
    if (data.subscriptions.expiringSoon > 0) {
        items.push({
            level: 'attention',
            icon: Wallet,
            title: 'Langganan kedaluwarsa 7 hari',
            description: 'Perlu tindak lanjut perpanjangan.',
            count: data.subscriptions.expiringSoon,
            actionHref: '/dashboard/admin/langganan',
            actionLabel: 'Lihat',
        });
    }
    if (data.orders.failedPayments > 0) {
        items.push({
            level: 'attention',
            icon: XCircle,
            title: 'Pembayaran gagal',
            description: 'Total pesanan dengan status pembayaran gagal.',
            count: data.orders.failedPayments,
            actionHref: '/dashboard/admin/pesanan',
            actionLabel: 'Lihat',
        });
    }
    if (data.shipments.stale > 0) {
        items.push({
            level: 'attention',
            icon: Truck,
            title: 'Kiriman menunggu dikirim lebih dari 24 jam',
            description: `${data.shipments.stale} pesanan sudah dibayar tetapi belum diserahkan penjual.`,
            count: data.shipments.stale,
            actionHref: '/dashboard/admin/pengiriman?state=to_ship',
            actionLabel: 'Tinjau',
        });
    }
    return (<DashboardCard>
      {items.length === 0 ? (<div className="flex items-center gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-success/10 text-success">
            <ShieldCheck aria-hidden className="h-5 w-5"/>
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-charcoal-900">Semua aman</p>
            <p className="text-xs text-sage-500">
              Tidak ada antrean yang membutuhkan tindakan segera.
            </p>
          </div>
        </div>) : (<ul className="divide-y divide-border">
          {items.map((item) => (<li key={item.title} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <span className={item.level === 'attention'
                    ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-warning/10 text-warning'
                    : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-sage-100 text-sage-600'}>
                <item.icon aria-hidden className="h-4 w-4"/>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-charcoal-900">{item.title}</p>
                <p className="truncate text-xs text-sage-500">{item.description}</p>
              </div>
              <span className="text-lg font-semibold tabular-nums text-charcoal-900">
                {item.count}
              </span>
              <Link href={item.actionHref} className="shrink-0 rounded-[var(--radius)] border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                {item.actionLabel}
              </Link>
            </li>))}
        </ul>)}
    </DashboardCard>);
}
