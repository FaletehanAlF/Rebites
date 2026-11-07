'use client';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
import { DashboardCard } from './primitives';
import { formatRupiah } from '../admin-format';
import type { OrderAnalyticsPoint } from '@/lib/admin-analytics';
const GREEN = 'hsl(152, 40%, 32%)';
const GRID = '#E4EBE4';
function dayLabel(isoDate: string): string {
    const d = new Date(`${isoDate}T00:00:00`);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
const sumbuRupiah = (v: number) => v >= 1000000 ? `${Math.round(v / 1000000)} jt` : `${Math.round(v / 1000)} rb`;
export function DashboardTrends({ points: source, rangeDays, }: {
    points: OrderAnalyticsPoint[];
    rangeDays: number;
}) {
    const points = source.map((p) => ({
        label: dayLabel(p.date),
        orders: p.orders,
        revenue: p.revenue,
    }));
    const hasOrders = points.some((p) => p.orders > 0);
    const hasRevenue = points.some((p) => p.revenue > 0);
    return (<div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <DashboardCard>
        <p className="font-display text-sm font-semibold text-charcoal-900">
          Pesanan {rangeDays} hari terakhir
        </p>
        {hasOrders ? (<div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID}/>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval="preserveStartEnd"/>
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={28}/>
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }}/>
                <Bar dataKey="orders" name="Pesanan" fill={GREEN} radius={[4, 4, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>) : (<p className="mt-4 py-10 text-center text-sm text-sage-500">Belum ada data pesanan.</p>)}
      </DashboardCard>

      <DashboardCard>
        <p className="font-display text-sm font-semibold text-charcoal-900">
          Nilai bruto pesanan {rangeDays} hari terakhir
        </p>
        {hasRevenue ? (<div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID}/>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval="preserveStartEnd"/>
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={48} tickFormatter={sumbuRupiah}/>
                <Tooltip formatter={(v) => formatRupiah(Number(v))}/>
                <Line type="monotone" dataKey="revenue" name="Nilai bruto pesanan" stroke={GREEN} strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>) : (<p className="mt-4 py-10 text-center text-sm text-sage-500">
            Belum ada nilai pesanan dibayar.
          </p>)}
      </DashboardCard>
    </div>);
}
