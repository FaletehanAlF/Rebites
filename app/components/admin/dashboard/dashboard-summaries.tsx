import { DashboardCard } from './primitives';
import type { AdminDashboardData } from '@/lib/admin-dashboard';
export function DashboardUserSummary({ data }: {
    data: AdminDashboardData;
}) {
    const rows = [
        { label: 'Aktif', value: data.users.active, tone: 'text-success' },
        { label: 'Ditangguhkan', value: data.users.suspended, tone: 'text-warning' },
        { label: 'Diblokir', value: data.users.banned, tone: 'text-destructive' },
    ];
    return (<DashboardCard>
      <p className="text-xs font-medium text-sage-500">Total pengguna terdaftar</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-charcoal-900">
        {data.users.total.toLocaleString('id-ID')}
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
        {rows.map((r) => (<li key={r.label} className="rounded-[var(--radius)] bg-sage-100/40 px-3 py-2.5 text-center">
            <p className={`text-lg font-semibold tabular-nums ${r.tone}`}>{r.value}</p>
            <p className="text-xs text-sage-500">{r.label}</p>
          </li>))}
      </ul>
    </DashboardCard>);
}
export function DashboardSubscriptionSummary({ data }: {
    data: AdminDashboardData;
}) {
    const rows = [
        { label: 'Aktif', value: data.subscriptions.active },
        { label: 'Kedaluwarsa 7 hari', value: data.subscriptions.expiringSoon },
        { label: 'Menunggu pembayaran', value: data.subscriptions.pending },
        { label: 'Kedaluwarsa', value: data.subscriptions.expired },
    ];
    return (<DashboardCard>
      <p className="text-xs font-medium text-sage-500">Langganan</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-charcoal-900">
        {data.subscriptions.active}{' '}
        <span className="text-sm font-medium text-sage-500">aktif sekarang</span>
      </p>
      <ul className="mt-4 divide-y divide-border">
        {rows.map((r) => (<li key={r.label} className="flex items-center justify-between py-2">
            <span className="text-sm text-charcoal-700">{r.label}</span>
            <span className="text-sm font-semibold tabular-nums text-charcoal-900">{r.value}</span>
          </li>))}
      </ul>
    </DashboardCard>);
}
