'use client';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { buildVisitorPieSlices } from '@/lib/visitor-chart';
import { AdminFilterChip } from '../admin-controls';
import { cn } from '@/lib/utils';
export type VisitorChartType = 'line' | 'bar' | 'pie';
export interface VisitorChartPoint {
    day: string;
    label: string;
    visitors: number;
    visits: number;
}
const GREEN = 'hsl(152, 40%, 32%)';
const GRID = '#E4EBE4';
const PIE_COLORS = [
    'hsl(152, 40%, 32%)',
    'hsl(152, 34%, 44%)',
    'hsl(84, 32%, 46%)',
    'hsl(38, 50%, 54%)',
    'hsl(190, 30%, 42%)',
    'hsl(152, 28%, 56%)',
    'hsl(84, 26%, 58%)',
    'hsl(38, 44%, 66%)',
    'hsl(190, 24%, 54%)',
    'hsl(152, 22%, 68%)',
    'hsl(84, 20%, 70%)',
    'hsl(38, 36%, 76%)',
];
const VISITOR_CHART_OPTIONS: {
    value: VisitorChartType;
    label: string;
    icon: LucideIcon;
}[] = [
    { value: 'line', label: 'Garis', icon: LineChartIcon },
    { value: 'bar', label: 'Batang', icon: BarChart3 },
    { value: 'pie', label: 'Lingkaran', icon: PieChartIcon },
];
export function dayLabel(isoDate: string): string {
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime()))
        return isoDate;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
export function VisitorChartSelector({ value, onChange, }: {
    value: VisitorChartType;
    onChange: (value: VisitorChartType) => void;
}) {
    return (<div role="group" aria-label="Pilih jenis diagram" className="flex flex-wrap items-center gap-1.5">
      {VISITOR_CHART_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (<AdminFilterChip key={option.value} active={value === option.value} onClick={() => onChange(option.value)}>
            <span className="flex items-center gap-1.5">
              <Icon aria-hidden className="h-3.5 w-3.5"/>
              {option.label}
            </span>
          </AdminFilterChip>);
        })}
    </div>);
}
function sumbuPengunjung() {
    return (<YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={28}/>);
}
function sumbuHari() {
    return (<XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval="preserveStartEnd"/>);
}
function VisitorPie({ points }: {
    points: VisitorChartPoint[];
}) {
    const slices = buildVisitorPieSlices(points);
    if (slices.length === 0) {
        return (<p className="py-10 text-center text-sm text-sage-500">
        Belum ada kunjungan pada rentang ini, jadi belum ada yang bisa dibagi.
      </p>);
    }
    const data = slices.map((slice, index) => ({
        name: slice.aggregated ? `Hari lainnya (${slice.days} hari)` : dayLabel(slice.key),
        value: slice.visitors,
        color: PIE_COLORS[index % PIE_COLORS.length],
    }));
    const total = data.reduce((sum, entry) => sum + entry.value, 0);
    return (<div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip formatter={(value) => `${Number(value).toLocaleString('id-ID')} pengunjung`}/>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="82%" paddingAngle={2} stroke="#FFFFFF" strokeWidth={2}>
              {data.map((entry) => (<Cell key={`${entry.name}-${entry.value}`} fill={entry.color}/>))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {data.map((entry) => (<li key={`${entry.name}-${entry.value}`} className="flex items-center gap-2 text-xs">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }}/>
            <span className="min-w-0 flex-1 truncate text-charcoal-700">{entry.name}</span>
            <span className="shrink-0 font-semibold tabular-nums text-charcoal-900">
              {entry.value.toLocaleString('id-ID')}
            </span>
            <span className="w-10 shrink-0 text-right tabular-nums text-sage-500">
              {total > 0 ? `${Math.round((entry.value / total) * 100)}%` : '0%'}
            </span>
          </li>))}
      </ul>
    </div>);
}
export function VisitorChart({ points, type, className, }: {
    points: VisitorChartPoint[];
    type: VisitorChartType;
    className?: string;
}) {
    if (points.length === 0)
        return null;
    if (type === 'pie') {
        return (<div className={className}>
        <VisitorPie points={points}/>
      </div>);
    }
    if (type === 'line') {
        return (<div className={cn('h-56 w-full', className)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID}/>
            {sumbuHari()}
            {sumbuPengunjung()}
            <Tooltip />
            <Line type="monotone" dataKey="visitors" name="Pengunjung unik" stroke={GREEN} strokeWidth={2} dot={false} activeDot={{ r: 4 }}/>
          </LineChart>
        </ResponsiveContainer>
      </div>);
    }
    return (<div className={cn('h-56 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} barSize={16}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID}/>
          {sumbuHari()}
          {sumbuPengunjung()}
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }}/>
          <Bar dataKey="visitors" name="Pengunjung unik" fill={GREEN} radius={[4, 4, 0, 0]}/>
        </BarChart>
      </ResponsiveContainer>
    </div>);
}
