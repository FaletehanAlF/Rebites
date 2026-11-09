'use client';
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { DashboardKpiGrid } from '@/app/components/admin/dashboard/dashboard-kpi-grid';
import { DashboardAttention } from '@/app/components/admin/dashboard/dashboard-attention';
import { DashboardMonitoring } from '@/app/components/admin/dashboard/dashboard-monitoring';
import { DashboardActivity } from '@/app/components/admin/dashboard/dashboard-activity';
import { DashboardSubscriptionSummary, DashboardUserSummary, } from '@/app/components/admin/dashboard/dashboard-summaries';
import { DashboardSkeleton } from '@/app/components/admin/dashboard/dashboard-skeleton';
import { DashboardSection } from '@/app/components/admin/dashboard/primitives';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER, } from '@/app/components/admin/admin-page-header';
import { AdminErrorState } from '@/app/components/admin/admin-state';
import { formatTanggalWaktu } from '@/app/components/admin/admin-format';
import { fetchAdminDashboard, type AdminDashboardData } from '@/lib/admin-dashboard';
const DashboardAnalytics = dynamic(() => import('@/app/components/admin/dashboard/dashboard-analytics').then((m) => m.DashboardAnalytics), {
    ssr: false,
    loading: () => (<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>

        {Array.from({ length: 4 }).map((_, index) => (<div key={index} className="h-24 rounded-[var(--radius)] bg-sage-100/60"/>))}

      </div>),
});
const DashboardVisitors = dynamic(() => import('@/app/components/admin/dashboard/dashboard-visitors').then((m) => m.DashboardVisitors), {
    ssr: false,
    loading: () => (<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>

        {Array.from({ length: 4 }).map((_, index) => (<div key={index} className="h-24 rounded-[var(--radius)] bg-sage-100/60"/>))}

      </div>),
});
export default function AdminDashboardPage() {
    const [data, setData] = useState<AdminDashboardData | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const load = useCallback(async () => {
        setStatus('loading');
        try {
            const result = await fetchAdminDashboard();
            setData(result);
            setStatus('ready');
        }
        catch {
            setStatus('error');
        }
    }, []);
    useEffect(() => {
        load();
    }, [load]);
    return (<div className={ADMIN_PAGE_WRAPPER}>

      <AdminPageHeader title="Dashboard" description="Ringkasan aktivitas dan kondisi operasional ReBites."/>



      {status === 'loading' && <DashboardSkeleton />}



      {status === 'error' && (<AdminErrorState title="Gagal memuat dasbor" message="Terjadi kesalahan saat mengambil data operasional." onRetry={load}/>)}



      {status === 'ready' && data && (<>

          <DashboardKpiGrid data={data}/>



          

          <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">

            <DashboardSection title="Perlu perhatian" className="lg:col-span-2">

              <DashboardAttention data={data}/>

            </DashboardSection>

            <DashboardSection title="Monitoring">

              <DashboardMonitoring data={data}/>

            </DashboardSection>

          </div>



          <DashboardSection title="Analitik periode" description="Pilih rentang 7–90 hari" className="mt-8">

            <DashboardAnalytics />

          </DashboardSection>



          <DashboardSection title="Pengunjung website" description="Orang berbeda yang membuka ReBites" className="mt-8">

            <DashboardVisitors />

          </DashboardSection>



          <div className="mt-8 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">

            <DashboardSection title="Ringkasan aktivitas" className="lg:col-span-2">

              <DashboardActivity data={data}/>

            </DashboardSection>

            <div className="grid gap-4">

              <DashboardSection title="Pengguna">

                <DashboardUserSummary data={data}/>

              </DashboardSection>

              <DashboardSection title="Langganan">

                <DashboardSubscriptionSummary data={data}/>

              </DashboardSection>

            </div>

          </div>



          <p className="mt-6 text-xs text-sage-500">

            Diperbarui {formatTanggalWaktu(data.generatedAt)}

          </p>

        </>)}

    </div>);
}
