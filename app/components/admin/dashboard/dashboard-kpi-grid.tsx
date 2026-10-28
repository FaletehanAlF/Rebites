import Link from 'next/link';
import {
  AlertTriangle,
  CreditCard,
  Gavel,
  ShieldAlert,
  ShoppingBag,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DashboardCard } from './primitives';
import { formatRupiah } from '../admin-format';
import type { AdminDashboardData } from '@/lib/admin-dashboard';

function deltaText(
  current: number,
  previous: number
): { text: string; trend: 'up' | 'down' | 'flat' } | null {
  if (previous === 0 && current === 0) return { text: 'Sama seperti kemarin', trend: 'flat' };
  if (previous === 0) return { text: 'Baru hari ini', trend: 'up' };
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return { text: 'Sama seperti kemarin', trend: 'flat' };
  return {
    text: `${rounded > 0 ? '+' : ''}${rounded}% dibanding kemarin`,
    trend: rounded > 0 ? 'up' : 'down',
  };
}

function DeltaBadge({ delta }: { delta: ReturnType<typeof deltaText> }) {
  if (!delta) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {delta.trend === 'up' && <TrendingUp aria-hidden className="h-3 w-3 text-success" />}
      {delta.trend === 'down' && <TrendingDown aria-hidden className="h-3 w-3 text-destructive" />}
      {delta.text}
    </span>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  supporting,
  href,
  emphasis,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  supporting?: React.ReactNode;
  href?: string;
  emphasis?: 'attention';
}) {
  const body = (
    <DashboardCard className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-sage-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-charcoal-900">
            {value}
          </p>
          {supporting && <div className="mt-1.5 text-xs text-sage-500">{supporting}</div>}
        </div>
        <span
          className={
            emphasis === 'attention'
              ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-warning/10 text-warning'
              : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary'
          }
        >
          <Icon aria-hidden className="h-5 w-5" />
        </span>
      </div>
    </DashboardCard>
  );

  if (!href) return <div>{body}</div>;
  return (
    <Link
      href={href}
      className="block rounded-[var(--radius)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {body}
    </Link>
  );
}

export function DashboardKpiGrid({ data }: { data: AdminDashboardData }) {
  const ordersDelta = deltaText(data.orders.today, data.orders.yesterday);
  const revenueDelta = deltaText(data.revenue.today, data.revenue.yesterday);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Total pengguna"
          value={data.users.total.toLocaleString('id-ID')}
          supporting={`${data.users.suspended} ditangguhkan · ${data.users.banned} diblokir`}
          href="/dashboard/admin/pengguna"
        />
        <KpiCard
          icon={Store}
          label="UMKM aktif"
          value={data.umkm.active.toLocaleString('id-ID')}
          supporting={`dari ${data.umkm.total} terdaftar`}
          href="/dashboard/admin/umkm"
        />
        <KpiCard
          icon={ShoppingBag}
          label="Pesanan hari ini"
          value={data.orders.today.toLocaleString('id-ID')}
          supporting={<DeltaBadge delta={ordersDelta} />}
          href="/dashboard/admin/pesanan"
        />
        <KpiCard
          icon={Wallet}
          label="Pendapatan kotor hari ini"
          value={formatRupiah(data.revenue.today)}
          supporting={
            <>
              <DeltaBadge delta={revenueDelta} />
              <span className="mt-0.5 block">Nilai bruto pesanan paid; bukan laba bersih.</span>
            </>
          }
          href="/dashboard/admin/pesanan"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          icon={ShieldAlert}
          label="Laporan terbuka"
          value={String(data.reports.open)}
          supporting={
            data.reports.staleOpen > 0
              ? `${data.reports.staleOpen} sudah lebih dari 24 jam`
              : 'Tidak ada yang lama'
          }
          emphasis={data.reports.open > 0 ? 'attention' : undefined}
          href="/dashboard/admin/monitoring/laporan"
        />
        <KpiCard
          icon={CreditCard}
          label="Langganan aktif"
          value={String(data.subscriptions.active)}
          supporting={`${data.subscriptions.expiringSoon} kedaluwarsa 7 hari`}
          href="/dashboard/admin/langganan"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Peringatan 3/3"
          value={String(data.warnings.usersAtThree)}
          supporting="Peringatan maksimum"
          emphasis={data.warnings.usersAtThree > 0 ? 'attention' : undefined}
          href="/dashboard/admin/monitoring/peringatan"
        />
        <KpiCard
          icon={Gavel}
          label="Sanksi aktif"
          value={String(data.sanctions.active)}
          supporting="Tangguhkan, blokir, atau hapus akun"
          href="/dashboard/admin/monitoring/sanksi"
        />
      </div>
    </>
  );
}