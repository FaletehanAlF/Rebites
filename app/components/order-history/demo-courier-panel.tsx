'use client';
import { useCallback, useEffect, useState } from 'react';
import { Bot, Clock } from 'lucide-react';
import { fetchWithAuth } from '@/lib/auth-token';
import { cn } from '@/lib/utils';
import { demoScheduleFor } from '@/lib/demo-courier';
export function DemoCourierPanel({ orderDbId, orderStatus, onAdvanced, className, }: {
    orderDbId: string | null | undefined;
    orderStatus: string;
    onAdvanced?: () => void;
    className?: string;
}) {
    const [active, setActive] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checked, setChecked] = useState(false);
    const canActivate = orderStatus === 'paid' || orderStatus === 'processing';
    const poll = useCallback(async () => {
        if (!orderDbId)
            return;
        try {
            const res = await fetchWithAuth(`/api/courier/demo?orderId=${encodeURIComponent(orderDbId)}`);
            if (!res.ok) {
                setChecked(true);
                return;
            }
            const json = (await res.json()) as {
                active?: boolean;
                advanced?: {
                    status: string;
                } | null;
            };
            setActive(Boolean(json.active));
            setChecked(true);
            if (json.advanced)
                onAdvanced?.();
        }
        catch {
            setChecked(true);
        }
    }, [orderDbId, onAdvanced]);
    useEffect(() => {
        if (!orderDbId)
            return;
        void poll();
        const id = window.setInterval(() => {
            void poll();
        }, 20000);
        return () => window.clearInterval(id);
    }, [orderDbId, poll]);
    const activate = useCallback(async () => {
        if (!orderDbId || busy)
            return;
        setBusy(true);
        try {
            const res = await fetchWithAuth('/api/courier/demo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: orderDbId }),
            });
            if (!res.ok) {
                const json = (await res.json().catch(() => null)) as {
                    error?: string;
                } | null;
                setError(json?.error ?? 'Gagal mengaktifkan kurir demo.');
                return;
            }
            setError(null);
            setActive(true);
            await poll();
            onAdvanced?.();
        }
        catch {
            setError('Gagal mengaktifkan kurir demo.');
        }
        finally {
            setBusy(false);
        }
    }, [orderDbId, busy, poll, onAdvanced]);
    if (!checked)
        return null;
    if (!active && !canActivate)
        return null;
    const completed = orderStatus === 'completed' || orderStatus === 'cancelled';
    const schedule = demoScheduleFor('delivery');
    return (<div className={cn('rounded-2xl border border-dashed border-sage-500/40 bg-cream-50 p-4', className)}>
      <div className="flex items-start gap-2">
        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-sage-500" aria-hidden/>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-charcoal-900">Kurir Demo</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-charcoal-500">
            Untuk menguji alur pesanan sampai selesai. Ini <strong>simulasi</strong> —
            bukan kurir sungguhan, dan tidak ada orang yang mengantar.
          </p>

          {!active && canActivate && (<button type="button" onClick={() => void activate()} disabled={busy} className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-caramel disabled:cursor-not-allowed disabled:opacity-50">
              <Bot className="h-3.5 w-3.5" aria-hidden/>
              {busy ? 'Mengaktifkan...' : 'Aktifkan Kurir Demo'}
            </button>)}

          {active && !completed && (<p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-charcoal-500">
              <Clock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden/>
              <span>
                Demo berjalan otomatis: kurir demo berangkat 2 menit setelah diaktifkan,
                lalu pesanan selesai 6 menit setelahnya. Balasan chat otomatis dikirim
                sebagai <strong>Kurir Demo</strong>.
              </span>
            </p>)}

          {active && completed && (<p className="mt-2 text-[11px] leading-relaxed text-charcoal-500">
              Demo selesai. Pesanan sudah melewati seluruh tahap.
            </p>)}

          {active && (<p className="mt-1.5 text-[10px] text-charcoal-500/80">
              Tahap: {schedule.map((stage) => stage.status).join(' → ')}
            </p>)}

          {error && (<p role="alert" className="mt-1.5 text-[11px] text-caramel-dark">
              {error}
            </p>)}
        </div>
      </div>
    </div>);
}
