'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck, MapPin, Navigation, Package, PackageCheck, Store, Truck, } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/app/components/seller/dashboard-penjual/Card';
import { RequireAuth } from '@/app/components/auth/require-auth';
import { CourierChat } from '@/app/components/buyer/order-history/courier-chat';
import { toast } from '@/hooks/use-toast';
import { useCourierAssignments, useCourierPositionSender, type CourierAssignment, } from '@/hooks/use-courier-assignments';
import { useCourierProfile } from '@/hooks/use-courier-profile';
import { fetchWithAuth } from '@/lib/auth-token';
const STATUS_LABEL: Record<string, string> = {
    assigned: 'Menunggu diambil',
    picked_up: 'Sudah diambil dari toko',
    delivering: 'Sedang diantar',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
};
interface AddressInfo {
    receiverName?: string;
    phone?: string;
    fullAddress?: string;
    district?: string;
    city?: string;
    province?: string;
    postalCode?: string;
}
function readAddress(raw: Record<string, unknown> | null): AddressInfo | null {
    if (!raw)
        return null;
    const value = raw as AddressInfo;
    const parts = [value.fullAddress, value.district, value.city, value.province, value.postalCode]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
    if (parts.length === 0)
        return null;
    return value;
}
function TaskCard({ assignment, onAdvance, }: {
    assignment: CourierAssignment;
    onAdvance: (assignmentId: string, target: 'picked_up' | 'delivering' | 'completed') => Promise<void>;
}) {
    const [busy, setBusy] = useState(false);
    const address = readAddress(assignment.order?.addressSnapshot ?? null);
    const isActive = assignment.status === 'picked_up' || assignment.status === 'delivering';
    const isDone = assignment.status === 'completed' || assignment.status === 'cancelled';
    const { send, sending, lastSentAtIso, error: positionError } = useCourierPositionSender({
        orderId: isActive ? assignment.orderId : null,
        active: isActive,
    });
    const advance = useCallback(async (target: 'picked_up' | 'delivering' | 'completed') => {
        if (busy)
            return;
        setBusy(true);
        try {
            await onAdvance(assignment.id, target);
        }
        finally {
            setBusy(false);
        }
    }, [assignment.id, busy, onAdvance]);
    return (<li className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-charcoal-900">
            {assignment.order?.productName ?? 'Pesanan'}
          </p>
          <p className="mt-0.5 text-xs text-charcoal-500">
            #{assignment.order?.orderCode ?? '-'} · {assignment.order?.vendorName ?? '-'}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cream-100 px-2.5 py-1 text-[11px] font-semibold text-charcoal-700">
          {assignment.order?.fulfillment === 'pickup' ? (<Store className="h-3 w-3" aria-hidden/>) : (<Truck className="h-3 w-3" aria-hidden/>)}
          {STATUS_LABEL[assignment.status] ?? assignment.status}
        </span>
      </div>

      {address && (<div className="flex items-start gap-2 rounded-xl bg-cream-50 px-3 py-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage-500" aria-hidden/>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-charcoal-900">
              {address.receiverName ?? 'Penerima'}
              {address.phone ? ` · ${address.phone}` : ''}
            </p>
            <p className="mt-0.5 break-words text-[11px] leading-relaxed text-charcoal-500">
              {[
                address.fullAddress,
                address.district,
                address.city,
                address.province,
                address.postalCode,
            ]
                .filter((part): part is string => Boolean(part))
                .join(', ')}
            </p>
          </div>
        </div>)}

      {assignment.distanceKm != null && (<p className="flex items-center gap-1.5 text-[11px] text-charcoal-500">
          <Navigation className="h-3.5 w-3.5 shrink-0" aria-hidden/>
          Jarak dari posisimu ke toko saat ditugaskan:{' '}
          {assignment.distanceKm.toLocaleString('id-ID', { maximumFractionDigits: 1 })} km
        </p>)}

      {isActive && (<div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void send()} disabled={sending} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline px-3 text-[11px] font-semibold text-charcoal-900 transition-colors hover:border-primary hover:text-primary disabled:opacity-50">
            <Navigation className="h-3.5 w-3.5" aria-hidden/>
            {sending ? 'Mengirim...' : 'Kirim posisi sekarang'}
          </button>
          <p className="text-[11px] text-charcoal-500">
            {lastSentAtIso
                ? `Posisi terakhir dikirim ${new Date(lastSentAtIso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                : 'Belum ada posisi terkirim'}
          </p>
        </div>)}

      {positionError && (<p role="alert" className="text-[11px] leading-relaxed text-caramel-dark">
          {positionError} Task tetap bisa dikerjakan; pembeli hanya tidak melihat posisi
          kurir.
        </p>)}

      {!isDone && (<div className="flex flex-wrap gap-2">
          {assignment.status === 'assigned' && (<button type="button" onClick={() => void advance('picked_up')} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-caramel disabled:opacity-50">
              <PackageCheck className="h-3.5 w-3.5" aria-hidden/>
              {busy ? 'Memproses...' : 'Pesanan sudah diambil'}
            </button>)}
          {assignment.status === 'picked_up' && (<button type="button" onClick={() => void advance('delivering')} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-purple-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50">
              <Truck className="h-3.5 w-3.5" aria-hidden/>
              {busy ? 'Memproses...' : 'Mulai antar ke pembeli'}
            </button>)}
          {assignment.status === 'delivering' && (<button type="button" onClick={() => void advance('completed')} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden/>
              {busy ? 'Memproses...' : 'Selesai diantar'}
            </button>)}
        </div>)}

      {assignment.orderId && (<CourierChat orderDbId={assignment.orderId}/>)}
    </li>);
}
function CourierDashboardContent() {
    const { courier, schemaReady, loading: profileLoading } = useCourierProfile();
    const { assignments, loading, error, updateStatus } = useCourierAssignments(schemaReady && Boolean(courier));
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [vehicleType, setVehicleType] = useState<'motor' | 'mobil' | 'sepeda'>('motor');
    const [saving, setSaving] = useState(false);
    const active = useMemo(() => assignments.filter((assignment) => assignment.status !== 'completed' && assignment.status !== 'cancelled'), [assignments]);
    const finished = useMemo(() => assignments.filter((assignment) => assignment.status === 'completed' || assignment.status === 'cancelled'), [assignments]);
    const advance = useCallback(async (assignmentId: string, target: 'picked_up' | 'delivering' | 'completed') => {
        try {
            await updateStatus(assignmentId, target);
            toast({ title: 'Status tugas diperbarui.' });
        }
        catch (err) {
            toast({
                title: 'Gagal memperbarui status',
                description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
            });
        }
    }, [updateStatus]);
    const register = useCallback(async () => {
        setSaving(true);
        try {
            const res = await fetchWithAuth('/api/courier/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName, phone, vehicleType }),
            });
            if (!res.ok) {
                const json = (await res.json().catch(() => null)) as {
                    error?: string;
                } | null;
                toast({
                    title: 'Gagal mendaftar',
                    description: json?.error ?? 'Terjadi kesalahan.',
                });
                return;
            }
            toast({ title: 'Berhasil mendaftar sebagai kurir' });
            window.location.reload();
        }
        catch {
            toast({ title: 'Gagal mendaftar', description: 'Terjadi kesalahan.' });
        }
        finally {
            setSaving(false);
        }
    }, [fullName, phone, vehicleType]);
    if (profileLoading) {
        return (<div className="flex min-h-screen items-center justify-center bg-secondary">
        <div role="status" aria-label="Memuat dashboard kurir" className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none"/>
      </div>);
    }
    if (!schemaReady) {
        return (<div className="flex min-h-screen items-center justify-center bg-secondary p-6">
        <Card className="max-w-md text-center">
          <Package className="mx-auto h-8 w-8 text-sage-500" aria-hidden/>
          <h1 className="mt-3 font-display text-lg font-semibold text-charcoal-900">
            Fitur kurir belum aktif
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-charcoal-500">
            Infrastruktur data kurir belum tersedia di database ini. Fitur ini akan aktif
            setelah migrasi terkait dijalankan.
          </p>
        </Card>
      </div>);
    }
    if (!courier) {
        return (<div className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <h1 className="font-display text-lg font-semibold text-charcoal-900">
            Daftar sebagai Kurir
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-charcoal-500">
            Setelah terdaftar, pesanan yang siap diantar akan otomatis ditugaskan ke
            kurir terdekat dengan posisi paling baru.
          </p>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-charcoal-700">Nama lengkap</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-hairline bg-cream-50 px-3 text-sm outline-none focus:border-primary focus:bg-white"/>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-charcoal-700">Nomor HP (opsional)</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} className="mt-1 h-11 w-full rounded-xl border border-hairline bg-cream-50 px-3 text-sm outline-none focus:border-primary focus:bg-white"/>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-charcoal-700">Kendaraan</span>
              <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value as 'motor' | 'mobil' | 'sepeda')} className="mt-1 h-11 w-full rounded-xl border border-hairline bg-cream-50 px-3 text-sm outline-none focus:border-primary focus:bg-white">
                <option value="motor">Motor</option>
                <option value="mobil">Mobil</option>
                <option value="sepeda">Sepeda</option>
              </select>
            </label>
          </div>

          <button type="button" onClick={() => void register()} disabled={saving || !fullName.trim()} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-white transition-colors hover:bg-caramel disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Mendaftarkan...' : 'Daftar sebagai Kurir'}
          </button>
        </Card>
      </div>);
    }
    return (<main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-display text-xl font-semibold text-charcoal-900">
          Dashboard Kurir
        </h1>
        <p className="mt-1 text-sm text-charcoal-500">
          {courier.fullName} · {courier.vehicleType === 'motor' ? 'Motor' : courier.vehicleType === 'mobil' ? 'Mobil' : 'Sepeda'}
          {!courier.isActive && ' · Akun sedang dinonaktifkan admin'}
        </p>
      </header>

      {error && (<p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>)}

      <section aria-labelledby="tugas-aktif" className="mb-8">
        <h2 id="tugas-aktif" className="mb-3 font-display text-base font-semibold text-charcoal-900">
          Tugas aktif ({active.length})
        </h2>
        {loading && active.length === 0 ? (<p className="text-sm text-charcoal-500">Memuat tugas…</p>) : active.length === 0 ? (<Card>
            <p className="text-sm text-charcoal-500">
              Belum ada tugas. Pesanan yang siap diantar akan otomatis muncul di sini.
            </p>
          </Card>) : (<ul className="space-y-3">
            {active.map((assignment) => (<TaskCard key={assignment.id} assignment={assignment} onAdvance={advance}/>))}
          </ul>)}
      </section>

      {finished.length > 0 && (<section aria-labelledby="tugas-selesai">
          <h2 id="tugas-selesai" className="mb-3 font-display text-base font-semibold text-charcoal-900">
            Riwayat tugas ({finished.length})
          </h2>
          <ul className="space-y-3">
            {finished.map((assignment) => (<li key={assignment.id} className="rounded-2xl border border-border/70 bg-white p-4">
                <p className="text-sm font-semibold text-charcoal-900">
                  {assignment.order?.productName ?? 'Pesanan'}
                </p>
                <p className="mt-0.5 text-xs text-charcoal-500">
                  #{assignment.order?.orderCode ?? '-'} ·{' '}
                  {STATUS_LABEL[assignment.status] ?? assignment.status}
                </p>
              </li>))}
          </ul>
        </section>)}
    </main>);
}
export default function CourierDashboardPage() {
    return (<RequireAuth>
      <CourierDashboardContent />
    </RequireAuth>);
}
